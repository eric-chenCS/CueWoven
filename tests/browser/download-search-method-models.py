"""Download pinned model data for optional browser experiments, never production code."""
import argparse, hashlib, json, urllib.request
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('directory',type=Path)
parser.add_argument('--fp32',action='store_true',help='Also fetch full-precision rewriter weights for control checks')
args=parser.parse_args()
models={
 'Xenova/ms-marco-MiniLM-L-6-v2':('a09144355adeed5f58c8ed011d209bf8ee5a1fec',['config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/model_quantized.onnx']),
 'Xenova/flan-t5-small':('311454e83bc784267fd7eef5940ee854144abbec',['config.json','generation_config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx']),
}
if args.fp32:models['Xenova/flan-t5-small'][1].extend(['onnx/encoder_model.onnx','onnx/decoder_model_merged.onnx'])
for repo,(revision,names) in models.items():
 with urllib.request.urlopen('https://huggingface.co/api/models/'+repo+'/revision/'+revision+'?blobs=true',timeout=60) as response:meta=json.load(response)
 assert meta['sha']==revision,'Unexpected model revision'
 entries={f['rfilename']:f for f in meta['siblings']};manifest=[]
 for name in names:
  entry=entries[name];target=args.directory/repo/name;target.parent.mkdir(parents=True,exist_ok=True)
  def valid(data):
   if 'lfs' in entry:return hashlib.sha256(data).hexdigest()==entry['lfs']['sha256']
   return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==entry['blobId']
  if not target.exists() or not valid(target.read_bytes()):
   with urllib.request.urlopen('https://huggingface.co/'+repo+'/resolve/'+revision+'/'+name,timeout=180) as response:data=response.read()
   if not valid(data):raise RuntimeError('Checksum mismatch: '+repo+'/'+name)
   partial=target.with_name(target.name+'.part');partial.write_bytes(data);partial.replace(target)
  data=target.read_bytes();manifest.append({'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
  print(repo+'/'+name,len(data),flush=True)
 (args.directory/repo/'download-manifest.json').write_text(json.dumps({'repo':repo,'revision':revision,'files':manifest},indent=2),encoding='utf-8')
