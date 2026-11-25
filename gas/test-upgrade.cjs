// In-memory PostgreSQL only. No production URL, network or credentials.
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8').replace(/^\\set.*$/mg,'');
(async()=>{
 const db=new PGlite();
 try {
  await db.exec(read('test-db-base.sql'));
  await db.exec(read('schema-proposal.sql'));
  await db.exec(read('test-database.sql'));
  console.log('PASS: original database regression suite');
  const before=(await db.query('select * from food_reference_prices order by id')).rows;
  await db.exec(read('upgrade-1.4.0.sql'));
  assert.deepEqual((await db.query('select * from food_reference_prices order by id')).rows,before);
  const key='cat|00000000-0000-0000-0000-000000000001';
  const job={job_key:key,species:'cat',feed_id:key.split('|')[1],outcome:'retryable_error',
   reason:'429',issue_type:'gemini_rate_limit',fingerprint:'f',audit:{calls:1},candidate_data:{candidates:[]}};
  const save=async j=>db.query('select proved_save_coupang_job($1::jsonb)',[JSON.stringify(j)]);
  await db.exec("update proved_coupang_jobs set attempts=1061");
  await save({...job,outcome:'retry_exhausted',audit:{calls:0,attempt_consumed:false}});
  let row=(await db.query('select * from proved_coupang_jobs')).rows[0];
  assert.equal(row.attempts,1061);assert.equal(row.outcome,'retry_exhausted');assert.equal(row.next_retry_at,Infinity);
  console.log('PASS: historical 1061 attempts preserved, terminal queue state');
  const job2={...job,job_key:'cat|00000000-0000-0000-0000-000000000002',feed_id:'00000000-0000-0000-0000-000000000002'};
  await save(job2);
  row=(await db.query('select *,extract(epoch from next_retry_at-clock_timestamp()) as seconds from proved_coupang_jobs where job_key=$1',[job2.job_key])).rows[0];
  assert.ok(Number(row.seconds)>=28 && Number(row.seconds)<=61);
  const future=new Date(Date.now()+7200000).toISOString();
  await save({...job2,audit:{calls:0,attempt_consumed:false,retry_at:future}});
  row=(await db.query('select * from proved_coupang_jobs where job_key=$1',[job2.job_key])).rows[0];
  assert.equal(row.attempts,1);assert.ok(new Date(row.next_retry_at).getTime()>=Date.parse(future));
  for(let i=0;i<4;i++) await save(job2);
  row=(await db.query('select * from proved_coupang_jobs where job_key=$1',[job2.job_key])).rows[0];
  assert.equal(row.attempts,5);assert.equal(row.outcome,'retry_exhausted');
  assert.equal(row.audit.total_gemini_calls,5);
  console.log('PASS: bounded backoff, server wait priority, quota deferral, call totals');
  const reserve=async(scope='test',rpm=2,rpd=10)=>(await db.query(
   "select proved_reserve_gemini_call($1,'gemini-3-flash-preview',$2,'f',$3,$4) as r",[scope,key+'|'+scope,rpm,rpd])).rows[0].r;
  const finish=async(id,result={http_status:200,usage:{promptTokenCount:100,candidatesTokenCount:10}})=>(await db.query(
   'select proved_finish_gemini_call($1,$2) as r',[id,JSON.stringify(result)])).rows[0].r;
  let a=await reserve();assert.equal(a.allowed,true);
  assert.equal((await reserve()).reason,'concurrency');
  await finish(a.request_id);await finish(a.request_id);
  a=await reserve();await finish(a.request_id);
  assert.equal((await reserve()).reason,'minute_budget');
  a=await reserve('day',10,1);await finish(a.request_id);
  assert.equal((await reserve('day',10,1)).reason,'daily_budget');
  assert.equal((await reserve('day',10,1)).reason,'circuit_open');
  a=await reserve('api-day');
  const result=await finish(a.request_id,{http_status:429,error_type:'daily_quota'});
  assert.ok(Date.parse(result.retry_at)>Date.now());
  assert.equal((await reserve('api-day')).reason,'circuit_open');
  a=await reserve('unknown');await finish(a.request_id,{http_status:429,error_type:'rate_limit_unknown',retry_at:future});
  assert.ok(Date.parse((await reserve('unknown')).retry_at)>=Date.parse(future));
  console.log('PASS: reservations, concurrency, rolling RPM, RPD, daily/unknown 429 circuit');
  a=await reserve('crash');
  await db.exec("update proved_gemini_calls set lease_until=clock_timestamp()-interval '1 second' where scope='crash'");
  assert.equal((await reserve('crash')).allowed,true);
  console.log('PASS: crash lease expires, reserved failed calls remain counted');
  a=await reserve('cache',2,1);await finish(a.request_id);
  await finish(a.request_id,{validation:'valid',judgments:[]});
  assert.deepEqual((await reserve('cache',2,1)).judgments,[]);
  console.log('PASS: validated fingerprint cache bypasses exhausted quota without a new reservation');
  const dst=(await db.query("select extract(epoch from (((date_trunc('day',t at time zone 'America/Los_Angeles')+interval '1 day') at time zone 'America/Los_Angeles')-(date_trunc('day',t at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles'))) /3600 as hours from (values ('2026-03-08T12:00:00Z'::timestamptz),('2026-11-01T12:00:00Z'::timestamptz)) v(t)")).rows;
  assert.deepEqual(dst.map(r=>Number(r.hours)),[23,25]);
  console.log('PASS: Pacific daily reset handles 23/25-hour DST days');
  const classify=async(issue,data)=>{
   const id=(await db.query("insert into food_price_review_queue(species,feed_id,status,issue_type,candidate_data) values ('cat',gen_random_uuid(),'open',$1,$2) returning id",[issue,JSON.stringify(data)])).rows[0].id;
   return (await db.query('select processing_outcome from proved_coupang_review_triage where id=$1',[id])).rows[0].processing_outcome;
  };
  assert.equal(await classify('ambiguous_product_match',{searches:[{ok:true}],package_candidates:[]}),'insufficient_evidence');
  assert.equal(await classify('ambiguous_package',{package_candidates:[{match_score:1,package_info:{parse_method:'unparsed'}}]}),'insufficient_evidence');
  assert.equal(await classify('ambiguous_package',{package_candidates:[{match_score:1,package_info:{parse_method:'conflicting_weights'}}]}),'manual_review');
  assert.equal(await classify('ambiguous_product_match',{searches:[{ok:false}]}),'retryable_error');
  assert.equal(await classify('conflicting_identity_evidence',{}),'manual_review');
  assert.equal(await classify('ambiguous_package',{package_candidates:null,searches:null}),'insufficient_evidence');
  assert.ok((await db.query('select count(*)::integer as n from food_price_review_queue')).rows[0].n>=6);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from proved_coupang_review_triage'),/permission denied/);
  await db.exec('reset role');
  console.log('PASS: triage separates missing data and conflicts, preserves records, denies anon');
 } finally {await db.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
