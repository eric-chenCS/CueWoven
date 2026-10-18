// Original, silent demo videos with authored captions, never a user's history.
export const samples=[
  {videoId:'rcDemo00001',title:'Momento sample · Why batteries wear out',lines:['A rechargeable battery moves lithium ions between two electrodes.','Repeated charging traps some active lithium in chemical reactions. An aging phone battery stores less energy with each cycle.','Heat speeds up these reactions. Avoid leaving a charging phone in a hot car.']},
  {videoId:'rcDemo00002',title:'Momento sample · Coral bleaching',lines:['Tiny algae live inside coral and supply much of its food.','When ocean water becomes too warm, coral expels these algae and turns white. This is coral bleaching.','If cooler water returns soon enough, algae can return. Long heat waves can kill the coral.']},
  {videoId:'rcDemo00003',title:'Momento sample · Black holes',lines:['Gravity bends the paths of light around a black hole.','The event horizon is the boundary beyond which no light or signal can escape.','Tidal forces stretch objects lengthwise and squeeze them sideways, a process called spaghettification.']},
  {videoId:'rcDemo00004',title:'Momento sample · Making pasta sauce',lines:['Grate cheese and whisk it with eggs in a bowl.','Turn off the heat before mixing eggs into the hot pasta so the sauce does not scramble.','Add a little starchy cooking water and stir until the sauce becomes glossy.']},
  {videoId:'rcDemo00005',title:'Momento sample · Cleaning up event listeners',lines:['An event listener runs a function when a button is clicked.','Return a cleanup function from useEffect to remove the event listener.','Without cleanup, reopening a component can attach duplicate listeners and run the handler more than once.']},
];
export const sampleFor=id=>samples.find(video=>video.videoId===id);
export const sampleLink=hit=>hit.sample&&sampleFor(hit.videoId)?chrome.runtime.getURL('samples/player.html')+'?id='+hit.videoId+'&t='+Math.max(0,Math.floor(hit.start||0)):null;
