// Additions dirty a snapshot; only removals reject an in-flight read.
export function createRevisionCache(load) {
  let value=null,pending=null,revision=0,removals=0,built=-1;
  return {
    invalidate({destructive=true}={}){revision++;if(destructive){value=null;removals++;}},
    update(change){if(value)change(value);},
    async get(){
      while(true){
        if(value&&built===revision)return value;
        if(!pending){
          const started=revision,removed=removals;
          pending=Promise.resolve().then(load).then(next=>{if(!next)throw Error('Index build returned no snapshot');if(removed===removals){value=next;built=started;}}).finally(()=>{pending=null});
        }
        const removed=removals;
        await pending;
        if(removed===removals&&value)return value;
      }
    },
  };
}
