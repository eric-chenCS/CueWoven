// Frozen before any model fitting or evaluating this corpus. All topics and videos
// are excluded from training and tuning. Authored cases are not real usage logs.
const records = [
['knot-load','Working with a rope','Line Notes',[
'A bowline makes a fixed loop that does not tighten around the object under steady load. The tail should be long enough and the knot dressed neatly.',
'An unloaded bowline can shake loose under repeated movement. Use a suitable backup and inspect it rather than assuming that a familiar name guarantees security.'
],['the rope loop stays the same size when you pull it','the familiar loop can come undone when it keeps going slack','the person said to leave a tail and tidy the knot','that rope thing doesnt squeeze tighter around the object','the loop needs checking because repeated shaking can loosen it']],
['knot-slip','A loop for moving things','Line Notes',[
'A running loop slides along the standing rope and closes as tension increases. That differs from a fixed loop which keeps its opening.',
'A sliding knot may jam after a heavy pull. Do not use a tightening loop where constriction would damage the object being held.'
],['the rope opening gets smaller the harder you pull','the sliding loop gets stuck after being loaded','the knot could crush what it is holding','the rope video where the loop moves instead of staying fixed','the tightening loop shouldnt go around something fragile']],
['bird-stars','Travelling at night','Wing Journal',[
'Young night-migrating birds can learn the pattern of stars rotating around the celestial pole. Experiments with artificial skies separate rotation cues from individual bright stars.',
'A cloudy sky removes that visual reference, but birds may also use magnetic and landscape information. They do not depend on a single navigational sense.'
],['the birds learned where to go by how the sky turns','the fake night sky experiment changed the rotating pattern','the flying animals dont just follow one bright star','the bird can use other clues when clouds hide the sky','the migration clip involving a pretend sky and a pole']],
['bird-magnets','An invisible directional clue','Wing Journal',[
'Some migrating birds respond to the inclination of the magnetic field rather than reading north exactly as a pocket compass does.',
'Changing an experimental magnetic field can alter the direction a bird attempts to travel. The mechanisms of magnetoreception remain an active research area.'
],['the bird reacts to the tilt of an invisible field','the experiment changed a field and the bird tried another direction','the bird compass doesnt work exactly like the one in your pocket','the migration video says researchers are still figuring out the sensing mechanism','the animal finds direction with magnetism rather than just stars']],
['sew-tension','Two threads meeting','Stitch Diary',[
'A sewing machine forms a lockstitch by joining the upper thread with the bobbin thread. Balanced tension puts their meeting point inside the fabric.',
'Loops underneath can come from an incorrectly threaded upper path. Rethread with the presser foot raised before turning every tension dial.'
],['the sewing loops underneath were caused by the thread on top','lift the little foot before threading the machine again','the two threads should meet inside the cloth','the sewing person said dont immediately start changing all the knobs','the underside loops didnt necessarily mean the lower spool was wrong']],
['sew-needle','A small part making holes','Stitch Diary',[
'A ballpoint needle pushes between knitted fibres rather than cutting them. A sharp needle is useful for many tightly woven fabrics.',
'Skipped stitches can result from a bent or unsuitable needle. Replace that inexpensive part before assuming the machine needs a major repair.'
],['the sewing needle pushes the loops aside instead of slicing them','the stitches kept missing because a little metal part was bent','try changing the cheap needle before repairing the whole machine','the stretchy material needs a rounded point','the needle for knit cloth differs from one for tightly woven cloth']],
['clay-air','Inside the pot','Kiln Notebook',[
'Thick clay needs time to dry all the way through before firing. Trapped water turning into steam can damage a piece even when its surface feels dry.',
'A slow initial heating stage helps remaining moisture escape. An air pocket alone is not the whole explanation for a pot breaking in the kiln.'
],['the pottery felt dry outside but still had water inside','the broken pot wasnt simply caused by a bubble of air','heat the clay slowly at first so moisture can leave','the thick clay took longer than its surface suggested','the kiln video blaming steam trapped inside the piece']],
['clay-glaze','A coating after firing','Kiln Notebook',[
'Glaze can run farther down a pot when it becomes fluid in the kiln. Leave the foot clean so molten glaze does not glue the piece to the shelf.',
'Small test tiles help reveal how a glaze behaves at a particular firing temperature. A colour in the bucket does not predict the final fired colour reliably.'
],['the wet coating colour doesnt tell you what the finished pot looks like','the pot stuck to the kiln shelf because the coating ran','keep the bottom edge clean before firing','test a small clay sample before coating the whole thing','the pottery finish gets runny when it is hot']],
['wood-move','A panel across the seasons','Grain Workshop',[
'Solid wood expands and contracts mostly across the grain as humidity changes. A wide tabletop needs a fixing that allows this movement.',
'Screwing the whole panel rigidly across its width can cause cracks. Slotted holes or appropriate clips let the top move while remaining attached.'
],['the wooden table split because its top couldnt move','the screws need room to slide when humidity changes','wood changes size more across its lines than along them','the maker used slots so the table could swell without breaking','the tabletop should stay attached but still be able to shift']],
['wood-glue','Joining two boards','Grain Workshop',[
'A good edge glue joint needs surfaces that meet without large gaps. More clamp force cannot make badly matched edges into a sound fit.',
'Spread a suitable amount of glue and clamp evenly. Squeezing as hard as possible can distort a thin panel rather than improving its alignment.'
],['the clamps wouldnt fix the gap between badly fitting boards','pressing the wood harder made the thin panel bend','the glue joint needs matching surfaces first','the woodworking person says extra force doesnt replace a good fit','spread the glue evenly instead of crushing the panel']],
['print-rgb','Light and a screen','Colour Press',[
'A screen creates colours by adding red, green and blue light. Combining light works differently from mixing inks that absorb parts of the illumination.',
'A vivid monitor colour may lie outside the colours a particular printer and paper can reproduce. A screen preview is not a guarantee of the printed result.'
],['the bright colour on my display couldnt be printed on the paper','adding coloured light works differently from mixing paint','the screen combines three kinds of light','the monitor preview promised a colour the printer couldnt make','the colours on the display and printed page have different limits']],
['print-black','Dark text on paper','Colour Press',[
'Small black text is often printed using only black ink to avoid coloured fringes when several plates are slightly misaligned.',
'A large dark area may use a richer mixture of inks depending on the print process. The mixture appropriate for a broad background is not necessarily suitable for tiny lettering.'
],['the little black letters got coloured edges when the plates didnt line up','use only the dark ink for tiny text','the dark background uses a different ink recipe than small words','the printing person says not to make all black areas the same way','the fine lettering shouldnt depend on several perfectly aligned plates']],
['sail-current','Moving water at the harbour','Harbour Log',[
'The time of high water is not always the time when tidal current stops. Slack water may happen earlier or later depending on the location.',
'A tide height table alone does not describe the speed and direction of the flow in a narrow channel. Consult information for the actual passage.'
],['the water being highest doesnt mean it stopped moving','the harbour current can still run at high tide','the height chart didnt tell you how fast the channel flows','the boat person says slack water happens at a different time locally','the passage needs current information as well as the tide height']],
['sail-wind','A turning sail','Harbour Log',[
'During an accidental gybe the stern passes through the wind and the boom can swing rapidly across the cockpit.',
'Crew should stay clear of the boom and understand the planned turn. A controlled manoeuvre and suitable precautions reduce the chance of someone being struck.'
],['the pole swept across the boat when its rear crossed the wind','the sailors had to keep their heads clear during the turn','the unexpected turn made the sail swing across quickly','the boat video about the boom hitting someone in the cockpit','the person explained why the crew needs to know the turn is coming']],
['vinyl-groove','Following a spiral','Record Bench',[
'A stylus follows a record groove and its motion is converted into an electrical signal. Dirt in the groove can produce clicks and interfere with that motion.',
'A carbon fibre brush can remove loose surface dust, while deeper contamination may need suitable wet cleaning. Pressing the needle harder is not a cleaning method.'
],['the little record needle turns movement into electricity','the pops came from dirt in the spiral','pushing the needle down wont clean the record','the brush gets the loose dust but deeper muck needs more work','the music disc crackled because the groove was dirty']],
['vinyl-inner','Toward the centre','Record Bench',[
'The groove moves past the stylus more slowly near the centre at a fixed rotation rate. Complex high frequency passages can be harder to track there.',
'Cartridge alignment and stylus condition affect inner groove distortion. Turning up the amplifier does not correct a tracking geometry problem.'
],['the record sounded rougher near the middle of the disc','the needle passes less groove each second as it gets inward','turning the music louder wont fix how the needle tracks','the cartridge needed lining up because the last song was distorted','the high notes were harder to follow near the record centre']],
['compost-air','A heap that smells','Garden Cycle',[
'A compost heap that is saturated and compacted loses air spaces. Anaerobic conditions can make it smell unpleasant rather than pleasantly earthy.',
'Mix in dry coarse material and loosen the heap to restore air. Adding more water to an already soggy heap generally worsens the problem.'
],['the garden heap stank because it was too wet and packed down','put dry chunky stuff into the soggy compost','the rotting pile needed air rather than more water','the person loosened the heap to stop the bad smell','the compost was waterlogged so the spaces for air disappeared']],
['compost-heat','Warmth in a pile','Garden Cycle',[
'Microbes release heat as they break down a balanced mix of compost ingredients. A very small heap loses heat faster than a larger well built pile.',
'Turning mixes outer material into the warmer centre, but excessive disturbance can also cool the pile. Temperature depends on more than simply how often it is turned.'
],['the tiny compost pile couldnt keep its heat','the warmth came from microbes eating the material','turning the heap too much can cool it down','move the outside material into the warmer middle','the garden video says constant stirring isnt the only answer']],
['gps-delay','Time signals from above','Orbit Desk',[
'A satellite receiver estimates distance from how long a radio signal took to arrive. Signals from several satellites help solve both position and receiver clock error.',
'A phone clock is not accurate enough to treat its timing error as zero. The receiver estimates that offset alongside the location rather than requiring an atomic clock in every phone.'
],['the phone doesnt need its own atomic clock to find where it is','the satellites help solve the receivers clock mistake as well as its position','the navigation box measures how long a signal travels','the location calculation includes an extra unknown for the time offset','the satellite timing video says the mobile clock error cant just be ignored']],
['gps-bounce','A position between tall buildings','Orbit Desk',[
'Radio signals can reflect from buildings before reaching a satellite navigation receiver. That extra travel path can make the apparent distance too large.',
'A clear view of the sky helps reduce multipath problems. More digits on the displayed coordinates do not guarantee a more accurate position.'
],['the map put me in the wrong place because signals bounced off buildings','the extra path made the satellite seem farther away','the location has lots of decimal places but can still be wrong','the city towers reflected the signal before it reached the phone','the navigation device needs a clearer view upward']],
['mushroom-spawn','A clean beginning','Fungi Notebook',[
'Growing mushroom mycelium on prepared substrate begins with clean spawn. Competing mould can colonise the food before the desired fungus becomes established.',
'A jar with unexpected green growth should not be mixed into an otherwise healthy batch. More inoculant does not make contamination disappear.'
],['the green stuff in the jar shouldnt get mixed into the healthy mushroom batch','the unwanted mould got to the food before the mushroom did','adding more starter wont fix a contaminated jar','the fungus needs a clean start so another organism doesnt win','the mushroom grower kept the suspicious jar separate']],
['mushroom-fruit','From white threads to caps','Fungi Notebook',[
'A fully colonised mushroom block can still fail to make good fruiting bodies if fresh air and humidity are poorly balanced.',
'Long stems and tiny caps may indicate excess carbon dioxide around the growing mushrooms. Fresh air matters even when the block is already covered in white mycelium.'
],['the mushrooms grew long stalks with little caps because the air was stale','the block was all white but still needed the right conditions to make mushrooms','the grower needed fresh air as well as dampness','the fungus had colonised everything but the fruiting conditions were wrong','the mushroom shapes suggested too much gas trapped around them']],
['wind-feather','A blade in strong weather','Turbine Journal',[
'Pitch control rotates a wind turbine blade around its long axis to change how much force it extracts from the airflow.',
'In strong wind the blades can turn toward a feathered position to reduce aerodynamic loading. More wind does not always mean the turbine should take as much power as possible.'
],['the windmill twists its blades to catch less wind in a storm','the blades rotate along their own length to change the load','the turbine deliberately stops taking maximum power when the wind gets strong','the feather position reduces the force on the machine','the wind energy clip where stronger weather makes it back off']],
['wind-wake','Behind another machine','Turbine Journal',[
'A turbine removes energy from the air and leaves a slower turbulent wake behind it. A machine directly downwind may therefore produce less electricity.',
'Wind farm spacing and steering strategies account for wakes. Packing more turbines into the same small area does not guarantee proportionally more output.'
],['the windmill behind another one gets messy slower air','putting more machines close together didnt add as much power as expected','the upstream turbine leaves a trail that hurts the one behind','the wind farm layout needed space because of wakes','the first machine takes energy out before the wind reaches the next one']]
];
export const videos=records.map(([videoId,title,channel,texts])=>({videoId:'h-'+videoId,title,channel,chunks:texts.map((text,i)=>({start:i*30,text}))}));
const cases=records.flatMap(([id,,,texts,qs])=>qs.map(query=>({query,group:'holdout-authored',expected:['h-'+id]})));
// One additional conversational or misspelled case per video, always same split.
for(const [i,r] of records.entries())cases.push({query:i%2?`i forgot the name but ${r[4][2]}`:`that vid where ${r[4][3].replace(/\b[a-z]{8,}\b/i,w=>w.slice(0,3)+w[4]+w[3]+w.slice(5))}`,group:'holdout-variant',expected:['h-'+r[0]]});
for(const query of ['why volcanoes form island chains','the polar bear hunting seals','how to fold an origami crane','crochet a wool scarf','writing a detective novel','how violin bows are made','ancient Egyptian hieroglyphs','how bees communicate directions','learning Japanese writing','the history of chess openings','penguins raising chicks','satellite weather forecasting','training a puppy to stay','the rules of cricket scoring','restoring an antique pocket watch','why diamonds form deep underground'])cases.push({query,group:'holdout-absent',expected:[]});
export const queries=cases;
if(videos.length!==24||queries.length!==160)throw Error('Holdout count changed');
