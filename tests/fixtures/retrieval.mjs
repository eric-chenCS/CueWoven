// Synthetic, labeled passages fixed before comparing the candidate rankers/models.
export const videos = [
  {videoId:'battery',title:'Lithium-ion science',channel:'Lab Notes',chunks:[
    {start:0,text:'Welcome back. Today we have three experiments and an announcement about next week.'},
    {start:42,text:'Repeated charging causes chemical reactions inside the electrodes. Active lithium becomes trapped, so an aging phone cell stores less energy with every cycle.'},
    {start:180,text:'Avoid leaving the device in a hot car. Heat accelerates degradation even when you are not using the phone.'}]},
  {videoId:'trap',title:'SSundee Minecraft gold floor challenge',channel:'SSundeePlus',chunks:[
    {start:0,text:'We are collecting wood and looking for food before nightfall. Somebody forgot to bring a bed.'},
    {start:72,text:'Put it right there. That trap needs a clean, solid floor. Place the pressure plate on the gold blocks and hide the sticky pistons underneath.'},
    {start:260,text:'Everyone jumped into the water when the creeper exploded. We lost all the diamonds and had to start mining again.'}]},
  {videoId:'picnic',title:'Battery charging cycles and capacity loss: food for thought',channel:'Lunch Break',chunks:[
    {start:15,text:'Pack your rechargeable lunch box with a sandwich and some fruit. The recipe uses bread, tomatoes and sliced cheese.'},
    {start:100,text:'Today we are painting a yellow picnic table. Give the first coat plenty of time to dry before you sit down.'}]},
  {videoId:'space',title:'A journey through black holes',channel:'Orbit',chunks:[
    {start:20,text:'The event horizon is the boundary beyond which light cannot escape. Nothing can send a signal back out after crossing it.'},
    {start:140,text:'Tidal forces stretch an astronaut lengthwise while squeezing sideways. This extreme stretching is often called spaghettification.'},
    {start:300,text:'Hawking radiation allows black holes to lose mass very slowly through quantum effects near the horizon.'}]},
  {videoId:'car',title:'Safe car washing',channel:'Garage',chunks:[
    {start:20,text:'Rinse the car before touching the paint. Use a clean microfiber mitt and a separate bucket for dirty water to avoid scratches.'},
    {start:150,text:'Dry the windows with a fresh towel. Never put household dish soap directly on the paint.'}]},
  {videoId:'carbon',title:'Carbon and climate',channel:'Earth Lab',chunks:[
    {start:20,text:'Carbon dioxide can be captured from air and injected into basalt. The gas reacts with minerals and becomes solid carbonate rock.'},
    {start:140,text:'Trees absorb carbon while growing. Cutting a forest down releases stored carbon and changes the local ecosystem.'}]},
  {videoId:'pasta',title:'Carbonara without cream',channel:'Kitchen',chunks:[
    {start:30,text:'Whisk eggs and grated pecorino in a bowl. Turn off the heat before mixing the egg sauce into hot pasta so it does not scramble.'},
    {start:170,text:'Save a cup of starchy cooking water. Add a small amount to loosen the sauce until it becomes glossy.'}]},
  {videoId:'react',title:'React hooks explained',channel:'Code School',chunks:[
    {start:10,text:'A state update schedules a render. Reading the state immediately after setting it still shows the value from the current render.'},
    {start:95,text:'Return a cleanup function from useEffect to remove the event listener. Otherwise reopening the component attaches another duplicate listener.'}]},
  {videoId:'fabric',title:'Fabric mod loader installation for Minecraft',channel:'Block Workshop',chunks:[
    {start:50,text:'Choose the loader version matching your game. Put the downloaded mod jar into the mods folder and install Fabric API if the mod requires it.'},
    {start:210,text:'If the game crashes, check that every mod supports the same Minecraft version. A file meant for Forge does not work with this loader.'}]},
  {videoId:'sewing',title:'Working with cotton fabric',channel:'Needle',chunks:[
    {start:25,text:'Wash the cotton fabric before cutting it. Press the seam allowance flat and keep the grain line straight.'}]},
  {videoId:'flight',title:'When hydraulic systems fail',channel:'Aviation Notes',chunks:[
    {start:60,text:'Losing hydraulic pressure makes it difficult to move the control surfaces. Some aircraft have redundant pumps or a mechanical backup for the flight controls.'}]},
  {videoId:'orb',title:'Survival challenge part seven',channel:'Gaming',chunks:[
    {start:88,text:'The secret item is called the Zyphron orb. Combine it with the purple key to open the locked chamber under the bridge.'}]},
  {videoId:'cafe',title:'Café workshop',channel:'Coffee',chunks:[
    {start:35,text:'At Café Lumière we grind coffee just before brewing. The burr grinder produces more evenly sized particles than a blade grinder.'}]},
  {videoId:'history',title:'Why ancient Roman concrete survives under seawater',channel:'History Archive',method:'history-title',chunks:[{start:0,text:'Why ancient Roman concrete survives under seawater'}]},
  {videoId:'japan',title:'京都の寺を歩く',channel:'Travel',method:'history-title',chunks:[{start:0,text:'京都の寺を歩く'}]},
];
export const queries = [
  ['why do rechargeable batteries lose capacity','battery',42],
  ['chemical reactions reduce energy storage after charging many times','battery',42],
  ['why an old phone holds less charge','battery',42],
  ['the explanation about lithium getting trapped','battery',42],
  ['does leaving a phone in a hot vehicle damage it','battery',180],
  ['"put it right there"','trap',72],
  ['pressure plate hidden pistons under gold blocks','trap',72],
  ['ssundee gold floor trap','trap',72],
  ['creeper explosion lost diamonds in the water','trap',260],
  ['rechargeable lunch box sandwich','picnic',15],
  ['painting a picnic table yellow','picnic',100],
  ['the boundary where even light cannot get out','space',20],
  ['astronaut stretched into spaghetti by gravity','space',140],
  ['how a black hole slowly evaporates','space',300],
  ['wash a car without scratching the paint','car',20],
  ['car microfiber mitt','car',20],
  ['dish soap on vehicle paint','car',150],
  ['turn carbon dioxide into rock underground','carbon',20],
  ['why cutting down trees releases carbon','carbon',140],
  ['stop carbonara eggs from becoming scrambled','pasta',30],
  ['use pasta water to make the sauce glossy','pasta',170],
  ['react state still shows the old value after setting it','react',10],
  ['useEffect cleanup duplicate event listeners','react',95],
  ['install fabric mods jar and api','fabric',50],
  ['Forge mods crashing with Fabric loader','fabric',210],
  ['prewash cotton before cutting a straight seam','sewing',25],
  ['plane losing hydraulic pressure backup flight controls','flight',60],
  ['"Zyphron orb" purple key','orb',88],
  ['cafe lumiere burr grinder','cafe',35],
  ['Why ancient Roman concrete survives under seawater','history',0],
  ['京都の寺','japan',0],
];
