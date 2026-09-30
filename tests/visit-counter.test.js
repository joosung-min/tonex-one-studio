import test from 'node:test';
import assert from 'node:assert/strict';
import {isCounterSite,showVisitCounter,COUNTER_URL} from '../src/visit-counter.js';
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};};
const response=(up=1234,down=1)=>({ok:true,json:async()=>({data:{up_count:up,down_count:down}})});
test('increment once per session and read on reload without credentials or HTTP cache',async()=>{
 const requests=[],store=storage(),element={};
 const fetchImpl=async(url,options)=>{requests.push({url:new URL(url),options});return response();};
 await showVisitCounter(element,{storage:store,fetchImpl});
 assert.equal(element.hidden,false);assert.equal(element.textContent,`Visits: ${(1233).toLocaleString()}`);
 await showVisitCounter(element,{storage:store,fetchImpl});
 assert.equal(requests[0].url.pathname,new URL(COUNTER_URL).pathname+'/up');
 assert.equal(requests[1].url.pathname,new URL(COUNTER_URL).pathname);
 for(const {url,options} of requests){assert.ok(url.searchParams.has('_'));assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.headers,undefined);}
});
test('failed increment is not retried in the same session',async()=>{
 const requests=[],store=storage(),element={};
 const fetchImpl=async url=>{requests.push(url);throw new Error('offline');};
 await showVisitCounter(element,{storage:store,fetchImpl});assert.equal(element.hidden,true);
 await showVisitCounter(element,{storage:store,fetchImpl});
 assert.equal(new URL(requests[1]).pathname,new URL(COUNTER_URL).pathname);
});
test('invalid totals and HTTP failures keep the optional counter hidden',async()=>{
 for(const result of [response(NaN),response('12'),response(1,2),{ok:false,json:()=>{throw Error('unexpected');}}]){
 const element={};await showVisitCounter(element,{fetchImpl:async()=>result});assert.equal(element.hidden,true);
 }
});
test('timeout cancels request and restricted storage cannot break the editor',async()=>{
 const element={},store={getItem:()=>{throw Error('blocked');}};
 await showVisitCounter(element,{storage:store,timeoutMs:5,fetchImpl:(_,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 assert.equal(element.hidden,true);
 await showVisitCounter(element,{storage:store,fetchImpl:async()=>response(0,0)});assert.equal(element.textContent,'Visits: 0');
});
test('only the published site counts visits',()=>{
 for(const url of ['https://yvr-vibe.github.io/tonex-one-studio/','https://yvr-vibe.github.io/tonex-one-studio/index.html'])assert.equal(isCounterSite(new URL(url)),true);
 for(const url of ['http://localhost:5173/','https://yvr-vibe.github.io/other/','https://another.github.io/tonex-one-studio/'])assert.equal(isCounterSite(new URL(url)),false);
});
