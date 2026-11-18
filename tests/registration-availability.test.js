const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/feed-registration.js'), 'utf8');
const id = '00000000-0000-4000-8000-000000000001';

function fixture(row, error = null) {
  const storage = new Map(), nodes = new Map(), timers = [], redirects = [];
  const document = {addEventListener(){}, getElementById(key){
    if (!nodes.has(key)) nodes.set(key,{textContent:'',hidden:false,classList:{add(){},remove(){}},scrollIntoView(){}});
    return nodes.get(key);
  }};
  const query = {select(){return this},eq(){return this},maybeSingle(){return {data:row,error}}};
  const window = {location:{hostname:'localhost',origin:'https://proved.kr',replace:url=>redirects.push(url)},
    addEventListener(){},clearTimeout(){},setTimeout(fn,delay){timers.push({fn,delay});return timers.length}};
  const sessionStorage = {setItem:(key,value)=>storage.set(key,value),getItem:key=>storage.get(key)||null,removeItem:key=>storage.delete(key)};
  const c = vm.createContext({document,window,sessionStorage,console,supabase:{createClient:()=>({from:()=>query})}});
  vm.runInContext(source,c);
  vm.runInContext("registrationState.type='dry';registrationState.returnTo='/cat-food-calculator/'",c);
  return {c,storage,nodes,timers,redirects};
}

test('registration calls the newly deployed web app',()=>{
  const f=fixture(null);
  assert.equal(vm.runInContext('APPS_SCRIPT_URL',f.c),
    'https://script.google.com/macros/s/AKfycbxYQE9j1b9TKlzmHVxoA6IpEWGB-IJKHWJzySN-49unHCJhp_QsHYOsWq0ZhW6swIqg/exec');
});

test('a product detected as wet returns to the wet slot even when requested as dry',async()=>{
  const f=fixture({id,type:'wet',final_me:873,verified:false,searchable_before_review:true});
  const result={등록ID:id,테이블:'feeds'};
  assert.equal(await f.c.isRegisteredFeedCalculable(result),true);
  f.c.showReturnNotice({result,searchable:true});
  assert.equal(JSON.parse([...f.storage.values()][0]).type,'wet');
  assert.equal(f.timers.length,1);
  assert.equal(f.timers[0].delay,3000);
  f.timers[0].fn();
  assert.deepEqual(f.redirects,['/cat-food-calculator/']);
});

test('missing calories have one explanation and a working manual return, without selecting an unusable feed',async()=>{
  const f=fixture({id,type:'wet',final_me:null,verified:false,searchable_before_review:false});
  const result={등록ID:id};
  assert.equal(await f.c.isRegisteredFeedCalculable(result),false);
  const explanation=f.c.getRegistrationPendingMessage(result);
  assert.match(explanation,/표시 열량/);
  f.c.showReturnNotice({result,searchable:false});
  assert.notEqual(f.nodes.get('registrationReturnMessage').textContent,explanation);
  assert.equal(f.nodes.get('registrationReturnButton').hidden,false);
  assert.equal(f.storage.size,0);
  assert.equal(f.timers.length,0);
  f.nodes.get('registrationReturnButton').onclick();
  assert.deepEqual(f.redirects,['/cat-food-calculator/']);
});

test('a DB lookup error is not reported as absent nutrition or successful calculation',async()=>{
  const f=fixture(null,{message:'fixture permission failure'});
  const result={등록ID:id};
  assert.equal(await f.c.isRegisteredFeedCalculable(result),false);
  assert.equal(result.calculation_unavailable_reason,'lookup_failed');
  assert.doesNotMatch(f.c.getRegistrationPendingMessage(result),/성분이 없어|관리자 검수 후/);
  assert.match(f.c.getRegistrationPendingMessage(result),/불러올 수 있는지 확인하지 못했습니다/);
});
