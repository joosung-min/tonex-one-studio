import test from 'node:test';
import assert from 'node:assert/strict';
import {bytes,crc16,frame,FrameDecoder,requestPreset,setParameter,parseParameter,parsePreset,parseState,mutateState,floatBytes,hex} from '../src/protocol.js';
const fromHex=s=>Uint8Array.from(s.trim().split(/\s+/).map(v=>parseInt(v,16)));
import {stateFixture} from './fixtures.js';
test('CRC-16/X-25 matches standard check vector',()=>assert.equal(crc16(new TextEncoder().encode('123456789')),0x906e));
test('preset request matches captured official command including CRC',()=>assert.equal(hex(frame(requestPreset(12))),'7e b9 03 81 00 03 82 06 00 80 0b 03 b9 04 0b 01 0c 00 68 8e 7e'));
test('stream decoder handles escaped bytes and every split boundary',()=>{
 const payload=bytes([1,0x7e,0x7d,0,255]),encoded=frame(payload);
 for(let split=0;split<=encoded.length;split++){const out=[];const decoder=new FrameDecoder(p=>out.push(p));decoder.push(encoded.slice(0,split));decoder.push(encoded.slice(split));assert.deepEqual(out,[payload]);}
});
test('decoder accepts multiple frames, shared flags and leading noise',()=>{const out=[];const d=new FrameDecoder(p=>out.push(p));d.push(bytes([0,1,0x7e],frame(bytes(1)),frame(bytes(2)).slice(1),frame(bytes(3))));assert.deepEqual(out.map(p=>p[0]),[1,2,3]);});
test('corrupt CRC is rejected and the next frame recovers',()=>{const out=[],errors=[];const bad=frame(bytes(1,2,3));bad[2]^=1;const d=new FrameDecoder(p=>out.push(p),e=>errors.push(e));d.push(bytes(bad,frame(bytes(4))));assert.equal(errors.length,1);assert.deepEqual(out,[bytes(4)]);});
test('parameter command matches captured volume payload',()=>assert.equal(hex(setParameter(21,8.2)),'b9 03 81 09 03 82 0a 00 80 0b 03 b9 04 02 00 15 88 33 33 03 41'));
test('physical knob notification is decoded independently of header size',()=>{const p=fromHex('B9 03 81 09 03 0A 02 B9 04 02 00 15 88 33 33 03 41');const value=parseParameter(p);assert.equal(value.index,21);assert.ok(Math.abs(value.value-8.2)<1e-5);assert.equal(parseParameter(p.slice(0,-1)),null);});
test('preset name permits NUL padding and ignores trailing metadata',()=>{const name=bytes(new TextEncoder().encode('British Clean'),new Uint8Array(19),20);const p=bytes([0xb9,3,0x81,4,3,0x80,1,2,0xbc,33],name,[0xba,3,0xba,109],Array.from({length:109},(_,i)=>[0x88,...floatBytes(i)]).flat());const detail=parsePreset(p);assert.equal(detail.name,'British Clean');assert.equal(detail.parameters.length,109);assert.equal(detail.parameters[108],108);});
test('real FX-era state parses colors, mode, slots and raw data',()=>{const s=parseState(stateFixture);assert.deepEqual(s.slots,[3,10,11]);assert.equal(s.activeSlot,0);assert.equal(s.inputTrim,4);assert.equal(s.colors.length,20);assert.deepEqual(s.colors[0],[159,255,0]);assert.deepEqual(s.raw,stateFixture);});
test('preset load preserves all state bytes except deliberate slot/mode/bypass/monitor fields',()=>{
 const s=parseState(stateFixture),command=mutateState(s,{preset:7,slot:2}),body=command.slice(11),original=s.raw.slice(8);
 const changed=new Set([s.slotOffsets[2]-8,s.slotOffsets[2]+1-8,s.activeOffset-8,s.modeOffset-8,s.bypassOffset-8,s.monitorOffset-8]);
 for(let i=0;i<body.length;i++)if(!changed.has(i))assert.equal(body[i],original[i],`byte ${i}`);
 assert.equal(body[s.slotOffsets[2]-8],7);assert.equal(body[s.activeOffset-8],2);assert.equal(body[s.modeOffset-8],1);assert.deepEqual(s.raw,stateFixture);assert.equal(command[6]|command[7]<<8,body.length);
});
test('unknown or truncated state layouts fail closed',()=>{assert.throws(()=>parseState(stateFixture.slice(0,-1)));assert.throws(()=>parseState(bytes(stateFixture,0)));const p=stateFixture.slice();p[22]=0;assert.throws(()=>parseState(p));});
test('invalid command inputs cannot produce USB writes',()=>{assert.throws(()=>requestPreset(20));assert.throws(()=>setParameter(21,NaN));assert.throws(()=>mutateState(parseState(stateFixture),{preset:20,slot:0}));});
