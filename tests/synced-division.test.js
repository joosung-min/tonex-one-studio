import test from 'node:test';
import assert from 'node:assert/strict';
import {writeSyncedDivision} from '../src/synced-division.js';
test('Sync settles before Division, then readback settles without rewriting on stale reads',async()=>{
 let time=0,syncAt=Infinity,divisionAt=Infinity,reads=0;const writes=[];
 const usb={writeParameter:async(i,v)=>{writes.push([i,v]);if(i===97)syncAt=time+100;else if(i===98){assert.ok(time>=syncAt);divisionAt=time+500;}},getPreset:async()=>{reads++;const parameters=[];parameters[97]=time>=syncAt?1:0;parameters[98]=time>=divisionAt?7:0;return {parameters};}};
 const detail=await writeSyncedDivision(usb,3,98,7,{wait:async ms=>time+=ms,writes:[[99,400]]});
 assert.deepEqual(writes,[[99,400],[97,1],[98,7]]);assert.equal(reads,2);assert.equal(detail.parameters[98],7);
});
test('persistent mismatch is reported after bounded reads',async()=>{
 let reads=0;const usb={writeParameter:async()=>{},getPreset:async()=>{reads++;return {parameters:[]};}};
 await assert.rejects(writeSyncedDivision(usb,0,67,10,{wait:async()=>{}}),/did not confirm/);assert.equal(reads,3);
});
test('a slot change during settling prevents the Division write',async()=>{
 let current=true;const writes=[];const usb={writeParameter:async(i,v)=>writes.push([i,v]),getPreset:async()=>{throw Error('must not read');}};
 await assert.rejects(writeSyncedDivision(usb,0,67,10,{isCurrent:()=>current,wait:async()=>{current=false;}}),/Preset changed/);assert.deepEqual(writes,[[66,1]]);
});

test('already-enabled Sync skips its write and settling delay but still confirms both values',async()=>{
 const writes=[],waits=[];let reads=0;
 const parameters=[];parameters[97]=1;parameters[98]=7;
 const usb={writeParameter:async(i,v)=>writes.push([i,v]),getPreset:async()=>{reads++;return {parameters};}};
 await writeSyncedDivision(usb,0,98,7,{syncEnabled:true,wait:async ms=>waits.push(ms)});
 assert.deepEqual(writes,[[98,7]]);assert.deepEqual(waits,[320]);assert.equal(reads,1);
});
