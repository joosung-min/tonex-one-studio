import {APP_VERSION} from './version.js';
import {CabinetModes} from './cabinet-mode.js';
import {createPedalConnection} from './serial.js';
import {parameters} from './parameters.js';
import {effectIcon} from './effect-icons.js';
import {bindEffectInteractions} from './effect-interactions.js';
const $=id=>document.getElementById(id), usb=createPedalConnection(),cabinetModes=new CabinetModes();
$('app-version').textContent=`v${APP_VERSION}`;$('footer-version').textContent=`v${APP_VERSION}`;
const groups=[
  {id:'gate',name:'Gate',symbol:'⊓',enable:1,position:0,indices:[2,3,4],category:'NOISE GATE'},
  {id:'comp',name:'Comp',symbol:'≋',enable:6,position:5,indices:[7,8,9],category:'DYNAMICS'},
  {id:'amp',name:'Amp',symbol:'▥',enable:18,indices:[20,21,34,35],category:'TONE MODEL'},
  {id:'eq',name:'EQ',symbol:'☷',position:10,indices:[11,12,13,14,15,16,17],category:'EQUALIZER'},
  {id:'cab',name:'Cab',symbol:'▦',indices:[24,25,26,27,28,29,30,31,32,33],category:'CABINET'},
  {id:'mod',name:'Mod',symbol:'∿',enable:64,position:63,model:65,category:'MODULATION'},
  {id:'delay',name:'Delay',symbol:'⋮',enable:95,position:94,model:96,category:'TIME & SPACE'},
  {id:'reverb',name:'Reverb',symbol:'⌁',enable:37,position:36,model:38,category:'TIME & SPACE'}
];
const modelNames={24:['Tone Model','VIR','Off'],25:Array.from({length:11},(_,i)=>`Cabinet ${i+1}`),27:['Mic 1','Mic 2','Mic 3'],30:['Mic 1','Mic 2','Mic 3'],38:['Spring 1','Spring 2','Spring 3','Spring 4','Room','Plate'],65:['Chorus','Tremolo','Phaser','Flanger','Rotary'],96:['Digital','Tape']};
const labels={2:'Threshold',3:'Release',4:'Depth',7:'Threshold',8:'Make-up gain',9:'Attack',11:'Bass',12:'Bass frequency',13:'Mid',14:'Mid Q',15:'Mid frequency',16:'Treble',17:'Treble frequency',20:'Gain',21:'Volume',22:'Mix',24:'Cabinet mode',25:'VIR cabinet',26:'Resonance',27:'Microphone 1',28:'Mic 1 · X',29:'Mic 1 · Z',30:'Microphone 2',31:'Mic 2 · X',32:'Mic 2 · Z',33:'Mic blend',34:'Presence',35:'Depth'};
const ampLabels={amp:'Amplifier',eq:'Equalizer',gate:'Noise gate',comp:'Compressor',cab:'Cabinet',mod:'Modulation',delay:'Delay',reverb:'Reverb'};
let demo=false,busy=false,scanning=false,pedalState=null,presets=[],selected=null,effect='amp',params=[],dirty=false,activePreset=null;
let confirmationTimer, pendingWrites=new Map(), writeTimer, session=0;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active=()=>pedalState?.slots[pedalState.activeSlot];
const ready=()=>!busy&&(demo||usb.connected)&&!!pedalState;
const editable=()=>ready()&&selected===active()&&params.length===109&&params.every(Number.isFinite);
function notify(message,success=false) { $('notice').hidden=false;$('notice').textContent=message;$('notice').classList.toggle('success',success); }
function download(filename,data) { const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function changeView(view) { document.body.dataset.view=view;$('nav-presets').classList.toggle('active',view==='presets');$('nav-editor').classList.toggle('active',view==='editor'); }
function indicesFor(g) {
  if(g.id==='reverb') {const base=39+Math.round(params[38]??0)*4;return [base,base+1,base+2,base+3];}
  if(g.id==='delay') {const base=97+Math.round(params[96]??0)*6;return Array.from({length:6},(_,i)=>base+i);}
  if(g.id==='mod') {const bases=[66,71,77,82,88],counts=[5,6,5,6,6],m=Math.round(params[65]??0);return Array.from({length:counts[m]||5},(_,i)=>(bases[m]||66)+i);}
  if(g.id==='cab')return params[24]===1?g.indices:[24];
  return g.indices;
}
function label(p) {if(p.id.endsWith('_TS'))return 'Rhythmic division';
  return labels[p.index]||p.id.replace(/^(REVERB_(SPRING\d|ROOM|PLATE)_|MODULATION_(CHORUS|TREMOLO)_|PHASER_|FLANGER_|ROTARY_|DELAY_(DIGITAL|TAPE)_)/,'').toLowerCase().replaceAll('_',' ').replace(/^\w/,s=>s.toUpperCase());}
function unit(p) {if(/THRESHOLD|MAKE_UP|NOISE_GATE_DEPTH/.test(p.id))return 'dB';if(/FREQ/.test(p.id))return 'Hz';if(/RELEASE|ATTACK|PREDELAY|DELAY_.*_TIME/.test(p.id))return 'ms';if(/_RATE/.test(p.id))return 'Hz';if(p.max===100||p.min===-100&&p.max===100)return '%';return '';}
function step(p) {return p.type==='range'?(p.max-p.min>100?1:.1):1;}
function format(value,p) {return Number.isFinite(value)?Number(value.toFixed(step(p)===1?0:1)).toString():'—';}
function renderPresets() {
  const query=$('search').value.toLowerCase(), filtered=presets.filter(p=>p.name.toLowerCase().includes(query)||String(p.id+1).includes(query));
  if(!presets.length) $('preset-list').innerHTML='<div class="empty-list"><strong>Your library starts here.</strong>Connect your pedal to read its stored presets, or explore the demo.</div>';
  else if(!filtered.length)$('preset-list').innerHTML='<div class="empty-list">No matching presets.</div>';
  else $('preset-list').innerHTML=filtered.map(p=>`<button class="preset-row ${p.id===selected?'selected':''}" data-preset="${p.id}" aria-pressed="${p.id===selected}" ${busy||!p.read?'disabled':''}><span class="preset-index">${String(p.id+1).padStart(2,'0')}</span><i class="preset-dot" style="background:${p.color||'#93a786'}"></i><span>${escape(p.name)}</span><span class="playing">${p.id===active()?'●':'↗'}</span></button>`).join('');
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.preset);params=presets[selected].parameters||[];render();changeView('editor');});
}
const chainOrder=['gate','amp','cab','eq','comp','mod','delay','reverb'];
const quickToggle=new Set(['gate','amp','cab','comp','mod','delay','reverb']);
function renderChain() {
  if(!$('chain').children.length) {
    $('chain').innerHTML=chainOrder.map(id=>{
      const g=groups.find(group=>group.id===id);
      return `<button class="effect-block" data-effect="${g.id}" aria-pressed="false"><span class="effect-symbol" aria-hidden="true">${effectIcon(g.id)}</span><span class="effect-label">${g.name}</span><span class="effect-state"></span><i class="effect-led" aria-hidden="true"></i></button>`;
    }).join('');
    document.querySelectorAll('[data-effect]').forEach(button=>{
      const g=groups.find(group=>group.id===button.dataset.effect);
      bindEffectInteractions(button,{
        select:()=>{effect=g.id;renderChain();renderControls();},
        toggle:()=>toggleEffect(g)
      });
    });
  }
  document.querySelectorAll('[data-effect]').forEach(button=>{
    const g=groups.find(group=>group.id===button.dataset.effect);
    const known=params.length===109;
    const on=known&&(g.enable===undefined||params[g.enable]===1)&&!(g.id==='cab'&&params[24]===2);
    button.classList.toggle('selected',effect===g.id);button.classList.toggle('on',on);
    button.setAttribute('aria-pressed',String(effect===g.id));
    button.querySelector('.effect-state').textContent=!known?'—':on?'On':'Off';
    button.title=quickToggle.has(g.id)?`${g.name}: select to edit; double-click or double-tap to toggle${!editable()?' after loading the preset':''}`:`${g.name}: select to edit`;
  });
}
function toggleEffect(g) {
  if(!quickToggle.has(g.id))return;
  if(!editable()){notify('Load this preset and connect your pedal before switching effects.');return;}
  effect=g.id;
  if(g.id==='cab')applyParameter(24,cabinetModes.toggled(selected,params[24]),true);
  else applyParameter(g.enable,params[g.enable]===1?0:1,true);
}
function renderControls() {
  const g=groups.find(g=>g.id===effect), enabled=editable(),disabled=enabled?'':'disabled';
  $('effect-name').textContent=ampLabels[effect];
  $('effect-actions').className='effect-actions';
  $('effect-actions').innerHTML=(g.position!==undefined?`<select data-param="${g.position}" aria-label="Effect position" ${disabled}><option value="0" ${params[g.position]!==1?'selected':''}>Pre amp</option><option value="1" ${params[g.position]===1?'selected':''}>Post amp</option></select>`:'')+(g.model!==undefined?`<select data-param="${g.model}" aria-label="Effect model" ${disabled}>${modelNames[g.model].map((n,i)=>`<option value="${i}" ${params[g.model]===i?'selected':''}>${n}</option>`).join('')}</select>`:'')+(g.enable!==undefined?`<button class="toggle ${params[g.enable]!==1?'off':''}" data-toggle="${g.enable}" aria-pressed="${params[g.enable]===1}" ${disabled}>${params[g.enable]===1?'● On':'○ Off'}</button>`:'');
  if(g.id==='cab')$('effect-actions').innerHTML+=`<button class="toggle ${params[24]===2?'off':''}" id="cab-toggle" aria-pressed="${params[24]!==2}" ${disabled}>${params[24]===2?'○ Off':'● On'}</button>`;
  $('parameter-controls').innerHTML=indicesFor(g).map(index=>{
    const p=parameters[index],v=params[index],title=label(p);
    if(p.type==='switch')return `<div class="control"><span class="control-label">${title}</span><button class="toggle ${v!==1?'off':''}" data-toggle="${index}" aria-pressed="${v===1}" ${disabled}>${p.id.endsWith('_MODE')?(v===1?'Ping-pong':'Normal'):(v===1?'On':'Off')}</button></div>`;
    if(p.type==='select')return `<label class="control"><span class="control-label">${title}</span><select data-param="${index}" ${disabled}>${(modelNames[index]||Array.from({length:p.max-p.min+1},(_,i)=>String(i+p.min))).map((n,i)=>`<option value="${i+p.min}" ${v===i+p.min?'selected':''}>${n}</option>`).join('')}</select></label>`;
    return `<div class="control"><label class="control-label" for="range-${index}">${title}</label><div id="knob-${index}" class="knob" style="--angle:${Number.isFinite(v)?270*(v-p.min)/(p.max-p.min):0}deg" aria-hidden="true"></div><input id="range-${index}" type="range" data-param="${index}" min="${p.min}" max="${p.max}" step="${step(p)}" value="${v??p.min}" ${disabled}><label class="value-field"><input id="value-${index}" aria-label="${title} numeric value" type="number" min="${p.min}" max="${p.max}" step="${step(p)}" data-param="${index}" value="${Number.isFinite(v)?format(v,p):''}" placeholder="—" ${disabled}><small>${unit(p)}</small></label></div>`;
  }).join('');
  if($('cab-toggle'))$('cab-toggle').onclick=()=>toggleEffect(g);
  document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>applyParameter(Number(b.dataset.toggle),params[b.dataset.toggle]===1?0:1,true));
  document.querySelectorAll('select[data-param]').forEach(b=>b.onchange=()=>applyParameter(Number(b.dataset.param),Number(b.value),true));
  document.querySelectorAll('input[data-param]').forEach(b=>{
    b.oninput=()=>{if(b.value!==''&&Number.isFinite(Number(b.value)))applyParameter(Number(b.dataset.param),Number(b.value));};
    b.onchange=()=>{if(b.value!==''&&Number.isFinite(Number(b.value)))applyParameter(Number(b.dataset.param),Number(b.value));else updateControl(Number(b.dataset.param));};
  });
  $('parameter-note').textContent=demo?'Demo controls are simulated.':selected!==active()&&selected!==null?'Load this preset to edit it on your pedal.':editable()?'Permanent saving isn’t supported here. Use the official TONEX Editor app to save changes permanently.':'Read a supported preset to enable live controls.';
}
function updateControl(index) {
  const p=parameters[index],v=params[index];
  if($(`knob-${index}`))$(`knob-${index}`).style.setProperty('--angle',`${270*(v-p.min)/(p.max-p.min)}deg`);
  if($(`range-${index}`))$(`range-${index}`).value=v;
  if($(`value-${index}`)&&document.activeElement!==$(`value-${index}`))$(`value-${index}`).value=format(v,p);
}
function render() {
  renderPresets();renderChain();renderControls();
  const p=presets.find(p=>p.id===selected),online=demo||usb.connected;
  $('preset-number').textContent=p?`PRESET ${String(p.id+1).padStart(2,'0')} / 20`:'NO PRESET SELECTED';
  $('preset-name').textContent=p?.name||'Connect your pedal';
  const isActive=!!p&&selected===active();
  $('preset-status').hidden=!isActive;
  $('load').hidden=!p||isActive;
  $('preset-status').textContent=isActive?(demo?'Active in demo':'Active on your pedal'):'';
  $('status-text').textContent=busy?(scanning?'Reading presets…':'Connecting / syncing…'):demo?'Demo mode':usb.connected?(usb.transport==='webserial'?'USB serial connected':'USB connected'):'Not connected';
  $('status-dot').className=usb.connected?'live':'';
  $('connect').textContent=usb.connected?'Disconnect':'↗ Connect pedal';$('connect').disabled=busy;
  $('refresh').disabled=!online||busy;$('refresh').classList.toggle('spinner',scanning);
  $('load').disabled=!ready()||!p?.read;
  document.querySelectorAll('[data-slot]').forEach(b=>{
    const current=Number(b.dataset.slot)===pedalState?.activeSlot;
    b.classList.toggle('active',current);b.setAttribute('aria-pressed',String(current));b.disabled=!ready();
  });
  $('welcome').hidden=online;$('demo-banner').hidden=!demo;
  $('firmware-info').hidden=!usb.connected;
  $('firmware-info').textContent=usb.connected?`Firmware ${usb.firmware||'unknown'}`:'';
  $('export-presets').disabled=!presets.some(p=>p.read)||busy;
  $('reconnect').disabled=busy||demo||usb.connected||!usb.supported;
}
function cancelWrites() {pendingWrites.clear();clearTimeout(writeTimer);clearTimeout(confirmationTimer);}
async function flushWrites() {
  const writes=[...pendingWrites];pendingWrites.clear(); const epoch=session;
  if(!writes.length||demo||!editable())return;
  try {for(const [index,value] of writes){if(epoch!==session||!editable())return;await usb.writeParameter(index,value);}}
  catch(e){if(epoch===session){notify(`Parameter write failed: ${e.message}`);}}
  clearTimeout(confirmationTimer);confirmationTimer=setTimeout(()=>{if(epoch===session&&!pendingWrites.size)void confirmParameters();},500);
}
async function confirmParameters() {
  if(!usb.connected||busy||scanning||selected!==active())return;
  const epoch=session,id=active();
  try {const detail=await usb.getPreset(id);if(epoch!==session||active()!==id||selected!==id||pendingWrites.size)return;
    storePreset(id,detail);params=detail.parameters;renderChain();renderControls();
  }catch(e){if(epoch===session){usb.log('error',e.message);}}
}
function applyParameter(index,value,rebuild=false) {
  if(!editable())return;const p=parameters[index];value=Math.max(p.min,Math.min(p.max,value));if(p.type!=='range')value=Math.round(value);
  if(!Number.isFinite(value))return;if(index===24)cabinetModes.remember(selected,value);params[index]=value;presets[selected].parameters=params.slice();dirty=true;
  if(!demo){pendingWrites.set(index,value);clearTimeout(writeTimer);writeTimer=setTimeout(flushWrites,80);}
  updateControl(index);if(rebuild){renderChain();renderControls();}
}
function storePreset(id,detail) {
  const existing=presets[id];if(!existing)return;
  existing.name=detail.name||`Preset ${String(id+1).padStart(2,'0')}`;existing.parameters=detail.parameters;existing.read=true;cabinetModes.remember(id,detail.parameters?.[24]);
  if(!demo)try{localStorage.setItem('tonex-last-read',JSON.stringify({device:usb.device?.serialNumber,readAt:new Date().toISOString(),presets}));}catch{/* Local storage is optional. */}
}
async function scanPresets() {
  if(demo){updateTimestamp();return;}
  cancelWrites();busy=true;scanning=true;render();const epoch=session;
  let read=0;
  try {
    await usb.getState();
    presets=Array.from({length:20},(_,id)=>({id,name:`Reading preset ${String(id+1).padStart(2,'0')}…`,read:false,parameters:[],color:`rgb(${pedalState.colors[id].join(',')})`}));
    for(let id=0;id<20;id++) {
      if(epoch!==session||!usb.connected)throw Error('Connection interrupted.');
      $('sync-label').textContent=`Reading ${id+1} of 20 presets…`;
      const detail=await usb.getPreset(id);storePreset(id,detail);read++;renderPresets();
    }
    await usb.getState();selected=active();activePreset=active();
    const detail=await usb.getPreset(selected);storePreset(selected,detail);params=detail.parameters;
    updateTimestamp();$('notice').hidden=true;
  } catch(e) {
    if(epoch===session){notify(`Read ${read}/20 presets. ${e.message}`);$('sync-label').textContent=`${read}/20 presets read · Retry refresh`;}
  } finally {if(epoch===session){busy=false;scanning=false;render();}}
}
async function runStateChange(change) {
  if(!ready())return;cancelWrites();busy=true;render();const epoch=session;
  try {
    if(demo) {
      if(change.slot!==undefined){pedalState.activeSlot=change.slot;pedalState.stomp=change.slot===2;}
      if(change.preset!==undefined)pedalState.slots[change.slot]=change.preset;
      if(change.bypass!==undefined)pedalState.bypass=change.bypass;
    } else await usb.changeState(change);
    if(epoch!==session)return;activePreset=active();dirty=false;
    if(!demo){const detail=await usb.getPreset(active());if(epoch!==session)return;storePreset(active(),detail);}
    selected=active();if(change.preset!==undefined)effect='amp';
    params=presets[selected].parameters.slice();$('notice').hidden=true;
  } catch(e){if(epoch===session)notify(e.message);}finally{if(epoch===session){busy=false;render();}}
}
function updateTimestamp() { $('sync-label').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});$('sync-label').title='Last preset refresh'; }
function reset() {session++;cancelWrites();cabinetModes.clear();effect='amp';demo=false;busy=false;scanning=false;pedalState=null;presets=[];selected=null;activePreset=null;params=[];dirty=false;$('sync-label').textContent='—';render();}
function startDemo() {
  if(busy||usb.connected)return;reset();demo=true;
  const names=['British Breakup','California Clean','Plexi After Hours','Velvet Drive','Tweed on the Edge','Modern High Gain','Midnight Jazz','Desert Blues','Studio Crunch','Glass & Spring','Bass Foundation','Boutique Lead','Vintage Rhythm','Ambient Bloom','Classic Rock','Warm & Wide','Country Snap','Heavy Current','Soft Focus','Direct & Clean'];
  const colors=['#86a872','#c6a270','#839fac','#b88f81'];
  presets=names.map((name,id)=>{const values=parameters.map(p=>p.default);values[20]=3.4+(id%6)*.7;values[21]=5.2;values[11]=5.4;values[13]=4.8;values[16]=6.2;values[95]=1;values[99]=320;values[102]=18;values[42]=22;return {id,name,color:colors[id%4],parameters:values,read:true};});
  pedalState={slots:[0,1,2],activeSlot:0,stomp:false,bypass:false};selected=0;activePreset=0;params=presets[0].parameters.slice();updateTimestamp();$('notice').hidden=true;render();
}
usb.addEventListener('state',e=>{
  const previous=active();pedalState=e.detail;
  if(!pedalState){params=[];render();return;}
  if(previous!==active()) {
    cancelWrites();dirty=false;activePreset=active();
    if(usb.connected&&!busy&&!scanning){selected=active();params=[];render();void usb.getPreset(selected).then(detail=>{if(!busy&&selected===active()){storePreset(selected,detail);params=detail.parameters;render();}}).catch(e=>notify(e.message));}
  } else if(usb.connected&&!busy&&!scanning) render();
});
usb.addEventListener('parameter',e=>{
  if(busy||scanning||selected!==active())return;const {index,value}=e.detail;if(index>=109||!Number.isFinite(value)||pendingWrites.has(index))return;
  params[index]=value;if(index===24)cabinetModes.remember(selected,value);if(presets[selected])presets[selected].parameters=params.slice();updateControl(index);
  if(groups.some(g=>g.model===index||g.enable===index||g.position===index)||index===24){renderChain();renderControls();}
});
usb.addEventListener('preset',e=>{
  if(busy||scanning||selected!==active()||pendingWrites.size)return;
  if(presets[selected]){storePreset(selected,e.detail);params=e.detail.parameters;render();}
});
usb.addEventListener('connection',e=>{if(!e.detail.connected&&!demo){const reason=e.detail.reason;reset();if(reason)notify(reason);}});
usb.addEventListener('log',()=>{$('log').textContent=usb.entries.slice(-45).map(e=>`${e.time.slice(11,19)} ${e.direction.toUpperCase()}  ${e.message}${e.hex?`\n  ${e.hex.slice(0,220)}${e.hex.length>220?'…':''}`:''}`).join('\n');});
$('connect').onclick=async()=>{
  if(usb.connected){await usb.close();return;}if(busy)return;
  reset();busy=true;render();
  try {await usb.connect();busy=false;pedalState=usb.state;await scanPresets();}
  catch(e){busy=false;notify(e.name==='NotFoundError'?'No pedal was selected. Connect your powered ToneX One and try again.':e.message);render();}
};
$('reconnect').onclick=async()=>{
  if(!usb.supported||busy)return;reset();busy=true;render();
  try{await usb.reconnect();busy=false;pedalState=usb.state;await scanPresets();}
  catch(e){busy=false;notify(e.message);render();}
};
$('refresh').onclick=()=>{if(!busy)void scanPresets();};$('search').oninput=renderPresets;$('demo').onclick=startDemo;$('exit-demo').onclick=reset;
$('load').onclick=()=>runStateChange({preset:selected,slot:pedalState?.activeSlot});
document.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>{
  const slot=Number(b.dataset.slot);
  if(!ready())return;
  if(slot!==pedalState.activeSlot)void runStateChange({slot});
  else {selected=active();params=presets[selected]?.parameters?.slice()||[];render();}

});
$('nav-presets').onclick=()=>changeView('presets');$('nav-editor').onclick=()=>changeView('editor');
$('export-log').onclick=()=>download('tonex-usb-diagnostics.json',usb.diagnostics());
$('export-presets').onclick=()=>download('tonex-preset-settings.json',{format:'tonex-web-settings-v1',demo,exportedAt:new Date().toISOString(),device:usb.descriptors?.serialNumber,note:'Preset metadata and parameters only. Does not include tone model or IR binaries. Cannot be restored by this app.',presets});
$('support-info').textContent=!isSecureContext?'This address is not secure. Use HTTPS, or localhost on your Mac.':!usb.supported?'USB access is unavailable in this browser. Use Google Chrome on Mac or Android.':usb.transport==='webserial'?'Desktop USB serial is available. Connect your powered ToneX One by USB, close other pedal editors, then select its serial port. Export the log if connection fails.':'WebUSB is available. Connect your powered ToneX One with an OTG data cable and grant USB permission. Export the log if connection fails.';
$('welcome-copy').textContent=usb.transport==='webserial'?'Connect your powered ToneX One to your Mac with a USB data cable. Open this page in Google Chrome, then select the pedal’s serial port.':'Connect your powered ToneX One with a USB OTG data cable, then allow USB access in Chrome on Android.';
changeView('editor');render();
if('serviceWorker' in navigator&&isSecureContext)navigator.serviceWorker.register(new URL('../sw.js',import.meta.url)).catch(()=>{});

function renderTheme() {
  const dark=document.documentElement.dataset.theme==='dark';
  $('theme-toggle').setAttribute('aria-pressed',String(dark));
  $('theme-toggle').innerHTML=dark?'☀ <span>Light</span>':'☾ <span>Dark</span>';
  $('theme-toggle').title=dark?'Switch to light mode':'Switch to dark mode';
  document.querySelector('meta[name="theme-color"]').content=dark?'#141b18':'#171d19';
}
$('theme-toggle').onclick=()=>{
  const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=theme;
  try {localStorage.setItem('tonex-theme',theme);}catch {}
  renderTheme();
};
renderTheme();
