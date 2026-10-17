// Coalesce reads, but never publish a build invalidated while it was in flight.
export function createRevisionCache(load) {
  let value=null,pending=null,revision=0;
  return {
    invalidate(){value=null;revision++},
    async get(){
      while(!value){
        if(!pending){
          const started=revision;
          pending=Promise.resolve().then(load).then(next=>{if(!next)throw Error('Index build returned no snapshot');if(started===revision)value=next}).finally(()=>{pending=null});
        }
        await pending;
      }
      return value;
    },
  };
}
