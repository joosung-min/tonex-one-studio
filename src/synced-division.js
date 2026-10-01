const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// USB transmission completes before the pedal necessarily applies the setting.
export async function writeSyncedDivision(usb,id,index,value,{writes=[],syncEnabled=false,isCurrent=()=>true,wait=delay}={}){
  const current=()=>{if(!isCurrent())throw Error('Preset changed during Division update.');};
  for(const [parameter,setting] of writes){current();await usb.writeParameter(parameter,setting);}
  if(!syncEnabled){current();await usb.writeParameter(index-1,1);await wait(180);}
  current();await usb.writeParameter(index,value);await wait(320);
  let detail;
  for(let attempt=0;attempt<3;attempt++){
    current();detail=await usb.getPreset(id);current();
    if(detail.parameters[index-1]===1&&detail.parameters[index]===value)return detail;
    if(attempt<2)await wait(250);
  }
  const error=new Error('The pedal did not confirm Sync and Division. Try again.');
  error.detail=detail;throw error;
}
