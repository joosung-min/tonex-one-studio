import test from 'node:test';
import assert from 'node:assert/strict';
import {presetDisplayColor} from '../src/preset-colors.js';
import {parseState} from '../src/protocol.js';
import {stateFixture} from './fixtures.js';
test('dim pedal palette codes become distinct visible colors without changing raw state',()=>{
 const state=parseState(stateFixture),before=state.colors.map(c=>Array.from(c));
 assert.equal(presetDisplayColor(state.colors[10]),'#7a3616');
 assert.equal(presetDisplayColor(state.colors[12]),'#05802d');
 assert.equal(presetDisplayColor(state.colors[0]),'#ffe12a');
 assert.deepEqual(state.colors.map(c=>Array.from(c)),before);
});
test('unknown RGB colors retain their values and invalid colors have a neutral fallback',()=>{
 assert.equal(presetDisplayColor([18,52,86]),'#123456');
 assert.equal(presetDisplayColor(new Uint8Array([0,0,0])),'#595959');
 for(const input of [null,[],[256,0,0],[-1,0,0],[1.5,0,0]])assert.equal(presetDisplayColor(input),'#595959');
});
