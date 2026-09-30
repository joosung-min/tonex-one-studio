import test from 'node:test';
import assert from 'node:assert/strict';
import {rhythmicDivisions,divisionButtons} from '../src/rhythmic-divisions.js';
import {parameters} from '../src/parameters.js';
test('rhythmic divisions preserve the reference controller wire order',()=>{
 assert.deepEqual(rhythmicDivisions.map(option=>option.value),Array.from({length:18},(_,i)=>i));
 assert.deepEqual(rhythmicDivisions.map(option=>option.label.split(' — ')[0]),[
  '1/32','1/32 dotted','1/32 triplet','1/16','1/16 dotted','1/16 triplet','1/8','1/8 dotted','1/8 triplet','1/4','1/4 dotted','1/4 triplet','1/2','1/2 dotted','1/2 triplet','1/1','1/1 dotted','1/1 triplet'
 ]);
});
test('every supported Mod and Delay division follows its matching Sync parameter',()=>{
 const divisions=parameters.filter(p=>p.id.endsWith('_TS'));assert.equal(divisions.length,7);
 for(const division of divisions){assert.equal(parameters[division.index-1].id,division.id.replace(/_TS$/,'_SYNC'));assert.equal(division.min,0);assert.equal(division.max,rhythmicDivisions.length-1);}
});

test('five Division shortcuts match their existing pedal wire values',()=>{
 assert.deepEqual(divisionButtons,[{label:'1/4D',value:10},{label:'1/4',value:9},{label:'1/8D',value:7},{label:'1/8',value:6},{label:'1/16',value:3}]);
 for(const option of divisionButtons)assert.equal(rhythmicDivisions[option.value].label.split(' — ')[0].replace(' dotted','D'),option.label);
});
