// Frozen before query-normalization experiments. 80 new authored queries and
// 40 typo/conversational variants. Used to reject prefix cleanup and validate
// the predefined comparative-only alternative; not an untouched final holdout.
const records=[
['wifi-room','Why the bedroom signal drops','Signal Desk',[
'Radio waves have trouble passing through reinforced concrete. Moving the router out of the cupboard into the hallway can improve the distant bedroom connection.',
'A mesh node needs a decent link back to the main router. Put it halfway to the dead zone, not in the room where there is already no signal.'
],['the internet box hidden in a cupboard couldnt reach the bedroom','the wireless repeater should go partway to the room rather than in the dead spot','the connection problem caused by steel inside the walls','the wireless advice about opening up the router location and placing the extra node between rooms']],
['wifi-band','Choosing a Wi-Fi frequency','Signal Desk',[
'The five gigahertz band is faster nearby but loses strength through walls. Two point four gigahertz travels farther but shares airspace with many household devices.',
'If a microwave makes the connection stutter, move onto the five gigahertz network. That avoids the crowded two point four gigahertz band.'
],['the internet cuts out whenever someone heats their lunch','the faster wireless band doesnt reach as far through the house','the slower frequency goes further but competes with household gadgets','the wireless video explaining both microwave interference and the distance tradeoff']],
['rice-rest','Separate fluffy grains','Kitchen Practice',[
'After cooking rice, take the pan off the heat and leave the lid closed for ten minutes. This lets moisture spread evenly rather than collecting at the bottom.',
'Fluff the grains gently with a fork after resting. Stirring vigorously while hot breaks the grains and makes them glue together.'
],['the cooked rice needs to sit covered before you touch it','dont beat up the hot grains or they turn into glue','the cooking clip about waiting after switching the heat off then using a fork','the rice tip about giving trapped moisture time to spread out']],
['rice-wash','Before the rice goes in the pan','Kitchen Practice',[
'Rinse uncooked rice in cool water and pour the cloudy water away. Repeating this removes loose surface starch before cooking.',
'Use your fingertips gently. Do not scrub until the grains break. The water need not become perfectly clear, especially for enriched rice.'
],['the rice video where you pour away the cloudy water before heating it','wash off the powder on the outside of the uncooked grains','the kitchen advice says not to scrub the rice into bits','the rice water doesnt have to be completely transparent before cooking']],
['plant-water','A thirsty-looking plant','Leaf Notebook',[
'A drooping plant is not always thirsty. Roots sitting in water cannot get oxygen, and the leaves wilt even though the soil is wet.',
'Check the soil below the surface and make sure the pot has drainage holes. Adding more water to already wet compost makes root rot worse.'
],['the sad plant looked thirsty but giving it more water made it worse','the pot needs holes because the roots can suffocate','the droopy leaves were caused by soaking roots rather than dryness','the gardening person says to feel deeper in the pot before watering']],
['plant-light','A plant leaning sideways','Leaf Notebook',[
'Long pale stems and widely spaced leaves usually mean a houseplant is searching for light. Move it closer to a bright window gradually.',
'Rotate the pot a quarter turn every week so the stems do not lean toward only one side. Sudden direct midday sun can scorch leaves grown in shade.'
],['the plant grew long skinny stems because it was reaching for the window','turn the flowerpot a little each week so it doesnt grow crooked','the houseplant needs more brightness but moving straight into harsh sun burns it','the leaf video about stretched stems and rotating the container']],
['photo-motion','Freezing a running dog','Frame Workshop',[
'A fast shutter speed freezes a moving dog. If the subject is blurred while the fence behind it is sharp, the shutter was open too long.',
'Raise ISO when a shorter exposure makes the picture too dark. Some extra grain is better than an unrecognizable blur of the animal.'
],['the moving pet is blurry but the fence looks crisp','the camera needs to take the picture faster even if that adds grain','the dog photograph was ruined because the exposure lasted too long','the photographer would rather have a noisy image than a smeared animal']],
['photo-focus','Finding the nearest eye','Frame Workshop',[
'A wide aperture gives a thin zone of sharpness. Focus on the eye nearest the camera rather than the nose when taking a close portrait.',
'If both eyes need to be sharp, use a smaller aperture or turn the face so both eyes lie about the same distance from the camera.'
],['the nose was sharp but the persons eyes were soft','the portrait needs the closer eye in focus','make the sharp area deeper if you want both eyes clear','the face should turn until both eyes are the same distance from the lens']],
['sleep-caffeine','Why bedtime feels later','Rest Notes',[
'Caffeine blocks the signals that tell your brain you have been awake a long time. It can still be active hours after an afternoon coffee.',
'Feeling able to fall asleep does not mean caffeine has no effect on sleep quality. Try moving the last caffeinated drink earlier rather than only reducing the bedtime cup.'
],['the afternoon coffee can still affect you when its time for bed','being able to nod off doesnt prove the stimulant left your system','the sleep person says to move the last coffee earlier','the drink hides the brains tiredness signals instead of removing the need for rest']],
['sleep-clock','Light and the morning routine','Rest Notes',[
'Outdoor light after waking helps set the body clock. Even on an overcast morning, daylight is usually brighter than ordinary room lighting.',
'Keep the wake time fairly steady across the week. Sleeping very late at weekends can shift the clock and make Monday morning feel like a flight across time zones.'
],['sleeping in on weekends gives you something like jet lag on Monday','the morning light outdoors helps your internal schedule even if its cloudy','the sleep routine is more about a consistent waking hour','the person says go outside after waking instead of relying on indoor lights']],
['trip-bag','When the airline takes your cabin bag','Travel Small',[
'A full flight can run out of space in the overhead lockers. If the airline checks your cabin bag at the gate, take out medication, documents and spare lithium batteries first.',
'Power banks must stay with you in the cabin rather than travelling in checked luggage. Keep essential items in a small pouch that is easy to remove.'
],['they took the small suitcase at the gate so you should remove your battery pack','keep the pills and paperwork in a pouch you can pull out fast','the airport advice about what comes out when the overhead bins are full','the portable phone charger shouldnt go underneath with the checked suitcases']],
['trip-liquid','Packing toiletries for screening','Travel Small',[
'The container size matters at airport liquid screening, not just how much is left inside. A large nearly empty bottle can still be rejected.',
'Use small refillable bottles and put them in the required transparent bag for the airport you use. Rules can vary, so check your departure airport before packing.'
],['the nearly empty shampoo bottle was still too large for the security check','the bottle capacity matters even when theres almost nothing left','the travel person recommends little refillable containers in a clear bag','check the departure airport before assuming the toiletries rules are the same']],
['learn-recall','Remembering without rereading','Study Sketch',[
'Close the textbook and try to explain the idea from memory. The struggle to retrieve it strengthens learning more than simply looking over the page again.',
'Check what you missed after attempting an answer. A wrong attempt followed by feedback can be useful; guessing without ever checking is not the goal.'
],['the study method where you shut the book and explain it without looking','struggling to remember the answer is part of the useful practice','the learning advice says to check your mistake after trying from memory','the student should try recalling first instead of reading the same page again']],
['learn-space','Spacing the study sessions','Study Sketch',[
'Spread practice across several days instead of doing every repetition in one evening. A gap that makes recall a little difficult can improve retention.',
'Review the difficult items sooner and let familiar items wait longer. Equal intervals for everything waste time on material you already know well.'
],['the study video says dont cram every repetition into one night','leave a gap long enough that remembering takes some effort','review the difficult flashcards sooner than the familiar ones','the learning schedule spreads work over days and gives harder items shorter gaps']],
['bike-chain','The squeak after a wet ride','Workshop Ride',[
'After riding in rain, dry the bicycle chain and apply lubricant to the rollers. Wipe the outside afterward so extra oil does not collect grit.',
'More lubricant is not always better. A shiny wet coating on the outside attracts dirt, which turns into an abrasive paste around the moving parts.'
],['the bike chain needs oil inside but the outside should be wiped dry','leaving loads of shiny grease on the bicycle attracts abrasive dirt','the squeaky bicycle after the rain needs drying before lubrication','the bike advice says extra oil can make a grinding paste with grit']],
['bike-shift','A gear that keeps clicking','Workshop Ride',[
'If a bicycle hesitates when shifting onto a larger rear sprocket, a small increase in cable tension may help. Turn the barrel adjuster a little, then test one gear change.',
'A bent derailleur hanger can cause poor shifting across several gears. Cable adjustment alone will not straighten a damaged hanger after a crash.'
],['the bike keeps clicking between gears after the part at the back got bent','the bicycle needs a little more cable pull to climb to the bigger cog','turn the little cable adjuster in small steps and try the shift again','the shifting problem after a crash wont be fixed just by tightening the cable']],
['bread-freeze','Keeping a loaf for next week','Food Drawer',[
'Slice bread before freezing it so you can remove only what you need. Toast individual slices straight from frozen instead of thawing the entire loaf repeatedly.',
'Squeeze excess air from the bag to reduce freezer burn. Storing bread in the refrigerator often makes it stale faster than keeping it frozen.'
],['cut the loaf before putting it in the freezer so you can take one piece','the fridge actually makes the bread go stale faster','toast a frozen slice without thawing the whole loaf','the bread storage tip includes pushing air out of the bag before freezing']],
['bread-refresh','Bringing a crusty loaf back','Food Drawer',[
'A stale crusty loaf can be refreshed briefly with a little surface water and a hot oven. Heat softens the hardened starch structure for a short time.',
'Eat the reheated loaf soon because the improvement is temporary. This does not make moldy bread safe; discard bread with visible mold.'
],['the old crusty loaf gets a little water before going back in the oven','warming the stale bread only improves it temporarily','the bread trick is for staleness and doesnt rescue visible mold','the person refreshes a hard loaf but says to eat it soon']],
['clean-vinegar','The counter cleaning mistake','Home Bench',[
'Acidic cleaners such as vinegar can etch marble and other calcium-based stone. The dull patch is damaged stone rather than a stain you can simply wipe away.',
'Use a stone-safe cleaner instead. Test unfamiliar products in a hidden area before spreading them over the whole countertop.'
],['the vinegar left a dull mark because it ate into the stone','the kitchen counter was damaged by an acidic cleaning product','the cleaning person says a cloudy marble patch isnt just dirt','try the unfamiliar cleaner somewhere hidden before using it on all the stone']],
['clean-soap','A window full of streaks','Home Bench',[
'Too much detergent leaves a film on glass. Use a small amount and remove the dirty solution with a clean squeegee rather than allowing it to dry on the pane.',
'Direct hot sunshine dries the cleaner before you can wipe it off. Work in shade and wipe the squeegee edge between passes.'
],['the windows look streaky because too much soap was left on them','clean the glass out of direct sun so it doesnt dry too fast','wipe the rubber blade between strokes across the window','the glass cleaning advice says less detergent and dont let the dirty liquid dry']]
];
export const videos=records.map(([videoId,title,channel,paragraphs])=>({videoId,title,channel,chunks:paragraphs.map((text,i)=>({start:30+i*120,text}))}));
const typo=s=>s.replace(/\b[a-z]{7,}\b/i,w=>w.slice(0,2)+w[3]+w[2]+w.slice(4));
export const queries=records.flatMap(([videoId,_title,_channel,_p,qs])=>[...qs.map(query=>({query,expected:[videoId],group:'fresh-paraphrase'})),{query:`can you find the video about ${qs[0]}`,expected:[videoId],group:'fresh-conversational'},{query:typo(qs[1]),expected:[videoId],group:'fresh-typo'}]);
if(queries.length!==120)throw Error('Fresh set must have 120 queries');
