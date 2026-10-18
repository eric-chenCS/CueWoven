// Same-topic retrieval set: every topic has three similar videos, and every query is
// answered by exactly one of them. Written before any ranker was tuned.
// Queries alternate between a tuning split ("dev") and a held-out split ("test").
// Query kinds: detail (paraphrased specific fact), term (rare literal word),
// channel (names the channel), facet (two facts from different moments of one video).
export const videos = [
  // Batteries
  {videoId:'bat-sei',title:'Why lithium batteries wear out',channel:'Lab Notes',chunks:[
    {start:30,text:'Every time you charge a lithium cell a thin film called the solid electrolyte interphase grows on the graphite anode. That layer consumes lithium, so the battery slowly loses capacity.'},
    {start:150,text:'Batteries also age while sitting on a shelf. This calendar aging depends on temperature and on how full the cell is kept, even if you never use it.'},
    {start:280,text:'Manufacturers usually call a battery worn out when it holds eighty percent of its original capacity. Below that point the decline often speeds up.'}]},
  {videoId:'bat-phone',title:'Make your phone battery last longer',channel:'Daily Tech',chunks:[
    {start:20,text:'Turn on optimized charging. The phone learns your routine and waits at eighty percent overnight, finishing the charge just before your alarm goes off.'},
    {start:110,text:'Heat is the biggest enemy of your battery. Never leave your phone on the dashboard of a hot car or charge it under a pillow.'},
    {start:230,text:'You do not need to drain the battery to zero anymore. Keeping it between twenty and eighty percent is gentler than full cycles.'}]},
  {videoId:'bat-ev',title:'How electric car batteries survive a decade',channel:'Motor Explained',chunks:[
    {start:45,text:'Electric cars pump liquid coolant through plates under the battery pack. Keeping the cells near room temperature is the main reason pack degradation stays low.'},
    {start:170,text:'Many newer models use lithium iron phosphate cells. LFP stores a bit less energy but survives thousands more charge cycles than nickel based chemistry.'},
    {start:300,text:'After ten years most packs still keep around eighty five percent of their range, and warranties usually cover eight years.'}]},
  // Black holes
  {videoId:'bh-tidal',title:'Falling into a black hole',channel:'Orbit Lab',chunks:[
    {start:25,text:'The event horizon is the point of no return. Once you cross it, every path forward in space leads toward the center.'},
    {start:140,text:'Near a small black hole the pull on your feet is much stronger than on your head. You get stretched like a noodle, which astronomers call spaghettification.'},
    {start:260,text:'Strangely, an astronaut falling into a supermassive black hole could cross the horizon without feeling anything special at all.'}]},
  {videoId:'bh-image',title:'How we photographed a black hole',channel:'Sky Signal',chunks:[
    {start:40,text:'No single telescope is big enough, so radio dishes from Hawaii to the South Pole observed together and acted like one telescope the size of the Earth.'},
    {start:160,text:'The first picture showed the black hole in the galaxy M87. Three years later the team imaged Sagittarius A star at the center of our own Milky Way.'},
    {start:290,text:'The bright orange ring is hot gas swirling around the black hole, and the dark center is its shadow against that glowing material.'}]},
  {videoId:'bh-hawking',title:'Do black holes last forever?',channel:'Quantum Corner',chunks:[
    {start:35,text:'Stephen Hawking showed that black holes should glow faintly because of quantum effects near the horizon. This Hawking radiation carries energy away.'},
    {start:150,text:'Losing energy means losing mass, so given an unimaginably long time a black hole evaporates completely and disappears.'},
    {start:270,text:'If the black hole vanishes, what happens to the information about everything that fell in? Physicists call this the information paradox.'}]},
  // Minecraft
  {videoId:'mc-farm',title:'Easy automatic sugar cane farm',channel:'Block Builder',chunks:[
    {start:30,text:'Place an observer facing the sugar cane. When the cane grows to the third block the observer fires and the piston breaks it.'},
    {start:120,text:'Run hoppers under the farm so the broken cane flows into a chest. Each module only needs one observer and one piston.'},
    {start:240,text:'This farm works best when you stay nearby, because crops only grow in loaded chunks around the player.'}]},
  {videoId:'mc-golem',title:'Iron farm for beginners',channel:'Redstone Rookie',chunks:[
    {start:40,text:'Iron golems spawn when villagers feel threatened. Put three villagers in beds and keep a zombie nearby so they panic.'},
    {start:150,text:'The golems spawn on the platform and walk into the lava blade, which kills them and drops iron ingots into hoppers.'},
    {start:270,text:'Name the zombie with a name tag or it will despawn and the villagers will stop spawning golems.'}]},
  {videoId:'mc-door',title:'Hidden two by two piston door',channel:'Block Builder',chunks:[
    {start:20,text:'This two by two door uses sticky pistons that pull the blocks back into the wall, so the entrance looks like a solid wall.'},
    {start:130,text:'Hide the pressure plate under a carpet in front of the door so guests do not notice the trigger.'},
    {start:250,text:'If the door gets stuck, check the redstone repeater delay. The top pistons need to fire one tick after the bottom ones.'}]},
  // Sourdough
  {videoId:'sd-starter',title:'Sourdough starter from scratch',channel:'Crumb Club',chunks:[
    {start:20,text:'Mix equal weights of flour and water in a jar. For the first week discard half and feed the starter every day at the same time.'},
    {start:140,text:'A healthy starter doubles within six hours of feeding and smells pleasantly sour, a bit like yogurt.'},
    {start:250,text:'If a grey liquid called hooch forms on top, the starter is hungry. Pour it off and feed it more often.'}]},
  {videoId:'sd-shape',title:'Shaping and scoring sourdough',channel:'Home Oven',chunks:[
    {start:30,text:'Pre shape the dough into a loose round, rest it for twenty minutes, then shape it tightly to build surface tension.'},
    {start:150,text:'Score the loaf with a razor blade at a shallow angle. That cut controls where the bread opens and creates the ear.'},
    {start:270,text:'Bake in a preheated dutch oven with the lid on. The trapped steam gives the dough a big oven spring.'}]},
  {videoId:'sd-fix',title:'Why is my sourdough gummy?',channel:'Crumb Club',chunks:[
    {start:25,text:'A dense gummy crumb usually means the dough was underproofed. Let the bulk ferment go until the dough has risen about fifty percent.'},
    {start:140,text:'Cutting the bread while it is hot also makes the crumb gummy. Wait at least an hour so the starches can set.'},
    {start:260,text:'Use the poke test. If the dent springs back slowly and only partly, the dough is ready to bake.'}]},
  // React
  {videoId:'re-state',title:'useState mistakes beginners make',channel:'Code School',chunks:[
    {start:15,text:'After you call setCount the variable does not change right away. It keeps the old value until the next render.'},
    {start:120,text:'Inside a timer callback you might read a stale value from an old render. Pass a function to the setter to update from the latest state.'},
    {start:230,text:'Never mutate an array in state with push. Create a new array so React notices the change and re renders.'}]},
  {videoId:'re-effect',title:'useEffect infinite loop fix',channel:'Frontend Fix',chunks:[
    {start:20,text:'If your effect sets state and has no dependency array, it runs after every render and creates an infinite loop.'},
    {start:130,text:'Objects created during render are new every time, so putting them in the dependency array makes the effect run again and again.'},
    {start:240,text:'Return a cleanup function to cancel the fetch with an AbortController when the component unmounts.'}]},
  {videoId:'re-rsc',title:'React Server Components explained',channel:'Code School',chunks:[
    {start:25,text:'Server components run only on the server, so they can read from the database directly and send no JavaScript to the browser.'},
    {start:140,text:'You cannot use useState or event handlers in a server component. Mark interactive parts with the use client directive.'},
    {start:250,text:'Because less JavaScript ships to the browser, pages built with server components can load noticeably faster.'}]},
  // Coffee
  {videoId:'cf-v60',title:'V60 pour over guide',channel:'Brew Bar',chunks:[
    {start:20,text:'Start with a bloom. Pour about twice the coffee weight in water and wait forty five seconds so the gas can escape.'},
    {start:130,text:'Pour in slow spirals and keep the water level steady. A total brew time around three minutes is a good target.'},
    {start:240,text:'If the coffee tastes sour, grind finer. If it tastes bitter and dry, grind coarser.'}]},
  {videoId:'cf-espresso',title:'Dialing in espresso',channel:'Brew Bar',chunks:[
    {start:25,text:'Use eighteen grams of coffee and aim for about thirty six grams of espresso in the cup. That is a one to two ratio.'},
    {start:140,text:'If the shot runs faster than twenty five seconds it will taste sour. Make the grind finer to slow it down.'},
    {start:250,text:'Channeling happens when water finds a weak spot in the puck. Distribute the grounds evenly before you tamp.'}]},
  {videoId:'cf-cold',title:'Cold brew at home',channel:'Kitchen Basics',chunks:[
    {start:20,text:'Use a coarse grind and a ratio of one part coffee to eight parts cold water. Steep it in the fridge for sixteen hours.'},
    {start:120,text:'Cold brew tastes smoother and less acidic because hot water extracts more of the sharp compounds.'},
    {start:220,text:'Strain it through a paper filter and keep the concentrate in the fridge for up to two weeks.'}]},
  // Running
  {videoId:'run-marathon',title:'First marathon training plan',channel:'Stride Coach',chunks:[
    {start:30,text:'Most of your miles should be easy enough that you can hold a conversation. Only about one day a week should be hard.'},
    {start:150,text:'Build your long run gradually until it reaches about twenty miles, three weeks before race day.'},
    {start:270,text:'Practice taking energy gels during long runs so your stomach is used to them on race day.'}]},
  {videoId:'run-shins',title:'How to stop shin splints',channel:'Run Physio',chunks:[
    {start:25,text:'Shin splints usually come from increasing mileage too quickly. Add no more than ten percent per week.'},
    {start:140,text:'Strengthen your calves with slow heel raises. Strong calves absorb impact that would otherwise hit the shin bone.'},
    {start:250,text:'Ice the sore area after runs and switch to cycling for a week if the pain gets sharp.'}]},
  {videoId:'run-shoes',title:'Are carbon plate shoes worth it?',channel:'Stride Coach',chunks:[
    {start:20,text:'Super shoes combine a stiff carbon fiber plate with a bouncy foam. Studies found they save about four percent of energy.'},
    {start:130,text:'The foam wears out faster than regular trainers, so save them for races and fast workouts.'},
    {start:240,text:'Beginners running slower paces get a smaller benefit, so a normal cushioned shoe is fine for easy runs.'}]},
  // Carbon removal
  {videoId:'co2-dac',title:'Sucking carbon out of the air',channel:'Earth Lab',chunks:[
    {start:30,text:'Direct air capture machines use giant fans to push air over a filter that grabs carbon dioxide.'},
    {start:150,text:'In Iceland the captured gas is dissolved in water and injected into basalt, where it turns into stone within two years.'},
    {start:270,text:'Right now removing a ton this way costs several hundred dollars, which is far too expensive at scale.'}]},
  {videoId:'co2-trees',title:'Can planting trees fix climate change?',channel:'Green Facts',chunks:[
    {start:25,text:'Young trees absorb very little carbon. It takes decades of growth before a forest stores large amounts.'},
    {start:140,text:'Planting the wrong species in grasslands can harm the ecosystem and even reduce how much carbon the soil holds.'},
    {start:250,text:'If a planted forest burns down in a wildfire, the stored carbon goes straight back into the atmosphere.'}]},
  {videoId:'co2-ocean',title:'Using the ocean to store carbon',channel:'Earth Lab',chunks:[
    {start:20,text:'Adding crushed minerals like olivine to seawater raises its alkalinity, so the ocean can absorb more carbon dioxide.'},
    {start:130,text:'Growing kelp and sinking it to the deep sea is another idea, but measuring how much carbon stays down is hard.'},
    {start:240,text:'Scientists worry about side effects on plankton, so trials so far have been small.'}]},
  // Personal finance
  {videoId:'fin-index',title:'Index funds explained',channel:'Money Plain',chunks:[
    {start:20,text:'An index fund simply buys every company in an index like the S and P five hundred instead of picking stocks.'},
    {start:130,text:'Look at the expense ratio. A fund charging one percent a year can cost you tens of thousands over decades compared with one charging point zero three.'},
    {start:240,text:'Most actively managed funds fail to beat their index after fees over fifteen years.'}]},
  {videoId:'fin-credit',title:'How to raise your credit score',channel:'Money Plain',chunks:[
    {start:25,text:'Payment history is the biggest factor. One payment that is thirty days late can stay on your report for seven years.'},
    {start:140,text:'Keep your credit utilization under thirty percent. Using less of your available limit raises your score.'},
    {start:250,text:'Do not close your oldest card, because the length of your credit history also matters.'}]},
  {videoId:'fin-roth',title:'Roth IRA versus traditional IRA',channel:'Retire Smart',chunks:[
    {start:30,text:'With a Roth you pay tax now and withdraw tax free in retirement. With a traditional account you get the deduction today.'},
    {start:150,text:'If you expect to be in a higher tax bracket later, the Roth usually wins.'},
    {start:260,text:'Roth contributions, but not the earnings, can be withdrawn at any time without penalty.'}]},
  // Rome
  {videoId:'rome-concrete',title:'Why Roman concrete lasts',channel:'History Archive',chunks:[
    {start:25,text:'Roman builders mixed volcanic ash with lime. In seawater the mixture grows new minerals that make harbor walls stronger over time.'},
    {start:140,text:'Researchers found small white chunks called lime clasts that heal cracks when water seeps in.'},
    {start:250,text:'Modern concrete cracks and its steel rebar rusts, which is why our piers rarely last a century.'}]},
  {videoId:'rome-aqueduct',title:'How Roman aqueducts worked',channel:'Ancient Engineering',chunks:[
    {start:20,text:'Aqueducts used only gravity. The channel dropped a few centimeters every hundred meters over many kilometers.'},
    {start:140,text:'Most of an aqueduct actually ran underground. The famous arches were only needed to cross valleys.'},
    {start:250,text:'Water reached public fountains and bathhouses first, and wealthy homes paid for private pipes made of lead.'}]},
  {videoId:'rome-fall',title:'Inflation and the fall of Rome',channel:'History Archive',chunks:[
    {start:30,text:'Emperors paid soldiers by minting more coins with less silver in them. The denarius eventually held almost no silver.'},
    {start:150,text:'Prices soared, so Diocletian issued an edict fixing maximum prices, which led to shortages and black markets.'},
    {start:270,text:'Historians still argue whether money troubles caused the collapse or were just a symptom of deeper problems.'}]},
  // Guitar
  {videoId:'gtr-barre',title:'Barre chords without pain',channel:'Fret Friend',chunks:[
    {start:20,text:'Roll your index finger slightly onto its bony side. The flat fleshy part tends to mute the strings.'},
    {start:130,text:'Use the weight of your arm pulling back instead of squeezing with your thumb. That saves your hand from cramping.'},
    {start:240,text:'Start with the F chord near the fifth fret where the string tension is lower, then move toward the nut.'}]},
  {videoId:'gtr-strings',title:'How to change acoustic guitar strings',channel:'Guitar Shop',chunks:[
    {start:25,text:'Push the bridge pins out with the notch in a string winder. Remove the old strings one at a time to keep tension on the neck.'},
    {start:140,text:'Leave about two inches of slack past the tuning post so you get two or three wraps around it.'},
    {start:250,text:'New strings stretch a lot. Gently pull each one away from the fretboard and retune several times.'}]},
  {videoId:'gtr-travis',title:'Travis picking for beginners',channel:'Fret Friend',chunks:[
    {start:20,text:'Your thumb alternates between two bass strings on every beat, like a steady heartbeat.'},
    {start:130,text:'Your index and middle fingers pluck the higher strings in between the thumb notes, which creates the rolling pattern.'},
    {start:240,text:'Practice the thumb alone until it is automatic before adding the fingers, or the rhythm falls apart.'}]},
  // Car maintenance
  {videoId:'car-oil',title:'Change your own oil',channel:'Garage',chunks:[
    {start:20,text:'Warm the engine for a few minutes so the oil drains faster, then remove the drain plug with the right size wrench.'},
    {start:130,text:'Rub a little fresh oil on the rubber gasket of the new filter and tighten it by hand only.'},
    {start:240,text:'Take the old oil to an auto parts store. Pouring it down a drain is illegal and pollutes groundwater.'}]},
  {videoId:'car-brakes',title:'Why are my brakes squealing?',channel:'Garage',chunks:[
    {start:25,text:'Many pads have a small metal tab called a wear indicator that squeals against the rotor when the pad is nearly gone.'},
    {start:140,text:'A grinding noise means metal on metal. The rotor is being damaged and needs replacement soon.'},
    {start:250,text:'Bed in new pads with several firm stops from moderate speed so material transfers evenly to the rotor.'}]},
  {videoId:'car-tires',title:'Tire care basics',channel:'Motor Explained',chunks:[
    {start:20,text:'Rotate your tires every five thousand miles so the front and rear wear evenly.'},
    {start:130,text:'Check pressure when the tires are cold. The correct number is on a sticker inside the driver door, not on the tire.'},
    {start:240,text:'Put a penny in the tread with the head upside down. If you can see the whole head, it is time for new tires.'}]},
];

