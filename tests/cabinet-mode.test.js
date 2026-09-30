import test from 'node:test';
import assert from 'node:assert/strict';
import {CabinetModes} from '../src/cabinet-mode.js';
test('cabinet toggle restores VIR and Tone Model modes independently per preset',()=>{
 const modes=new CabinetModes();assert.equal(modes.toggled(0,1),2);assert.equal(modes.toggled(1,0),2);
 assert.equal(modes.toggled(0,2),1);assert.equal(modes.toggled(1,2),0);
});
test('a cabinet initially off uses model mode; clearing discards a previous session',()=>{
 const modes=new CabinetModes();assert.equal(modes.toggled(0,2),0);modes.remember(0,1);modes.clear();assert.equal(modes.toggled(0,2),0);
});
test('off and unfamiliar values never replace the last enabled cabinet mode',()=>{
 const modes=new CabinetModes();modes.remember(4,1);modes.remember(4,2);modes.remember(4,99);assert.equal(modes.toggled(4,2),1);
});
