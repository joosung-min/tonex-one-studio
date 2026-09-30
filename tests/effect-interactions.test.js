import test from 'node:test';
import assert from 'node:assert/strict';
import {bindEffectInteractions} from '../src/effect-interactions.js';
function setup(){const button=new EventTarget(),calls=[];bindEffectInteractions(button,{select:()=>calls.push('select'),toggle:()=>calls.push('toggle')});return {calls,send(type,time,pointerType){const e=new Event(type);Object.defineProperty(e,'timeStamp',{value:time});if(pointerType)Object.defineProperty(e,'pointerType',{value:pointerType});button.dispatchEvent(e);}};}
test('mouse single clicks select, double click toggles exactly once',()=>{const h=setup();h.send('click',100);assert.deepEqual(h.calls,['select']);h.send('click',200);h.send('dblclick',200);assert.deepEqual(h.calls,['select','select','toggle']);});
test('touch double tap toggles once even if browser also emits dblclick',()=>{const h=setup();h.send('pointerup',100,'touch');h.send('click',100);h.send('pointerup',250,'touch');h.send('click',250);h.send('dblclick',250);assert.equal(h.calls.filter(x=>x==='toggle').length,1);h.send('pointerup',400,'touch');h.send('pointerup',550,'touch');assert.equal(h.calls.filter(x=>x==='toggle').length,2);});
test('slow taps and cancelled gestures do not toggle',()=>{const h=setup();h.send('pointerup',100,'touch');h.send('pointerup',600,'touch');h.send('pointercancel',650);h.send('pointerup',700,'touch');assert.deepEqual(h.calls,[]);});
test('mouse pointerup does not perform a second toggle',()=>{const h=setup();h.send('pointerup',100,'mouse');h.send('pointerup',200,'mouse');h.send('dblclick',200);assert.deepEqual(h.calls,['toggle']);});
