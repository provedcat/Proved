// Offline GAS harness. No network, credentials, live prices or production writes.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const path=require('node:path');
const properties={GEMINI_ENABLED:'true',GEMINI_API_KEY:'test',GEMINI_BUDGET_EXHAUSTED:'false',GEMINI_QUOTA_SCOPE:'test-project',GEMINI_RPM:'2',GEMINI_RPD:'10',COUPANG_ACCESS_KEY:'test',COUPANG_SECRET_KEY:'test',SUPABASE_SERVICE_KEY:'test'};
const props={getProperty:k=>properties[k]??null,setProperty:(k,v)=>properties[k]=v,
 deleteProperty:k=>delete properties[k],setProperties:o=>Object.assign(properties,o)};
const context=vm.createContext({console,PropertiesService:{getScriptProperties:()=>props},
 Logger:{log:()=>{}},Utilities:{sleep:()=>{},DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
 computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(v).digest())},
 LockService:{getScriptLock:()=>({hasLock:()=>false,tryLock:()=>true,releaseLock:()=>{}})},
 UrlFetchApp:{fetch:()=>{throw Error('Unexpected network access');}}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'ProvedCoupangV1_4_0.gs'),'utf8'),context);
let passed=0;const reports=[];
function test(name,fn){try{fn();passed++;reports.push({name,passed:true});}catch(e){reports.push({name,passed:false,error:e.stack});}}
function run(code){return vm.runInContext(code,context);}
run(`
var fixtureFeed={id:'00000000-0000-0000-0000-000000000001',type:'wet',제조사:'지위픽',제품명:'지위픽 캣 고등어 양고기 185g'};
var fixtureTarget={species:'cat',feed_id:fixtureFeed.id};
function candidate(name,id,price){return _analyzeCandidate(fixtureFeed,fixtureTarget,{
 productId:id||1,productName:name,productPrice:price||12000,
 productUrl:'https://www.coupang.com/vp/products/'+(id||1)+'?itemId=2&vendorItemId=3'});}
var dbCalls=[];
_supabaseRest=function(method,table,query,payload){dbCalls.push({method:method,table:table,query:query,payload:payload});return [];};
function judgments(candidates){return {candidates:candidates.map(function(c){return {
 candidate_id:c.candidate_id||_priceCandidateId(c),identity:'matched',brand:'matched',product_family:'matched',species:'matched',
 life_stage:'matched',recipe:'matched',form:'matched',unit_weight_g:null,pack_count:null,
 package_evidence:'',reason:'same explicit product',confidence:0.99,needs_additional_verification:false};})};}
var actualJudge=_callGeminiPriceJudge;
var originalDecision={outcome:'review_required',issue_type:'ambiguous_product_match',reason:'unknown',best_candidate:null};
`);
test('existing matching fixtures',()=>{const r=context.testCoupangPriceMatchingFixtures();assert.equal(r.failed,0);assert.equal(r.total,34);});
test('existing compatibility price fixtures',()=>assert.equal(context.testCoupangCurrentPricePolicy(),'OK'));
test('existing Gemini evidence fixtures',()=>{const r=context.testCoupangGeminiEvidenceFixtures();assert.equal(r.passed,r.total);});
test('1 GI Biome and GI Biome Stress are blocked both directions',()=>{
 assert.equal(run(`_clinicalVariantConflict('GI Biome','GI Biome Stress')`),true);
 assert.equal(run(`_clinicalVariantConflict('GI Biome Stress','GI Biome')`),true);
 assert.equal(run(`_clinicalVariantConflict('GI Biome Stress','GI Biome Stress')`),false);
});
test('2 cat Ziwi and dog Ziwi remain distinct',()=>assert.equal(run(`_candidateIdentityEligible(candidate('지위픽 강아지 고등어 양고기 170g 1개'))`),false));
test('3 explicit 185g single wins across eligible scores',()=>{
 assert.equal(run(`(function(){var cs=[candidate('지위픽 캣 고등어 양고기 185g 6개',1),candidate('지위픽 캣 고등어 양고기 185g 1개',2)];cs[0].match_score=1;cs[1].match_score=.8;return _selectPackage(fixtureFeed,fixtureTarget,cs).candidate.product_id;})()`),2);
});
test('4 85g six pack selected before 24; total weight and unit calculation',()=>{
 assert.equal(run(`(function(){var f={type:'wet',제품명:'프로플랜 살몬 키튼 85g'};var cs=[candidate('프로플랜 캣 살몬 키튼 85g x 24',24),candidate('프로플랜 캣 살몬 키튼 85g x 6',6)];return _selectPackage(f,{species:'cat'},cs).candidate.product_id;})()`),6);
 assert.equal(run(`_calculateUnitPricePer100g(6000,{ok:true,unit_weight_g:85,pack_count:6})`),1176);
});
test('5 missing and weight-only alternatives block smallest bundle',()=>{
 for(const title of ['지위픽 캣 고등어 양고기','지위픽 캣 고등어 양고기 185g']) {
  context.title=title;
  assert.equal(run(`_selectPackage(fixtureFeed,fixtureTarget,[candidate('지위픽 캣 고등어 양고기 185g 6개'),candidate(title,2)]).candidate`),null);
 }
});
test('6 unknown brands are not matched; clear mismatch cannot use AI',()=>{
 assert.equal(run(`_calculateIdentityScore({brand:null,tokens:['가구'],flags:{}},{brand:null,tokens:['가구'],flags:{},raw_name:'가구'}).brand_status`),'unknown');
 assert.equal(run(`_calculateIdentityScore({brand:null,tokens:[],flags:{}},{brand:null,tokens:[],flags:{}}).brand_match`),false);
 assert.equal(run(`candidate('로얄캐닌 캣 고등어 양고기 185g 1개').brand_status`),'mismatched');
});
test('7 samples, repacks and gifts excluded',()=>{
 for(const w of ['샘플','소분','증정용']) {context.negative=w;assert.equal(run(`_candidateIdentityEligible(candidate('지위픽 캣 고등어 양고기 185g 1개 '+negative))`),false);}
});
test('8 bonus count 6+6 is 12 and 85g x6 is 510g',()=>{
 assert.equal(run(`_applyExplicitBonusPackaging([candidate('지위픽 캣 고등어 양고기 185g 6개 6+6')])[0].package_info.pack_count`),12);
 assert.equal(run(`_applyExplicitBonusPackaging([candidate('지위픽 캣 고등어 양고기 185g (6+6 행사)')])[0].package_info.pack_count`),12);
 assert.equal(run(`_parsePackageInfo('85g x 6개').unit_weight_g*_parsePackageInfo('85g x 6개').pack_count`),510);
});
test('9 model rate limit routes retryable without human queue',()=>{
 run(`_callGeminiPriceJudge=function(){throw Error('Gemini HTTP 429');};`);
 assert.equal(run(`_geminiResolveAmbiguousDecision(fixtureFeed,fixtureTarget,[candidate('지위픽 캣 고등어 양고기 185g 1개')],originalDecision).decision.outcome`),'retryable_error');
});
test('10 selling price alone never persists a normal price',()=>{
 assert.equal(run(`_finalizePriceDecision(fixtureFeed,fixtureTarget,[],{outcome:'accepted',best_candidate:candidate('지위픽 캣 고등어 양고기 185g 1개')}).outcome`),'insufficient_evidence');
 assert.throws(()=>run(`_upsertReferencePrice(fixtureFeed,fixtureTarget,candidate('지위픽 캣 고등어 양고기 185g 1개'))`),/blocked/);
});
test('11 official/importer reference remains protected',()=>{
 assert.equal(run(`_referenceWriteAction({id:'1',source_type:'brand_official'})`),'keep_higher_priority');
 assert.equal(run(`_referenceWriteAction({id:'2',source_type:'importer_official'})`),'keep_higher_priority');
});
test('12 repeated reference persistence uses atomic RPC and no PATCH',()=>{
 run(`var good=candidate('지위픽 캣 고등어 양고기 185g 1개');good.normal_price_evidence={id:'e',price_basis:'undiscounted_normal',verification_status:'verified',normal_price_krw:15000,product_id:'1',item_id:'2',vendor_item_id:'3',title_hash:_sha256Hex(good.product_name),unit_weight_g:185,pack_count:1,source_url:good.product_url,verification_source:'manual_coupang_detail',verified_at:new Date(Date.now()-1000).toISOString(),valid_until:new Date(Date.now()+100000).toISOString()};
 var references=0;_supabaseRest=function(method,table,query,payload){dbCalls.push({method:method,table:table});if(table==='rpc/proved_insert_coupang_reference'){references++;return [{action:references===1?'inserted':'kept_existing_collection_phase',id:'r'}];}return [];};`);
 assert.equal(run(`_upsertReferencePrice(fixtureFeed,fixtureTarget,good).action`),'inserted');
 assert.equal(run(`_upsertReferencePrice(fixtureFeed,fixtureTarget,good).action`),'kept_existing_collection_phase');
 assert.equal(run(`dbCalls.some(function(c){return c.method==='patch'&&c.table==='food_reference_prices';})`),false);
 run(`_supabaseRest=function(){return [];};`);
});
test('model considers all identical options; code chooses single',()=>{
 run(`_callGeminiPriceJudge=function(input){return judgments(input.candidates);};`);
 assert.equal(run(`_geminiResolveAmbiguousDecision(fixtureFeed,fixtureTarget,[candidate('지위픽 캣 고등어 양고기 185g 6개'),candidate('지위픽 캣 고등어 양고기 185g 1개',9)],originalDecision).decision.best_candidate.product_id`),9);
});
test('model cannot hide unknown competing option',()=>{
 run(`_callGeminiPriceJudge=function(input){var r=judgments(input.candidates.map(function(c){return {product_id:c.candidate_id.split('|')[0],item_id:'2',vendor_item_id:'3'};}));r.candidates[1].identity='unknown';return r;};`);
 assert.equal(run(`_geminiResolveAmbiguousDecision(fixtureFeed,fixtureTarget,[candidate('지위픽 캣 고등어 양고기 185g 6개'),candidate('지위픽 캣 고등어 양고기',9)],originalDecision).decision.outcome`),'review_required');
});
test('hallucinated ID and coercible confidence rejected',()=>{
 run(`var cs=[candidate('지위픽 캣 고등어 양고기 185g 1개')];var jr=judgments(cs);jr.candidates[0].candidate_id='invented';`);
 assert.throws(()=>run(`_validateGeminiJudgments(jr,cs)`),/schema_error/);
 run(`jr=judgments(cs);jr.candidates[0].confidence='0.99';`);
 assert.throws(()=>run(`_validateGeminiJudgments(jr,cs)`),/schema_error/);
});
test('schema rejects omitted/duplicate entries and invented package',()=>{
 assert.throws(()=>run(`_validateGeminiJudgments({candidates:[]},cs)`),/schema_error/);
 run(`jr=judgments(cs);jr.candidates[0].unit_weight_g=85;jr.candidates[0].pack_count=24;jr.candidates[0].package_evidence='185g 1개';`);
 assert.throws(()=>run(`_validateGeminiJudgments(jr,cs)`),/schema_error/);
});
test('unknown alias can receive semantic identity review',()=>{
 run(`var uc=candidate('미등록브랜드 캣 고등어 양고기 185g 1개');uc.brand_status='unknown';uc.brand_match=false;
 _callGeminiPriceJudge=function(input){return {candidates:input.candidates.map(function(c){var j=judgments([{product_id:c.candidate_id.split('|')[0],item_id:'2',vendor_item_id:'3'}]).candidates[0];j.candidate_id=c.candidate_id;return j;})};};`);
 assert.equal(run(`_geminiResolveAmbiguousDecision(fixtureFeed,fixtureTarget,[uc],originalDecision).decision.outcome`),'accepted');
});
test('all explicit hard blocks survive high-confidence model',()=>{
 for(const flag of ['hard_negative','species_conflict','variant_conflict','flavor_conflict','life_stage_conflict']){
  context.flag=flag;assert.equal(run(`(function(){var c=candidate('지위픽 캣 고등어 양고기 185g 1개');c[flag]=true;return _geminiResolveAmbiguousDecision(fixtureFeed,fixtureTarget,[c],originalDecision).decision.outcome;})()`),'review_required');
 }
});
test('unknown package never becomes a single, including dry',()=>{
 assert.equal(run(`_packageIsProven(candidate('지위픽 캣 고등어 양고기 185g'))`),false);
 assert.equal(run(`_selectPackage({type:'dry',제품명:'사료'},{},[candidate('사료 2kg')]).candidate`),null);
});
test('dry policy prefers 1-2kg then nearest under 5kg',()=>{
 assert.equal(run(`_selectPackage({type:'dry',제품명:'사료'},{},[candidate('사료 3kg 1개',3),candidate('사료 1.5kg 1개',15)]).candidate.product_id`),15);
 assert.equal(run(`_selectPackage({type:'dry',제품명:'사료'},{},[candidate('사료 3kg 1개',3),candidate('사료 4kg 1개',4)]).candidate.product_id`),3);
});
test('multi-weight ambiguity and metadata bonus conflict route to human',()=>{
 assert.equal(run(`_parsePackageInfo('2kg 1개 + 100g 증정').ok`),false);
 assert.equal(run(`_finalizePriceDecision(fixtureFeed,fixtureTarget,[Object.assign(candidate('지위픽 캣 고등어 양고기 185g 1개'),{package_info:{parse_method:'conflicting_weights'}})],originalDecision).outcome`),'manual_review');
 assert.equal(run(`_applyExplicitBonusPackaging([{product_name:'185g 6+6',package_info:{ok:true,unit_weight_g:185,pack_count:6,parse_method:'permanent_option_metadata'}}])[0].package_info.ok`),false);
});
test('cached insufficient evidence skips model but changed title re-runs',()=>{
 run(`var cc=[candidate('지위픽 캣 고등어 양고기 185g 6개')],calls=0;
 _supabaseRest=function(){return [{fingerprint:_priceFingerprint(fixtureFeed,fixtureTarget,cc),outcome:'insufficient_evidence',reason:'abstained',audit:{model:'gemini-3-flash-preview'}}];};
 _callGeminiPriceJudge=function(){calls++;return judgments(cc);};`);
 assert.equal(run(`_geminiResolveAmbiguousDecision(fixtureFeed,fixtureTarget,cc,originalDecision).audit.calls`),0);
 assert.equal(run(`calls`),0);
 run(`_supabaseRest=function(){return [];};`);
});
test('normal evidence tied to exact seller, title, pack, expiry',()=>{
 assert.equal(run(`_normalPriceIsProven(good)`),true);
 for(const field of ['vendor_item_id','title_hash','pack_count','valid_until']){
  context.field=field;assert.equal(run(`(function(){var c=Object.assign({},good,{normal_price_evidence:Object.assign({},good.normal_price_evidence)});c.normal_price_evidence[field]='wrong';return _normalPriceIsProven(c);})()`),false);
 }
});
test('partial search failure routes retry rather than choosing incomplete results',()=>{
 assert.equal(run(`_finalizePriceDecision(fixtureFeed,fixtureTarget,[],_decideCandidateV53(fixtureFeed,fixtureTarget,[],[{ok:true},{ok:false}],[])).outcome`),'retryable_error');
});
test('GAS timeout and format errors do not enter human queue',()=>{
 run(`_callGeminiPriceJudge=function(){throw Error('Gemini format_error');};`);
 assert.equal(run(`_geminiResolveAmbiguousDecision(fixtureFeed,fixtureTarget,[candidate('지위픽 캣 고등어 양고기 185g 1개')],originalDecision).audit.status`),'response_format_error');
});
test('reprocess advances after a durably queued product failure',()=>{
 run(`_supabaseRest=function(method,table){return table==='food_price_review_queue'?[{id:'r1',species:'cat',feed_id:fixtureFeed.id}]:[];};
 var actualRun=_runCoupangPricePipeline;
 _runCoupangPricePipeline=function(){return [{decision:{outcome:'retryable_error',reason:'HTTP 503'},gemini:{calls:1}}];};`);
 const r=context.reprocessCoupangOpenReviewsWithGemini(1);
 assert.equal(r.retryable_error,1);assert.equal(r.gemini_calls,1);assert.equal(properties.COUPANG_GEMINI_REVIEW_CURSOR,'r1');
 delete properties.COUPANG_GEMINI_REVIEW_CURSOR;
 run(`_runCoupangPricePipeline=actualRun;_supabaseRest=function(){return [];};`);
});
test('reprocess deduplicates feed and records before/after',()=>{
 run(`_supabaseRest=function(method,table){return table==='food_price_review_queue'?[{id:'r1',species:'cat',feed_id:fixtureFeed.id},{id:'r2',species:'cat',feed_id:fixtureFeed.id}]:[];};
 var rc=0;_runCoupangPricePipeline=function(){rc++;return [{decision:{outcome:'insufficient_evidence',reason:'normal_price_not_verified'},gemini:{calls:1}}];};`);
 const r=context.reprocessCoupangOpenReviewsWithGemini(2);
 assert.equal(run(`rc`),1);assert.equal(r.processed,1);assert.equal(r.gemini_calls,1);assert.equal(r.results.length,2);assert.equal(properties.COUPANG_GEMINI_REVIEW_CURSOR,'r2');
 run(`_runCoupangPricePipeline=actualRun;_supabaseRest=function(){return [];};`);
});
test('cached semantic identity is reapplied when normal evidence becomes available',()=>{
 run(`var sc=[candidate('지위픽 캣 고등어 양고기 185g 6개')];
 _supabaseRest=function(){return [{fingerprint:_priceFingerprint(fixtureFeed,fixtureTarget,sc),outcome:'insufficient_evidence',reason:'normal_price_not_verified',audit:{model:'gemini-3-flash-preview',judgments:judgments(sc).candidates}}];};
 _callGeminiPriceJudge=function(){throw Error('Should reuse cached judgments');};`);
 const r=run(`_geminiResolveAmbiguousDecision(fixtureFeed,fixtureTarget,sc,originalDecision)`);
 assert.equal(r.audit.calls,0);assert.equal(r.audit.cache_hit,true);assert.equal(r.decision.outcome,'accepted');
 run(`_supabaseRest=function(){return [];};`);
});
test('competing verified normal prices route manual review',()=>{
 run(`_supabaseRest=function(){return [Object.assign({},good.normal_price_evidence),Object.assign({},good.normal_price_evidence,{id:'other',normal_price_krw:19000})];};`);
 assert.equal(run(`_finalizePriceDecision(fixtureFeed,fixtureTarget,[good],{outcome:'accepted',best_candidate:good}).outcome`),'manual_review');
 run(`_supabaseRest=function(){return [];};`);
});
test('irrelevant conflicting package does not create a human review item',()=>{
 assert.equal(run(`_finalizePriceDecision(fixtureFeed,fixtureTarget,[Object.assign(candidate('로얄캐닌 강아지 다른제품 2kg 1개'),{package_info:{parse_method:'conflicting_weights'}})],originalDecision).outcome`),'insufficient_evidence');
});
test('whole write path accepts proven normal price through RPC only',()=>{
 run(`var oldFeed=_getPriceFeedRecord,oldSearch=_searchCoupangCandidatesV53,oldMetadata=_applyPermanentOptionMetadata;
 _getPriceFeedRecord=function(){return fixtureFeed;};
 _searchCoupangCandidatesV53=function(){return {products:[{productId:1,productName:good.product_name,productPrice:10000,productUrl:'https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3'}],searches:[{ok:true}]};};
 _applyPermanentOptionMetadata=function(cs){return {candidates:cs,metadata_hits:[]};};
 dbCalls=[];_supabaseRest=function(method,table,query,payload){dbCalls.push({method:method,table:table,payload:payload});
 if(table==='proved_coupang_normal_price_evidence')return [good.normal_price_evidence];
 if(table==='rpc/proved_insert_coupang_reference')return [{action:'inserted',id:'r'}];return [];};
 _callGeminiPriceJudge=function(){throw Error('Rules must skip Gemini');};`);
 const r=run(`_runCoupangPricePipeline([fixtureTarget],true)[0]`);
 assert.equal(r.decision.outcome,'accepted');assert.equal(r.reference_price.action,'inserted');
 assert.equal(r.decision.best_candidate.product_price,15000);
 assert.equal(run(`dbCalls.filter(function(c){return c.method==='post' && c.table==='rpc/proved_insert_coupang_reference';}).length`),1);
 assert.equal(run(`dbCalls.filter(function(c){return c.table==='rpc/proved_save_coupang_job';})[0].payload.p_job.outcome`),'accepted');
});
test('whole write path queues missing normal price as evidence only',()=>{
 run(`dbCalls=[];_supabaseRest=function(method,table,query,payload){dbCalls.push({method:method,table:table,payload:payload});return [];};`);
 const r=run(`_runCoupangPricePipeline([fixtureTarget],true)[0]`);
 assert.equal(r.decision.outcome,'insufficient_evidence');assert.equal(r.reference_price,null);
 assert.equal(run(`dbCalls.some(function(c){return c.method!=='get'&&c.table==='food_price_review_queue';})`),false);
 assert.equal(run(`dbCalls.some(function(c){return c.table==='rpc/proved_insert_coupang_reference';})`),false);
});
test('write failure is persisted for operational retry',()=>{
 run(`dbCalls=[];_supabaseRest=function(method,table,query,payload){dbCalls.push({method:method,table:table,payload:payload});
 if(table==='proved_coupang_normal_price_evidence')return [good.normal_price_evidence];
 if(table==='rpc/proved_insert_coupang_reference')throw Error('DB unavailable');return [];};`);
 const r=run(`_runCoupangPricePipeline([fixtureTarget],true)[0]`);
 assert.match(r.error,/DB unavailable/);
 assert.equal(run(`dbCalls.filter(function(c){return c.table==='rpc/proved_save_coupang_job';})[0].payload.p_job.outcome`),'retryable_error');
 run(`_getPriceFeedRecord=oldFeed;_searchCoupangCandidatesV53=oldSearch;_applyPermanentOptionMetadata=oldMetadata;_supabaseRest=function(){return [];};`);
});
test('Gemini request emits complete JSON schema and classifies HTTP/JSON failure',()=>{
 run(`_supabaseRest=function(method,table){return table==='rpc/proved_reserve_gemini_call'?{allowed:true,request_id:'test'}:{};};`);
 run(`var sent;UrlFetchApp.fetch=function(url,options){sent=JSON.parse(options.payload);return {getResponseCode:function(){return 200;},getContentText:function(){return JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({candidates:[]})}]}}]});}};};`);
 const r=run(`actualJudge({proved:{},candidates:[]})`);
 assert.equal(r.candidates.length,0);
 assert.equal(run(`sent.generationConfig.responseJsonSchema.properties.candidates.items.required.length`),14);
 run(`UrlFetchApp.fetch=function(){return {getResponseCode:function(){return 429;},getContentText:function(){return '';}};};`);
 assert.throws(()=>run(`actualJudge({})`),/HTTP 429/);
 run(`UrlFetchApp.fetch=function(){return {getResponseCode:function(){return 200;},getContentText:function(){return 'invalid';}};};`);
 assert.throws(()=>run(`actualJudge({})`),/format_error/);
});
const summary={total:reports.length,passed,failed:reports.length-passed,reports};
console.log(JSON.stringify(summary,null,2));if(summary.failed)process.exitCode=1;
