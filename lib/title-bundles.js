// Derived title index: 64 reads for a large library, rather than one per item.
export const titleBucket = id => String(parseInt(id.slice(-2),16) & 63);
export const isTitle = row => ['Title','Search'].includes(row.source);
export async function updateTitleBundle(store,id,passages,result){
  const key=titleBucket(id),bundle=await result(store.get(key))||{id:key,items:[]};
  bundle.items=bundle.items.filter(row=>row.id!==id);
  const titles=passages.filter(isTitle);
  if(titles.length)bundle.items.push({id,passages:titles});
  if(bundle.items.length)store.put(bundle);else store.delete(key);
}
