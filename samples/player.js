import {sampleFor} from '../lib/samples.js';
const params=new URLSearchParams(location.search),sample=sampleFor(params.get('id')),video=document.getElementById('video');
if(sample){
  document.getElementById('title').textContent=sample.title;
  video.src=sample.videoId+'.webm';
  video.addEventListener('loadedmetadata',()=>{video.currentTime=Math.min(23,Math.max(0,Number(params.get('t'))||0));});
  video.addEventListener('timeupdate',()=>{document.getElementById('caption').textContent=sample.lines[Math.min(2,Math.floor(video.currentTime/8))];});
  for(const [i,text] of sample.lines.entries()){
    const button=document.createElement('button');button.className='btn ghost';button.textContent=i*8+'s · '+text;
    button.addEventListener('click',()=>{video.currentTime=i*8;video.play().catch(()=>{});});document.getElementById('transcript').append(button);
  }
}else document.getElementById('caption').textContent='Unknown sample.';
