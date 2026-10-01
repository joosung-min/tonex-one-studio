import {bytes,frame,FrameDecoder,messageType,floatBytes,parseState} from '../src/protocol.js';
import {parameters} from '../src/parameters.js';
import {stateFixture} from './fixtures.js';
export class Device {
 constructor({acknowledgeWake=true,ignoreShortHello=false}={}){
  this.acknowledgeWake=acknowledgeWake;this.ignoreShortHello=ignoreShortHello;
  this.vendorId=0x1963;this.productId=0xd1;this.productName='Mock ToneX One';this.serialNumber='TEST';this.opened=false;this.writes=[];this.controlWrites=[];this.incoming=[];this.waiting=null;this.state=stateFixture.slice();this.values=parameters.map(p=>p.default);this.masterVolume=6.5;
  const ctrl={alternateSetting:0,interfaceClass:2,interfaceSubclass:2,endpoints:[]},data={alternateSetting:0,interfaceClass:10,endpoints:[{direction:'in',type:'bulk',endpointNumber:7},{direction:'out',type:'bulk',endpointNumber:7}]};
  this.configuration={configurationValue:1,interfaces:[{interfaceNumber:0,alternate:ctrl,alternates:[ctrl]},{interfaceNumber:1,alternate:data,alternates:[data]}]};this.configurations=[this.configuration];
 }
 async open(){this.opened=true;}
 async close(){this.opened=false;if(this.waiting){this.waiting.reject(Error('closed'));this.waiting=null;}}
 async claimInterface(){}
 async controlTransferOut(setup,data){this.controlWrites.push({setup,data});return {status:'ok'};}
 respond(payload){const result={status:'ok',data:new DataView(frame(payload).buffer)};if(this.waiting){const w=this.waiting;this.waiting=null;w.resolve(result);}else this.incoming.push(result);}
 transferIn(){if(this.incoming.length)return Promise.resolve(this.incoming.shift());return new Promise((resolve,reject)=>this.waiting={resolve,reject});}
 async transferOut(endpoint,data){
  new FrameDecoder(p=>{
   this.writes.push(p);const type=messageType(p);
   if(type===0x0b2b||p[2]===0&&p[7]===0x0b&&p[8]===1){if(this.acknowledgeWake)this.respond(bytes([0xb9,3,2,0x2b,0x0b,0xb9,7,0,0x80,0xc7,0xb9,3,2,0,0,0xb9,3,1,2,3]));}
   else if(type===3&&this.ignoreShortHello)return;
   else if(type===3||type===0x0306||p[2]===0){if(type===0x0306){this.state=bytes(stateFixture.slice(0,8),p.slice(11));const state=parseState(this.state);if(!state.stomp)this.state[state.bypassOffset]=0;}this.respond(this.state);}
   else if(type===0x0300){const name=bytes(new TextEncoder().encode('Mock Clean'),new Uint8Array(22),20);this.respond(bytes([0xb9,3,0x81,4,3,0x80,0,2,0xbc,33],name,[0xba,3,0xba,109],this.values.flatMap(v=>[0x88,...floatBytes(v)])));}
   else if(type===0x030d){this.respond(bytes([0xb9,3,0x81,9,3,10,2,0xb9,4,3,0,0,0x88],floatBytes(this.masterVolume)));}
   else if(type===0x0309&&p[13]===3){this.masterVolume=new DataView(p.buffer,p.byteOffset+17,4).getFloat32(0,true);this.respond(p);}
   else if(type===0x0309){const dv=new DataView(p.buffer,p.byteOffset+17,4);this.values[p[15]]=dv.getFloat32(0,true);this.respond(p);}
  }).push(data);
  return {status:'ok',bytesWritten:data.length};
 }
}
