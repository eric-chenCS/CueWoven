class RecallPCM extends AudioWorkletProcessor {
  constructor() {super();this.data=new Int16Array(16000);this.position=0;this.sum=0;this.count=0;this.inputPosition=0;this.outputPosition=0;}
  process(inputs) {
    const channels=inputs[0];if(!channels?.length)return true;
    for(let i=0;i<channels[0].length;i++) {
      let sample=0;for(const channel of channels)sample+=channel[i];
      this.sum+=sample/channels.length;this.count++;this.inputPosition++;
      if(this.inputPosition>=Math.floor((this.outputPosition+1)*sampleRate/16000)) {
        this.data[this.position++]=Math.round(Math.max(-1,Math.min(1,this.sum/this.count))*32767);
        this.sum=0;this.count=0;this.outputPosition++;
        if(this.position===16000){this.port.postMessage(this.data,[this.data.buffer]);this.data=new Int16Array(16000);this.position=0;}
      }
    }
    return true;
  }
}
registerProcessor('recall-pcm',RecallPCM);
