import {VID,PID,FrameDecoder,frame,hex,messageType,wake,requestState,requestPreset,setParameter,parseState,parsePreset,parseParameter,mutateState} from './protocol.js';
export const delay = ms => new Promise(r => setTimeout(r,ms));
export class ResponseTimeoutError extends Error {
  constructor(type,timeout) { super(`No response to 0x${type.toString(16)} within ${timeout} ms.`); this.name='ResponseTimeoutError'; }
}
export class ToneXUSB extends EventTarget {
  constructor(usb = globalThis.navigator?.usb) {
    super(); this.transport='webusb'; this.usb=usb; this.queue=Promise.resolve(); this.pending=null; this.device=null; this.state=null; this.entries=[]; this.connected=false; this.generation=0;
    usb?.addEventListener('disconnect',e=>{if(e.device===this.device) void this.close('Pedal disconnected.');});
  }
  emit(type,detail) { this.dispatchEvent(new CustomEvent(type,{detail})); }
  log(direction,message,data) { const entry={time:new Date().toISOString(),direction,message,...(data?{hex:hex(data)}:{})}; this.entries.push(entry); if(this.entries.length>500)this.entries.shift(); this.emit('log',entry); }
  enqueue(fn) { const next=this.queue.then(fn); this.queue=next.catch(()=>{}); return next; }
  get supported() { return !!this.usb; }
  async reconnect() {
    if(!this.supported)throw Error('WebUSB is unavailable in this browser.');
    const devices=await this.usb.getDevices(),device=devices.find(d=>d.vendorId===VID&&d.productId===PID);
    if(!device)throw Error('No authorized ToneX One is connected. Use Connect pedal.');
    return this.open(device);
  }
  async connect() {
    if (!globalThis.isSecureContext) throw Error('USB requires HTTPS. Open this tool at an HTTPS address on your phone.');
    if (!this.usb) throw Error('WebUSB is unavailable. Use Chrome on an Android phone with USB OTG support.');
    // Request permission synchronously from the button's click gesture.
    const selected=await this.usb.requestDevice({filters:[{vendorId:VID,productId:PID}]});
    return this.open(selected);
  }
  async open(device) {
    await this.close(); this.device=device; const token=++this.generation;
    try {
      await device.open(); if(!device.configuration) await device.selectConfiguration(device.configurations[0].configurationValue);
      const interfaces=device.configuration.interfaces;
      this.descriptors={vendorId:device.vendorId,productId:device.productId,productName:device.productName,serialNumber:device.serialNumber,configuration:device.configuration.configurationValue,interfaces:interfaces.map(i=>({number:i.interfaceNumber,alternates:i.alternates.map(a=>({setting:a.alternateSetting,class:a.interfaceClass,subclass:a.interfaceSubclass,endpoints:a.endpoints}))}))};
      this.log('info','USB descriptors recorded.');
      const control=interfaces.find(i=>i.alternates.some(a=>a.interfaceClass===2&&a.interfaceSubclass===2));
      const data=interfaces.find(i=>i.alternates.some(a=>a.interfaceClass===10&&a.endpoints.some(e=>e.direction==='in'&&e.type==='bulk')&&a.endpoints.some(e=>e.direction==='out'&&e.type==='bulk')));
      if(!control||!data) throw Error('CDC control/data interfaces were not found. Export diagnostics.');
      this.controlNumber=control.interfaceNumber;
      for(const [iface,cls] of [[control,2],[data,10]]) {
        await device.claimInterface(iface.interfaceNumber);
        const alt=iface.alternates.find(a=>a.interfaceClass===cls);
        if(iface.alternate.alternateSetting!==alt.alternateSetting)await device.selectAlternateInterface(iface.interfaceNumber,alt.alternateSetting);
      }
      const alt=data.alternates.find(a=>a.interfaceClass===10&&a.endpoints.some(e=>e.direction==='in'&&e.type==='bulk'));
      this.input=alt.endpoints.find(e=>e.direction==='in'&&e.type==='bulk'); this.output=alt.endpoints.find(e=>e.direction==='out'&&e.type==='bulk');
      await this.controlTransfer(0x20,0,new Uint8Array([0x00,0xc2,0x01,0x00,0,0,8])); // 115200, 8N1
      await this.controlTransfer(0x22,3); // DTR + RTS
      this.decoder=new FrameDecoder(p=>this.receive(p),e=>this.log('error',e));
      void this.readLoop(device,token); await delay(200);
      await this.handshake(token,device.productName);
    } catch(e) { await this.close(); throw Error(`${e.message}${/claim|SecurityError/.test(e.message+' '+e.name)?' Close other pedal editors and try Chrome on Android. The OS may own this interface; export diagnostics.':''}`); }
  }
  async handshake(token,deviceName='ToneX One') {
      let success=false;
      for(let n=0;n<5;n++) {
        try {
          this.log('info',`Handshake ${n+1}/5`);
          try {
            const identity=await this.exchange(wake(),0x0b2b,400);
            // An already-awake pedal may ignore wake. Only its state reply is required.
            if(identity.length>=20&&identity[10]===0xb9&&identity[11]===3&&identity[15]===0xb9&&identity[16]===3) this.firmware=[...identity.slice(17,20)].join('.');
          } catch(e) {
            if(!(e instanceof ResponseTimeoutError)) throw e;
            this.log('info','No wake acknowledgement; requesting pedal state.');
          }
          await this.exchange(requestState(),0x0306,1200); success=true; break;
        } catch(e) {
          if(token!==this.generation||!(e instanceof ResponseTimeoutError)) throw e;
          this.log('error',e.message); await delay(150);
        }
      }
      if(!success) throw Error('Connection opened, but ToneX did not respond. Check pedal power, USB data cable, and firmware; export diagnostics.');
      if(!this.state) throw Error('Pedal responded with an unsupported state layout. Export diagnostics.');
      this.connected=true; this.emit('connection',{connected:true,device:deviceName,firmware:this.firmware});
  }
  async controlTransfer(request,value,data) {
    const result=await this.device.controlTransferOut({requestType:'class',recipient:'interface',request,value,index:this.controlNumber},data);
    if(result.status!=='ok')throw Error(`CDC setup failed: ${result.status}.`);
  }
  async readLoop(device,token) {
    try {
      while(token===this.generation&&device.opened) {
        const result=await device.transferIn(this.input.endpointNumber,4096);
        if(token!==this.generation)break;
        if(result.status!=='ok')throw Error(`USB receive failed: ${result.status}`);
        if(result.data?.byteLength)this.decoder.push(new Uint8Array(result.data.buffer,result.data.byteOffset,result.data.byteLength));
        else await delay(10);
      }
    } catch(e) { if(token===this.generation) { this.log('error',e.message); await this.close(e.message); } }
  }
  receive(p) {
    const type=messageType(p); this.log('in',`Message 0x${type.toString(16)}`,p);
    const expected=this.pending?.type===type;
    try {
      if(type===0x0306) {
        this.state=parseState(p); this.emit('state',this.state);
      } else if(type===0x0309) { const change=parseParameter(p); if(change)this.emit('parameter',change); }
      else if(type===0x0304&&!expected) this.emit('preset',parsePreset(p));
      if(expected) { const pending=this.pending; this.pending=null; clearTimeout(pending.timer); pending.resolve(p); }
    } catch(e) {
      if(type===0x0306) { this.state=null; this.emit('state',null); }
      this.log('error',e.message);
      if(expected)this.cancelPending(e);
    }
  }
  cancelPending(error) { if(this.pending) { const p=this.pending; this.pending=null; clearTimeout(p.timer); p.reject(error); } }
  async send(payload) {
    if(!this.device?.opened)throw Error('Connect your pedal first.');
    const data=frame(payload); this.log('out','Command',payload);
    const result=await this.device.transferOut(this.output.endpointNumber,data);
    if(result.status!=='ok'||result.bytesWritten!==data.length)throw Error('USB write was not completed.');
  }
  exchange(payload,type,timeout=2500) {
    if(this.pending) return Promise.reject(Error('Another USB request is still pending.'));
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>this.cancelPending(new ResponseTimeoutError(type,timeout)),timeout);
      const pending={type,resolve,reject,timer}; this.pending=pending; this.send(payload).catch(e=>{if(this.pending===pending)this.cancelPending(e);});
    });
  }
  getState() { return this.enqueue(async()=>{await this.exchange(requestState(),0x0306); return this.state;}); }
  getPreset(id) { return this.enqueue(async()=>parsePreset(await this.exchange(requestPreset(id),0x0304))); }
  changeState(change) {
    return this.enqueue(async()=>{
      // Refresh immediately before read-modify-write so physical pedal changes are preserved.
      await this.exchange(requestState(),0x0306);
      if(!this.state)throw Error('Cannot edit an unknown state layout.');
      await this.send(mutateState(this.state,change)); await delay(120);
      await this.exchange(requestState(),0x0306);
      const s=this.state;
      if((change.slot!==undefined&&s.activeSlot!==change.slot)||(change.preset!==undefined&&s.slots[change.slot]!==change.preset)||(change.bypass!==undefined&&s.bypass!==change.bypass)||(change.cabBypass!==undefined&&s.cabBypass!==change.cabBypass))throw Error('Pedal did not confirm the requested state. Refresh before retrying.');
      return s;
    });
  }
  writeParameter(index,value) { return this.enqueue(()=>{if(!this.connected||!this.state)throw Error('Pedal is not ready.');return this.send(setParameter(index,value));}); }
  async close(reason='') {
    const hadSession=!!this.device||this.connected;
    ++this.generation; this.connected=false; this.state=null; this.firmware=null; this.cancelPending(Error(reason||'USB session closed.'));
    const device=this.device; this.device=null;
    if(device?.opened)try { await device.close(); } catch(e) { this.log('error',e.message); }
    if(hadSession||reason)this.emit('connection',{connected:false,reason});
  }
  diagnostics() { return {app:'ToneX One Web / 0.3.0',transport:this.transport,userAgent:globalThis.navigator?.userAgent,secureContext:globalThis.isSecureContext,descriptors:this.descriptors,entries:this.entries}; }
}
