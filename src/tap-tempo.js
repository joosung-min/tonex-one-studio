// Average the most recent five beat intervals. Ignore taps faster than 240 BPM.
export class TapTempo {
  constructor(){this.reset();}
  reset(){this.last=null;this.intervals=[];}
  tap(time){
    if(!Number.isFinite(time))return null;
    if(this.last===null){this.last=time;return null;}
    const interval=time-this.last;
    if(interval<=0||interval<250)return null;
    this.last=time;
    if(interval>1500){this.intervals=[];return null;}
    this.intervals.push(interval);if(this.intervals.length>5)this.intervals.shift();
    return Math.round(600000/(this.intervals.reduce((a,b)=>a+b,0)/this.intervals.length))/10;
  }
}
