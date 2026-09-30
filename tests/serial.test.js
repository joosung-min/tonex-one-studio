import test from 'node:test';
import assert from 'node:assert/strict';
import {ToneXSerial,createPedalConnection} from '../src/serial.js';
import {ToneXUSB} from '../src/usb.js';
import {Device} from './mock-device.js';
import {readFileSync} from 'node:fs';
import {frame,bytes,FrameDecoder,requestState,hello} from '../src/protocol.js';
globalThis.isSecureContext=true;
class SerialPort {
  constructor(){this.device=new Device();this.openCount=0;this.closeCount=0;this.options=null;this.signals=null;this.readable=null;this.writable=null;}
  getInfo(){return {usbVendorId:0x1963,usbProductId:0xd1};}
  async open(options){
    this.options=options;this.openCount++;this.opened=true;
    this.readable=new ReadableStream({start:c=>this.controller=c});
    this.writable=new WritableStream({write:data=>this.device.transferOut(7,data)});
    this.device.respond=p=>{const chunk=frame(p);this.controller.enqueue(chunk.slice(0,3));this.controller.enqueue(chunk.slice(3));};
  }
  async setSignals(signals){this.signals=signals;}
  async close(){assert.equal(this.readable?.locked??false,false);assert.equal(this.writable?.locked??false,false);this.opened=false;this.closeCount++;this.readable=null;this.writable=null;}
}
class Serial extends EventTarget {
 constructor(port=new SerialPort()){super();this.port=port;this.filters=null;}
 async requestPort(options){this.filters=options;return this.port;}
 async getPorts(){return [this.port];}
}
test('desktop serial path opens a filtered USB port and uses the shared preset/parameter protocol',async()=>{
 const serial=new Serial(),connection=new ToneXSerial(serial);await connection.connect();
 assert.deepEqual(serial.filters,{filters:[{usbVendorId:0x1963,usbProductId:0xd1}]});
 assert.deepEqual(serial.port.options,{baudRate:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none',bufferSize:65536});
 assert.deepEqual(serial.port.signals,{dataTerminalReady:true,requestToSend:true});assert.equal(connection.connected,true);
 assert.equal((await connection.getPreset(0)).name,'Mock Clean');
 await connection.writeParameter(20,6.4);assert.ok(Math.abs((await connection.getPreset(0)).parameters[20]-6.4)<1e-5);
 const state=await connection.changeState({preset:12,slot:1});assert.equal(state.slots[1],12);assert.equal(state.activeSlot,1);
 assert.equal(connection.diagnostics().transport,'webserial');await connection.close();assert.equal(serial.port.closeCount,1);assert.equal(connection.connected,false);
});
test('serial disconnect releases streams and permits reconnection to an authorized port',async()=>{
 const serial=new Serial(),connection=new ToneXSerial(serial);await connection.connect();
 const closed=new Promise(resolve=>connection.addEventListener('connection',e=>{if(!e.detail.connected)resolve(e.detail);},{once:true}));
 const event=new Event('disconnect');Object.defineProperty(event,'port',{value:serial.port});serial.dispatchEvent(event);assert.equal((await closed).reason,'Pedal disconnected.');
 await connection.reconnect();assert.equal(connection.connected,true);assert.equal(serial.port.openCount,2);await connection.close();assert.equal(serial.port.closeCount,2);
});
test('fatal serial read errors close the port and reject the pending request',async()=>{
 const serial=new Serial(),connection=new ToneXSerial(serial);await connection.connect();
 const closed=new Promise(resolve=>connection.addEventListener('connection',e=>{if(!e.detail.connected)resolve(e.detail);},{once:true}));
 connection.send=async()=>{};const request=connection.exchange(bytes(1),0x0306);const rejected=assert.rejects(request,/Cable removed/);
 serial.port.controller.error(Error('Cable removed'));await rejected;assert.equal((await closed).reason,'Cable removed');assert.equal(serial.port.closeCount,1);
});
test('signal setup failure releases the opened port and gives Mac troubleshooting instructions',async()=>{
 const serial=new Serial();serial.port.setSignals=async()=>{throw Error('Signal setup failed');};const connection=new ToneXSerial(serial);
 await assert.rejects(connection.connect(),/Close TONEX Editor/);assert.equal(serial.port.closeCount,1);assert.equal(connection.connected,false);assert.equal(connection.writer,null);
});
test('unexpected device IDs and absent authorized ports are rejected',async()=>{
 const serial=new Serial();serial.port.getInfo=()=>({usbVendorId:1,usbProductId:2});const connection=new ToneXSerial(serial);
 await assert.rejects(connection.connect(),/not a ToneX One/);assert.equal(serial.port.openCount,0);await assert.rejects(connection.reconnect(),/No authorized/);
});
test('desktop uses Web Serial; Android keeps WebUSB even when Bluetooth serial is exposed',()=>{
 const serial=new Serial(),usb=new EventTarget();
 const mac=createPedalConnection({userAgent:'Mozilla Macintosh Chrome',serial,usb});assert.ok(mac instanceof ToneXSerial);assert.equal(mac.supported,true);
 const android=createPedalConnection({userAgent:'Mozilla Android Chrome',serial,usb});assert.ok(android instanceof ToneXUSB);assert.equal(android.transport,'webusb');
 assert.equal(createPedalConnection({userAgent:'Mac Safari'}).supported,false);
});

test('real pedal state connects with canonical request despite ignored hello and silent wake, including reconnect',async()=>{
 const serial=new Serial();serial.port.device=new Device({acknowledgeWake:false,ignoreShortHello:true});
 let capturedState;
 new FrameDecoder(p=>capturedState=p).push(Uint8Array.from(readFileSync(new URL('./hardware-state.hex',import.meta.url),'utf8').trim().split(' ').map(b=>parseInt(b,16))));
 serial.port.device.state=capturedState;
 const connection=new ToneXSerial(serial);
 for(let attempt=0;attempt<2;attempt++) {
  await connection.connect();assert.equal(connection.connected,true);
  assert.deepEqual(connection.state.slots,[13,7,16]);assert.equal(connection.state.activeSlot,1);
  assert.equal(connection.state.inputTrim,15);assert.equal(connection.state.tempo,44);
  assert.ok(serial.port.device.writes.some(p=>Buffer.from(p).equals(Buffer.from(requestState()))));
  assert.equal(serial.port.device.writes.some(p=>Buffer.from(p).equals(Buffer.from(hello()))),false);
  await connection.close();
 }
});
test('invalid state layout surfaces its specific error instead of retrying as a cable timeout',async()=>{
 const serial=new Serial();serial.port.device.state=bytes([0xb9,3,0x81,6,3]);const connection=new ToneXSerial(serial);
 await assert.rejects(connection.connect(),/Unsupported state header/);
 assert.equal(connection.entries.filter(e=>e.message.startsWith('Handshake')).length,1);
 assert.equal(serial.port.closeCount,1);
});