// [query, expectedVideoId, expectedStart(s), kind]
const all = [
  // Batteries
  ['why does a thin film on the anode make batteries lose capacity','bat-sei',30,'detail'],
  ['batteries degrade even when stored unused on a shelf','bat-sei',150,'detail'],
  ['phone waits at 80 percent overnight before my alarm','bat-phone',20,'detail'],
  ['don\'t leave the phone on the car dashboard in the heat','bat-phone',110,'detail'],
  ['liquid coolant plates under the electric car battery','bat-ev',45,'detail'],
  ['LFP lithium iron phosphate cycles','bat-ev',170,'term'],
  ['the Motor Explained video on battery degradation','bat-ev',[45,170,300],'channel'],
  ['the Daily Tech battery tips video','bat-phone',[20,110,230],'channel'],
  ['battery video that mentioned shelf aging and the 80 percent end of life','bat-sei',[150,280],'facet'],
  // Black holes
  ['stretched like a noodle near a small black hole','bh-tidal',140,'detail'],
  ['crossing the horizon of a supermassive black hole without noticing','bh-tidal',260,'detail'],
  ['radio telescopes around the world combined into an earth sized telescope','bh-image',40,'detail'],
  ['picture of Sagittarius A star in the Milky Way','bh-image',160,'term'],
  ['black holes slowly evaporate over time','bh-hawking',150,'detail'],
  ['what happens to information that falls into a black hole','bh-hawking',270,'detail'],
  ['the Sky Signal black hole video','bh-image',[40,160,290],'channel'],
  ['black hole video with Hawking glow and the information paradox','bh-hawking',[35,270],'facet'],
  // Minecraft
  ['observer breaks the sugar cane when it grows','mc-farm',30,'detail'],
  ['villagers panic because of a zombie so golems spawn','mc-golem',40,'detail'],
  ['lava blade kills the iron golems','mc-golem',150,'detail'],
  ['name tag the zombie so it does not despawn','mc-golem',270,'detail'],
  ['pressure plate hidden under carpet in front of the door','mc-door',130,'detail'],
  ['repeater delay when the piston door gets stuck','mc-door',250,'detail'],
  ['Redstone Rookie farm tutorial','mc-golem',[40,150,270],'channel'],
  ['Block Builder farm with hoppers into a chest','mc-farm',120,'channel'],
  // Sourdough
  ['feed the starter equal flour and water and discard half','sd-starter',20,'detail'],
  ['grey liquid hooch on top of my starter','sd-starter',250,'term'],
  ['score the loaf with a razor to get an ear','sd-shape',150,'detail'],
  ['steam in the dutch oven for oven spring','sd-shape',270,'detail'],
  ['my bread is dense and gummy because it was underproofed','sd-fix',25,'detail'],
  ['don\'t cut sourdough while it is still hot','sd-fix',140,'detail'],
  ['the Home Oven sourdough video','sd-shape',[30,150,270],'channel'],
  ['Crumb Club video about the poke test','sd-fix',260,'channel'],
  // React
  ['state variable still has the old value right after calling the setter','re-state',15,'detail'],
  ['stale value inside a timer callback use an updater function','re-state',120,'detail'],
  ['effect with no dependency array causes an infinite loop','re-effect',20,'detail'],
  ['cancel fetch with AbortController on unmount','re-effect',240,'term'],
  ['components that read the database directly and ship no javascript','re-rsc',25,'detail'],
  ['use client directive for interactive parts','re-rsc',140,'term'],
  ['the Frontend Fix react video','re-effect',[20,130,240],'channel'],
  ['react video about not pushing into arrays and stale timers','re-state',[120,230],'facet'],
  // Coffee
  ['bloom with twice the coffee weight for 45 seconds','cf-v60',20,'detail'],
  ['pour in slow spirals for a three minute brew','cf-v60',130,'detail'],
  ['18 grams in 36 grams out ratio','cf-espresso',25,'detail'],
  ['water finds a weak spot in the puck','cf-espresso',250,'detail'],
  ['steep coarse coffee in the fridge for 16 hours','cf-cold',20,'detail'],
  ['why cold brew is less acidic','cf-cold',120,'detail'],
  ['the Kitchen Basics coffee video','cf-cold',[20,120,220],'channel'],
  ['Brew Bar video where the shot runs too fast and tastes sour','cf-espresso',140,'channel'],
  // Running
  ['easy runs at conversation pace with one hard day','run-marathon',30,'detail'],
  ['long run up to twenty miles three weeks before the race','run-marathon',150,'detail'],
  ['practice energy gels during long runs','run-marathon',270,'detail'],
  ['heel raises to strengthen calves for shin pain','run-shins',140,'detail'],
  ['only increase mileage ten percent per week','run-shins',25,'detail'],
  ['carbon plate super shoes save four percent energy','run-shoes',20,'detail'],
  ['the Run Physio video','run-shins',[25,140,250],'channel'],
  ['Stride Coach shoe foam wears out quickly','run-shoes',130,'channel'],
  // Carbon removal
  ['giant fans push air through a carbon dioxide filter','co2-dac',30,'detail'],
  ['CO2 injected into basalt in Iceland turns into stone','co2-dac',150,'detail'],
  ['young trees absorb very little carbon','co2-trees',25,'detail'],
  ['forest fire releases the carbon back','co2-trees',250,'detail'],
  ['olivine raises seawater alkalinity','co2-ocean',20,'term'],
  ['sinking kelp to the deep sea','co2-ocean',130,'detail'],
  ['the Green Facts climate video','co2-trees',[25,140,250],'channel'],
  ['Earth Lab video about side effects on plankton','co2-ocean',240,'channel'],
  // Finance
  ['fund that buys every company in the S&P 500','fin-index',20,'detail'],
  ['expense ratio of one percent costs thousands over decades','fin-index',130,'detail'],
  ['one late payment stays on your report seven years','fin-credit',25,'detail'],
  ['keep credit utilization under 30 percent','fin-credit',140,'detail'],
  ['pay tax now and withdraw tax free in retirement','fin-roth',30,'detail'],
  ['higher tax bracket later so the Roth wins','fin-roth',150,'detail'],
  ['the Retire Smart video','fin-roth',[30,150,260],'channel'],
  ['Money Plain video about not closing your oldest card','fin-credit',250,'channel'],
  // Rome
  ['volcanic ash and lime harbor walls get stronger in seawater','rome-concrete',25,'detail'],
  ['lime clasts heal cracks','rome-concrete',140,'term'],
  ['aqueducts dropped a few centimeters every hundred meters','rome-aqueduct',20,'detail'],
  ['most aqueducts ran underground and arches crossed valleys','rome-aqueduct',140,'detail'],
  ['emperors put less silver in the denarius','rome-fall',30,'detail'],
  ['Diocletian price edict caused shortages','rome-fall',150,'term'],
  ['the Ancient Engineering video','rome-aqueduct',[20,140,250],'channel'],
  ['History Archive video on whether money caused the collapse','rome-fall',270,'channel'],
  // Guitar
  ['roll your index finger onto the bony side for barre chords','gtr-barre',20,'detail'],
  ['use arm weight instead of squeezing with the thumb','gtr-barre',130,'detail'],
  ['push the bridge pins out with a string winder','gtr-strings',25,'detail'],
  ['leave two inches of slack past the tuning post','gtr-strings',140,'detail'],
  ['thumb alternates between bass strings like a heartbeat','gtr-travis',20,'detail'],
  ['practice the thumb alone before adding fingers','gtr-travis',240,'detail'],
  ['the Guitar Shop video','gtr-strings',[25,140,250],'channel'],
  ['Fret Friend video about starting at the fifth fret','gtr-barre',240,'channel'],
  // Cars
  ['warm the engine so the oil drains faster','car-oil',20,'detail'],
  ['put fresh oil on the filter gasket and hand tighten','car-oil',130,'detail'],
  ['metal wear indicator tab squeals on the rotor','car-brakes',25,'detail'],
  ['grinding noise means metal on metal','car-brakes',140,'detail'],
  ['penny test for tire tread','car-tires',240,'detail'],
  ['tire pressure sticker inside the driver door','car-tires',130,'detail'],
  ['Motor Explained tire rotation video','car-tires',20,'channel'],
  ['Garage video about bedding in new pads','car-brakes',250,'channel'],
];


