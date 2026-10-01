import {ToneXUSB,delay} from './usb.js';
import {VID,PID,FrameDecoder,frame} from './protocol.js';

// The pedal uses CDC-ACM over USB. Desktop browsers with Web Serial open the OS serial port;
// Android uses WebUSB instead. Both transports share the same ToneX protocol.
export class ToneXSerial extends ToneXUSB {
  constructor(serial=globalThis.navigator?.serial) {
    super(null); this.transport='webserial'; this.serial=serial; this.port=null; this.reader=null; this.writer=null; this.readTask=null; this.closeTask=null;
    serial?.addEventListener('disconnect',e=>{if((e.port||e.target)===this.port)void this.close('Pedal disconnected.');});
  }
  get supported() { return !!this.serial; }
  async connect() {
    if(!globalThis.isSecureContext)throw Error('USB serial access requires HTTPS or localhost. Open this app at a secure address.');
    if(!this.serial)throw Error('This browser does not support USB serial access. Try another browser with USB support on your desktop or Android device.');
    // Keep the permission picker in the originating click gesture.
    const port=await this.serial.requestPort({filters:[{usbVendorId:VID,usbProductId:PID}]});
    return this.open(port);
  }
  async reconnect() {
    if(!this.serial)throw Error('This browser does not support USB serial access. Try another browser with USB support on your desktop or Android device.');
    const ports=await this.serial.getPorts(),port=ports.find(p=>{const info=p.getInfo();return info.usbVendorId===VID&&info.usbProductId===PID;});
    if(!port)throw Error('No authorized ToneX One serial port is connected. Use Connect pedal.');
    return this.open(port);
  }
  async open(port) {
    await this.close();
    const info=port.getInfo();
    if(info.usbVendorId!==VID||info.usbProductId!==PID)throw Error('The selected serial port is not a ToneX One.');
    this.port=port;const token=++this.generation;
    this.descriptors={transport:'webserial',vendorId:info.usbVendorId,productId:info.usbProductId,productName:'ToneX One',baudRate:115200,dataBits:8,stopBits:1,parity:'none'};
    try {
      await port.open({baudRate:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none',bufferSize:65536});
      await port.setSignals({dataTerminalReady:true,requestToSend:true});
      if(!port.readable||!port.writable)throw Error('The pedal serial port has no readable/writable streams.');
      this.device={productName:'ToneX One'};
      this.decoder=new FrameDecoder(p=>this.receive(p),e=>this.log('error',e));
      this.reader=port.readable.getReader();this.writer=port.writable.getWriter();
      this.log('info','USB serial port opened at 115200 baud; DTR/RTS enabled.');
      this.readTask=this.readSerial(this.reader,token);
      await delay(200);await this.handshake(token,'ToneX One');
    } catch(e) {
      await this.close();
      throw Error(`${e.message} Close TONEX Editor/Librarian and any other app using the pedal, check the USB data cable, then reconnect in your web browser.`);
    }
  }
  async readSerial(reader,token) {
    let failure;
    try {
      while(token===this.generation) {
        const {value,done}=await reader.read();
        if(token!==this.generation)break;
        if(done)throw Error('Pedal serial stream closed.');
        if(value?.length)this.decoder.push(value);
      }
    } catch(e) {if(token===this.generation)failure=e;}
    finally {reader.releaseLock();if(this.reader===reader)this.reader=null;}
    // Do not await close here: close waits for this receive loop to finish.
    if(failure){this.log('error',failure.message);void this.close(failure.message);}
  }
  async send(payload) {
    const writer=this.writer;
    if(!writer||!this.port)throw Error('Connect your pedal first.');
    this.log('out','Command',payload);await writer.write(frame(payload));
  }
  async close(reason='') {
    if(this.closeTask)return this.closeTask;
    const hadSession=!!this.port||this.connected,port=this.port,reader=this.reader,writer=this.writer,readTask=this.readTask;
    ++this.generation;this.connected=false;this.state=null;this.firmware=null;this.masterVolume=null;this.bypassReturnSlot=null;this.cancelPending(Error(reason||'Serial session closed.'));
    this.port=null;this.device=null;this.reader=null;this.writer=null;this.readTask=null;
    this.closeTask=(async()=>{
      // Cancel reads and abort queued writes before releasing the stream locks.
      await Promise.allSettled([reader?.cancel(),writer?.abort()]);
      if(readTask)await readTask.catch(()=>{});
      if(writer)try{writer.releaseLock();}catch(e){this.log('error',e.message);}
      if(port)try{await port.close();}catch(e){this.log('error',e.message);}
      if(hadSession||reason)this.emit('connection',{connected:false,reason});
    })();
    try{await this.closeTask;}finally{this.closeTask=null;}
  }
}

export function createPedalConnection(nav=globalThis.navigator) {
  // Android can expose Web Serial for Bluetooth; that does not provide USB CDC access.
  return !/Android/i.test(nav?.userAgent||'')&&nav?.serial ? new ToneXSerial(nav.serial) : new ToneXUSB(nav?.usb);
}
