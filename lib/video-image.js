// Reject external URLs, oversized encodings and large JPEG dimensions before decode.
export function validateVideoImage(image,{width=320,height=180,chars=90000}={}) {
  if(typeof image!=='string'||image.length>chars||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image))throw Error('Invalid video image.');
  const bytes=Uint8Array.from(atob(image.slice(23)),char=>char.charCodeAt(0));
  if(bytes[0]!==255||bytes[1]!==216)throw Error('Invalid JPEG image.');
  let offset=2;
  while(offset+8<bytes.length){
    if(bytes[offset++]!==255)break;
    const marker=bytes[offset++],length=bytes[offset]*256+bytes[offset+1];
    if(length<2||offset+length>bytes.length)break;
    if([192,193,194].includes(marker)){
      const h=bytes[offset+3]*256+bytes[offset+4],w=bytes[offset+5]*256+bytes[offset+6];
      if(w>0&&h>0&&w<=width&&h<=height)return image;
      break;
    }
    offset+=length;
  }
  throw Error(`Video images must be at most ${width} × ${height} pixels.`);
}
