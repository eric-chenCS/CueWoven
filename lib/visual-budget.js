// Text results must remain usable while the optional visual model downloads or works.
export async function visualBudget(work, milliseconds=1200) {
  let timer;
  try {
    return await Promise.race([work, new Promise(resolve=>{
      timer=setTimeout(()=>resolve({results:[],pending:true}),milliseconds);
    })]);
  } finally {clearTimeout(timer);}
}
