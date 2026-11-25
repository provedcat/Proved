const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'ProvedCoupangV1_4_0.gs'),'utf8');
function harness(){
 const p={GEMINI_ENABLED:'true',GEMINI_API_KEY:'test',GEMINI_BUDGET_EXHAUSTED:'false',GEMINI_QUOTA_SCOPE:'test',GEMINI_RPM:'2',GEMINI_RPD:'10',SUPABASE_SERVICE_KEY:'test',COUPANG_ACCESS_KEY:'test',COUPANG_SECRET_KEY:'test'};
 const props={getProperty:k=>p[k]??null,setProperty:(k,v)=>p[k]=v,setProperties:o=>Object.assign(p,o),deleteProperty:k=>delete p[k]};
 let held=false,allowed=true;
 const lock={hasLock:()=>held,tryLock:()=>allowed?(held=true):false,releaseLock:()=>held=false};
 const ctx=vm.createContext({console,PropertiesService:{getScriptProperties:()=>props},LockService:{getScriptLock:()=>lock},
 Logger:{log:()=>{}},Utilities:{sleep:()=>{},DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(v).digest())},
 UrlFetchApp:{fetch:()=>{throw Error('Unexpected network');}}});
 vm.runInContext(source,ctx);
 const run=s=>vm.runInContext(s,ctx);
 run(`var requests=[],saved=[],jobs=[],fetches=0;
 _supabaseRest=function(method,table,q,payload){requests.push({method:method,table:table,payload:payload});
 if(table==='proved_coupang_jobs')return jobs;
 if(table==='rpc/proved_reserve_gemini_call')return {allowed:true,request_id:'reservation'};
 if(table==='rpc/proved_save_coupang_job')saved.push(payload.p_job);
 return {};};
 var feed={id:'f',type:'wet',제조사:'지위픽',제품명:'지위픽 캣 고등어 양고기 185g'};
 var target={species:'cat',feed_id:'f'};
 var original={outcome:'review_required',issue_type:'ambiguous_product_match',reason:'unknown'};
 var candidate=_analyzeCandidate(feed,target,{productId:1,productName:'지위픽 캣 고등어 양고기 185g 1개',productPrice:10000,productUrl:'https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3'});
 `);
 return {ctx,p,run,setAllowed:v=>allowed=v};
}
const reports=[];
function test(name,fn){try{fn(harness());reports.push({name,passed:true});}catch(e){reports.push({name,passed:false,error:e.stack});}}
test('P0 1061 historical attempts blocked before search or Gemini',h=>{
 h.run(`jobs=[{outcome:'retryable_error',attempts:1061,reason:'Gemini HTTP 429',issue_type:'gemini_rate_limit',candidate_data:{candidates:[]},audit:{calls:1}}];
 _getPriceFeedRecord=function(){throw Error('must not fetch');};`);
 const r=h.run(`_runCoupangPricePipeline([target],true)[0]`);
 assert.equal(r.decision.outcome,'retry_exhausted');assert.equal(r.skipped,true);
 assert.equal(h.run(`saved[0].audit.calls`),0);assert.equal(h.run(`saved[0].audit.attempt_consumed`),false);
});
test('P0 future retry never searches, calls, or rewrites wait',h=>{
 h.run(`jobs=[{outcome:'retryable_error',attempts:2,next_retry_at:new Date(Date.now()+3600000).toISOString()}];`);
 assert.equal(h.run(`_runCoupangPricePipeline([target],true)[0].skipped`),true);
 assert.equal(h.run(`saved.length`),0);
});
test('P0 Retry-After and fractional RetryInfo honor longer delay',h=>{
 const before=Date.now();
 const e=h.run(`_geminiHttpError({getResponseCode:function(){return 429;},getAllHeaders:function(){return {'Retry-After':'120'};},getContentText:function(){return JSON.stringify({error:{details:[{retryDelay:'180.5s'},{violations:[{quotaId:'GenerateRequestsPerMinutePerProjectPerModel'}]}]}});}})`);
 assert.equal(e.error_type,'minute_quota');assert.ok(Date.parse(e.retry_at)>=before+180500);
});
test('P0 HTTP-date Retry-After and daily quota identification',h=>{
 h.ctx.future=new Date(Date.now()+7200000).toUTCString();
 const e=h.run(`_geminiHttpError({getResponseCode:function(){return 429;},getAllHeaders:function(){return {'retry-after':future};},getContentText:function(){return JSON.stringify({error:{details:[{violations:[{quotaMetric:'generativelanguage.googleapis.com/generate_content_free_tier_requests',quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}]}});}})`);
 assert.equal(e.error_type,'daily_quota');assert.ok(Date.parse(e.retry_at)>=Date.parse(h.ctx.future));
});
test('P0 unknown 429 stays unknown; auth/model/5xx distinct',h=>{
 for(const [code,type] of [[429,'rate_limit_unknown'],[403,'authentication'],[404,'model_unavailable'],[503,'server_error']]){
  h.ctx.code=code;assert.equal(h.run(`_geminiHttpError({getResponseCode:function(){return code;},getContentText:function(){return '{}';}}).error_type`),type);
 }
});
test('P1 durably queued product error allows next feed',h=>{
 Object.assign(h.p,{COUPANG_PRICE_COLLECTION_ACTIVE:'true',COUPANG_PRICE_COLLECTION_PHASE:'cat'});
 h.run(`var handled=[],scheduled=[];_scheduleCoupangCollectionContinuation=function(ms){scheduled.push(ms);};_finishCoupangPriceCollection=function(){};
 _loadCollectionFeedPage=function(species,last){return species==='cat'&&!last?[{id:'a'},{id:'b'}]:[];};
 _loadExistingReferenceIds=function(){return {};};
 _runCoupangPricePipeline=function(ts){handled.push(ts[0].feed_id);return [{decision:{outcome:ts[0].feed_id==='a'?'retryable_error':'insufficient_evidence'}}];};`);
 h.ctx.continueCoupangPriceCollection();assert.equal(h.run(`handled.join(',')`),'a,b');assert.equal(h.p.COUPANG_PRICE_COLLECTION_PHASE,'done');
 assert.equal(h.run(`scheduled[0]`),420000);
});
test('P1 durable storage failure holds checkpoint',h=>{
 Object.assign(h.p,{COUPANG_PRICE_COLLECTION_ACTIVE:'true',COUPANG_PRICE_COLLECTION_PHASE:'cat'});
 h.run(`_scheduleCoupangCollectionContinuation=function(){};_loadCollectionFeedPage=function(){return [{id:'a'},{id:'b'}];};
 _loadExistingReferenceIds=function(){return {};};_runCoupangPricePipeline=function(){return [{persistence_error:'db down'}];};`);
 assert.equal(h.ctx.continueCoupangPriceCollection().status,'retry_scheduled');assert.equal(h.p.COUPANG_PRICE_COLLECTION_LAST_ID,'');
});
test('P1 execution deadline preserves last completed product',h=>{
 Object.assign(h.p,{COUPANG_PRICE_COLLECTION_ACTIVE:'true',COUPANG_PRICE_COLLECTION_PHASE:'cat'});
 h.run(`var now=1000;Date.now=function(){return now;};_scheduleCoupangCollectionContinuation=function(){};
 _loadCollectionFeedPage=function(){return [{id:'a'},{id:'b'}];};_loadExistingReferenceIds=function(){return {};};
 _runCoupangPricePipeline=function(){now+=220000;return [{decision:{outcome:'insufficient_evidence'}}];};`);
 h.ctx.continueCoupangPriceCollection();assert.equal(h.p.COUPANG_PRICE_COLLECTION_LAST_ID,'a');
});
test('P1 overlapping entry returns busy',h=>{
 h.setAllowed(false);assert.equal(h.run(`_runCoupangPricePipeline([target],true)[0].status`),'busy');
});
test('P1 concurrent stop is preserved at checkpoint',h=>{
 Object.assign(h.p,{COUPANG_PRICE_COLLECTION_ACTIVE:'false',COUPANG_PRICE_COLLECTION_LAST_ID:'a'});
 h.run(`_writeCoupangCollectionState({active:true,phase:'cat',last_id:'b'});`);
 assert.equal(h.p.COUPANG_PRICE_COLLECTION_ACTIVE,'false');
});
test('P1 resume preserves cursor and counters',h=>{
 Object.assign(h.p,{COUPANG_PRICE_COLLECTION_ACTIVE:'false',COUPANG_PRICE_COLLECTION_PHASE:'cat',COUPANG_PRICE_COLLECTION_LAST_ID:'a',COUPANG_PRICE_COLLECTION_SEARCHED:'42'});
 h.run(`_scheduleCoupangCollectionContinuation=function(){};`);
 const r=h.ctx.resumeCoupangPriceCollection();assert.equal(r.last_id,'a');assert.equal(r.searched,42);assert.equal(r.active,true);
});
test('P1 rules continue while Gemini unavailable and normal price stays mandatory',h=>{
 h.run(`_getPriceFeedRecord=function(){return feed;};_searchCoupangCandidatesV53=function(){return {products:[{productId:1,productName:candidate.product_name,productPrice:1,productUrl:candidate.product_url}],searches:[{ok:true}]};};
 _applyPermanentOptionMetadata=function(cs){return {candidates:cs,metadata_hits:[]};};
 _callGeminiPriceJudge=function(){throw Error('circuit open must not affect rules');};
 _attachNormalPrice=function(c){return c;};`);
 const r=h.run(`_runCoupangPricePipeline([target],true)[0]`);
 assert.equal(r.decision.outcome,'insufficient_evidence');assert.equal(r.decision.reason,'normal_price_not_verified');
});
test('P1 deferred queue advances after first product failure',h=>{
 h.run(`_supabaseRest=function(){return [{job_key:'a',species:'cat',feed_id:'a'},{job_key:'b',species:'cat',feed_id:'b'}];};
 var handled=[];_runCoupangPricePipeline=function(ts){handled.push(ts[0].feed_id);return [{decision:{outcome:'retryable_error'}}];};`);
 assert.equal(h.ctx.reprocessCoupangDeferredJobs(2).processed,2);assert.equal(h.run(`handled.join(',')`),'a,b');
});
test('P2 quota circuit deferral records zero calls and zero attempt consumption',h=>{
 h.run(`_supabaseRest=function(method,table){return table==='proved_coupang_jobs'?[]:{allowed:false,reason:'circuit_open',retry_at:new Date(Date.now()+3600000).toISOString()};};`);
 const r=h.run(`_geminiResolveAmbiguousDecision(feed,target,[candidate],original)`);
 assert.equal(r.audit.calls,0);assert.equal(r.audit.attempt_consumed,false);assert.equal(r.decision.outcome,'retryable_error');
});
test('P2 missing project quotas fail closed without HTTP',h=>{
 h.run(`PRICE_PIPELINE_CONFIG.GEMINI_RPD=0;`);
 const r=h.run(`_geminiResolveAmbiguousDecision(feed,target,[candidate],original)`);
 assert.equal(r.audit.calls,0);assert.equal(r.decision.outcome,'blocked_error');
});
test('P2 stable identity fingerprint ignores price, trace URL, candidate order',h=>{
 assert.equal(h.run(`_priceFingerprint(feed,target,[candidate])`),h.run(`_priceFingerprint(feed,target,[Object.assign({},candidate,{product_price:999,affiliate_url:'random'})])`));
 assert.notEqual(h.run(`_priceFingerprint(feed,target,[candidate])`),h.run(`_priceFingerprint(feed,target,[Object.assign({},candidate,{product_name:'changed'})])`));
});
test('P2 DB cache bypasses circuit and HTTP with calls zero',h=>{
 h.run(`_supabaseRest=function(){return {allowed:true,judgments:[]};};var audit={calls:1};`);
 assert.equal(h.run(`_callGeminiPriceJudge({},'f','hash',audit).candidates.length`),0);assert.equal(h.run(`audit.calls`),0);
});
test('P2 reservation failure cannot cause unmetered HTTP',h=>{
 h.run(`_supabaseRest=function(method,table){if(table==='proved_coupang_jobs')return [];throw Error('quota DB down');};`);
 const r=h.run(`_geminiResolveAmbiguousDecision(feed,target,[candidate],original)`);
 assert.equal(r.audit.calls,0);assert.equal(r.decision.outcome,'retryable_error');
});
test('P2 exhausted monthly budget blocks HTTP and automatic recovery',h=>{
 h.run(`PRICE_PIPELINE_CONFIG.GEMINI_BUDGET_EXHAUSTED=true;`);
 const r=h.run(`_geminiResolveAmbiguousDecision(feed,target,[candidate],original)`);
 assert.equal(r.audit.calls,0);assert.equal(r.decision.outcome,'blocked_error');
 assert.equal(r.decision.issue_type,'gemini_monthly_budget_exhausted');
 assert.throws(()=>h.ctx.requeueCoupangBlockedJob('cat','00000000-0000-0000-0000-000000000001'),/budget remains exhausted/);
});
test('P3 preview only reads classification view',h=>{
 h.ctx.previewCoupangReviewTriage();assert.equal(h.run(`requests.length`),1);assert.equal(h.run(`requests[0].method`),'get');
 assert.equal(h.run(`requests[0].table`),'proved_coupang_review_triage');
});
const summary={total:reports.length,passed:reports.filter(r=>r.passed).length,failed:reports.filter(r=>!r.passed).length,reports};
console.log(JSON.stringify(summary,null,2));if(summary.failed)process.exitCode=1;
