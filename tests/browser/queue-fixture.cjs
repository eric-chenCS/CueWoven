// Uses the production queue with controlled caption outcomes and the real local index.
exports.captureOptionsMessages = context => context.addInitScript(() => {
 if (!location.pathname.endsWith('/options/options.html')) return;
 const original = chrome.runtime.onMessage.addListener.bind(chrome.runtime.onMessage);
 chrome.runtime.onMessage.addListener = listener => {window.recallMessage = listener;return original(listener);};
});

exports.installControlledQueue = page => page.evaluate(async () => {
 const {createTranscriptQueue} = await import(chrome.runtime.getURL('lib/transcript-queue.js'));
 const original = chrome.runtime.sendMessage.bind(chrome.runtime);
 window.bulkCalls = [];window.testMode = 'first-success';
 const waiting = [];
 const queue = createTranscriptQueue({
  onChange: job => window.recallMessage({type: 'transcript-job', job}),
  processVideo: async videoId => {
   window.bulkCalls.push(videoId);
   if(window.testMode === 'hold') await new Promise(resolve => {
    waiting.push(resolve);window.releaseBulk = () => waiting.splice(0).forEach(fn => fn());
   });
   if(window.testMode === 'hold' || window.bulkCalls.length === 1) {
    const result = await original({target:'offscreen',type:'index',method:'controlled-test',video:{videoId,title:'Battery science',channel:'Fixture'},segments:[{start:42,text:'Chemical reactions damage battery electrodes after repeated charging and reduce the energy stored in your phone.'}]});
    if(result?.error) throw Error(result.error);
    return {videoId,status:'done',chunkCount:result.chunkCount};
   }
   return {videoId,status:'failed',reason:'Controlled unavailable captions'};
  },
 });
 chrome.runtime.sendMessage = async message => {
  if(message.type === 'transcript-job-start')return {job:queue.start(message.urls)};
  if(message.type === 'transcript-job-pause')return {job:queue.pause()};
  if(message.type === 'transcript-job-status')return {job:queue.get()};
  return original(message);
 };
});