// Gist queries: the user remembers what a video was about, not a specific sentence.
// Any moment from the expected video counts. Added after the detail queries, before measuring them.
const gist = [
  ['video about making a phone battery last longer','bat-phone'],
  ['how long electric car batteries last','bat-ev'],
  ['how they took the first photo of a black hole','bh-image'],
  ['do black holes die eventually','bh-hawking'],
  ['minecraft iron farm tutorial','mc-golem'],
  ['secret door in minecraft','mc-door'],
  ['how to make a sourdough starter','sd-starter'],
  ['fixing gummy sourdough bread','sd-fix'],
  ['what are react server components','re-rsc'],
  ['useEffect running in an infinite loop','re-effect'],
  ['how to make cold brew coffee','cf-cold'],
  ['espresso tutorial','cf-espresso'],
  ['training for my first marathon','run-marathon'],
  ['are carbon running shoes worth the money','run-shoes'],
  ['does planting trees help climate change','co2-trees'],
  ['storing carbon in the ocean','co2-ocean'],
  ['what is an index fund','fin-index'],
  ['roth or traditional retirement account','fin-roth'],
  ['how roman aqueducts carried water','rome-aqueduct'],
  ['roman inflation and coins','rome-fall'],
  ['how to restring an acoustic guitar','gtr-strings'],
  ['travis picking lesson','gtr-travis'],
  ['why my brakes squeak','car-brakes'],
  ['changing the oil myself','car-oil'],
];

const gistQueries = gist.map(([query, videoId], i) => ({query, videoId, starts: videos.find(v => v.videoId === videoId).chunks.map(c => c.start), kind: 'gist', split: i % 2 ? 'test' : 'dev'}));
export const queries = [...all.map(([query, videoId, start, kind], i) => ({query, videoId, starts: [].concat(start), kind, split: i % 2 ? 'test' : 'dev'})), ...gistQueries];
