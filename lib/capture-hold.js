// Reserve library mutations before awaiting captures, queries or model warmup.
export function createCaptureHold({pending=()=>[],cancel=()=>{}}={}) {
  let operation=null;
  return {
    held:()=>operation!==null,
    async run(change,{restore=false}={}) {
      if(operation)throw Error(operation==='restore'?'Wait for the backup restore to finish before changing saved data.':'Wait for the current library change to finish.');
      operation=restore?'restore':'change';
      try {
        cancel();
        await Promise.all(pending().filter(Boolean).map(task=>task.catch(()=>{})));
        return await change();
      } finally {operation=null;}
    },
  };
}
