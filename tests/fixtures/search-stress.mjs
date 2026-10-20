// Stress suite, not an independent accuracy benchmark. 726 cases reuse 121 existing
// query seeds; 108 hand-written paraphrases, 16 user-case paraphrases, 100 typo
// variants of those new cases, 25 ambiguous and 25 absent-topic probes follow.
import {videos as baseVideos,queries as baseQueries} from './confusable.mjs';
const hard = {
'bat-sei':['the rechargeable thing getting worse even inside a drawer','why a little coating steals some of the electricity a cell can hold','when they decide a cell is finished although it still has most of its capacity'],
'bat-phone':['the handset only tops itself up right before you wake','leaving your mobile roasting on the dash ruins how long it lasts','the advice that you shouldnt run your mobile completely flat'],
'bat-ev':['how a vehicle keeps its power cells from cooking','the car chemistry that lasts ages but holds a bit less juice','an electric vehicle still going most of the original distance a decade later'],
'bh-tidal':['the space thing that pulls your legs harder than your skull','the enormous dark space object you could fall into without noticing the boundary','once you pass the edge of that space object none of the possible directions get you out'],
'bh-image':['the picture made by linking dishes on opposite sides of the planet','the blurry glowing donut where the empty middle is a shadow','the picture of the dark thing in our own galaxy after the other galaxy'],
'bh-hawking':['the dark space objects leaking energy until theres nothing left','the scientist who figured even the things light cant escape ought to glow','the puzzle about whether swallowed knowledge survives when the object disappears'],
'mc-farm':['the block game machine that chops a plant after it grows tall enough','the reed collecting contraption with funnels beneath it','why the plant harvesting machine stops doing anything when you leave the area'],
'mc-golem':['the block game where scaring little people produces metal giants','the monster needs a label otherwise the metal producing machine quits','the metal giants walk through molten stuff and get collected underneath'],
'mc-door':['the block game entrance disguised as an ordinary wall','the carpet hides something you step on to open a secret entrance','the secret block entrance jams unless the upper bits move a little later'],
'sd-starter':['the bread jar getting a puddle because it needs dinner','the bubbling bread culture should grow to twice its size after a meal','throw half the bread culture away before giving it equal amounts to eat and drink'],
'sd-shape':['the bread gets a flap because you slash it sideways before baking','the covered pot traps moisture so the loaf rises suddenly','pulling the loaf skin tight after giving it a short rest'],
'sd-fix':['the loaf is sticky inside because you rushed the rise','the bread seems wet inside because you sliced it too soon','prod the dough and see whether the dent slowly comes partway back'],
're-state':['the number in the component is still the previous one after i update it','the delayed callback remembers an outdated component value','adding directly to the list doesnt make the interface redraw'],
're-effect':['a component keeps fetching and rendering forever because it updates itself','cancel the network request when the component goes away','a freshly created object makes the dependency check think something changed every render'],
're-rsc':['the component can query storage on the backend without shipping its code to the user','the React stuff that needs a special instruction before it can handle clicks','the web page is quicker because less code gets sent to the visitor'],
'cf-v60':['the filter coffee needs a little wetting and a pause to let trapped gas out','the cone coffee tastes too sharp so the particles should be smaller','the coffee poured in circles with the water at a steady height'],
'cf-espresso':['the tiny coffee shot should weigh double what the dry grounds weigh','the pressurized coffee comes out too fast and tastes sharp','water finds a shortcut through the pressed coffee instead of spreading evenly'],
'cf-cold':['leave the grounds soaking overnight in the refrigerator','the coffee made without heat has less of that sharp bite','the chilled coffee concentrate lasts about a fortnight after straining'],
'run-marathon':['the long distance training where most days you can chat while moving','practice eating the little energy packets before the actual long race','the longest practice outing should happen a few weeks before the big race'],
'run-shins':['the front of my lower legs hurts after i ramped up running too fast','lift your heels slowly to help your lower legs cope with the pounding','take a break from pounding the pavement and pedal instead when the lower leg pain gets sharp'],
'run-shoes':['the springy racing footwear that gives you a small efficiency boost','the fancy running footwear should be kept for competitions because it wears out fast','the expensive plated footwear doesnt help much if you jog slowly'],
'co2-dac':['the climate machine turns the stuff in the air into rock underground','the climate solution uses huge fans but each ton costs loads','pump the captured pollution into volcanic stone after mixing it into water'],
'co2-trees':['the climate fix can release everything again if the forest catches fire','putting the wrong woodland in open grassy habitat can make things worse','a newly planted forest takes ages before it stores much pollution'],
'co2-ocean':['dump crushed green minerals into seawater so it can take up more pollution','grow seaweed and send it down deep but nobody knows how much stays there','the marine climate idea might affect microscopic sea life'],
'fin-index':['buying a tiny bit of every business instead of betting on winners','a seemingly tiny yearly investment charge adds up to a fortune','the professionals often lose to just following the market after their charges'],
'fin-credit':['a missed card bill can haunt your record for seven years','having a lot of unused borrowing room helps your rating','dont cancel the card youve had the longest'],
'fin-roth':['the retirement pot where the tax is paid before the money goes in','the retirement account makes more sense if youll earn enough to be taxed more later','you can take out what you originally put in but the growth has different rules'],
'rome-concrete':['the ancient harbor walls actually get tougher in the sea','white bits inside old building material repair their own cracks when wet','why ancient piers survived while the metal inside modern ones rusts'],
'rome-aqueduct':['the ancient water supply barely slopes but travels a huge distance','the famous ancient arches were actually only a small part of the water system','ancient rich people paid for water through pipes made from a poisonous metal'],
'rome-fall':['the ancient rulers paid the army with money that contained less precious metal','the emperor tried to freeze prices and created shortages instead','whether debased money brought the empire down or just showed it was already failing'],
'gtr-barre':['the guitar grip hurts unless you pull with your arm rather than pinch','the chord works better with the hard edge of your finger across the strings','learn the difficult flat finger chord higher up the neck before moving down'],
'gtr-strings':['the guitar wont stay in tune just after fitting fresh wires','leave a couple inches loose so there are enough turns around the peg','taking the old guitar wires off one by one rather than all together'],
'gtr-travis':['the guitar thumb keeps a heartbeat while the other fingers play between it','learn the repeating low guitar notes alone before adding the melody','the fingerstyle guitar pattern has two low notes taking turns'],
'car-oil':['warm the motor a little before draining the old lubricant','the rubber seal on the replacement car filter needs a little lubrication','the used motor fluid goes to a parts shop rather than down the sink'],
'car-brakes':['the high pitched stopping noise comes from a little metal warning tab','the car makes a scraping noise when stopping because the metal surfaces are touching','new stopping pads need several deliberate stops so the surface beds in'],
'car-tires':['the right amount of air is on the door label rather than the rubber sidewall','moving the wheels front to back helps them wear together','use a little coin to check if the grooves in the rubber are too shallow']
};
const userSegments=[
[0,"So, welcome to Sunday Plus. Yeah, I'm I'm plus-siz now. Look at me. Look. I take my back brace off. I got a bad back, too."],
[8,"Dude, you aging is not fun, right? Like, you guys are in your mid20s now, right? Young 20s, mid20s, you're paying rent."],
[14,"You got to figure out how to pay car insurance and sometimes you miss your bill and then they threaten to repo your car and then you can't afford groceries."],
[21,"Then you can't afford rent and then next thing you know, you're living back in your mom's basement, you know, and she's yelling at you to get a job and you don't want to get a job because you just want to play video games all day."],
[29,"Bad thing, but welcome to the Sunday Plus channel. Um, I got a bad back as you saw. And also, look, I'm gaining some weight. Like a year"],
[38,"ago, I was like 180 lbs. Now, I'm like 210. Welcome to getting older, fellas."],
[44,"All right, so here's what this channel's going to be about. You know, obviously Skyactory is going to live here. Maybe the Lucky Block series, maybe a Murder Run. Uh, that's the Minecraft side, but"],
[53,"we're also going to play a ton of different Steam games. And you guys are probably just wondering, why don't you just upload this to your main channel, right? Well, here's the deal. I'm pushing 40. Prior military, Craner has"],
[62,"been streaming on TikTok to a bunch of you guys. So, he doesn't know how to talk, right? And a lot of stuff gets edited out of the main channel videos"],
[70,"because we say things that don't fit for that channel. You know, like this. Fill my poo hole. Fail. What does that mean?"],
[77,"Oh gosh. And also like this. Does anybody have steak cooked beef? Couldn't be me. No."],
[82,"Couldn't beat meat. Wait, hold on. Let's edit that out. And you say I'm the liability, bro."],
[90,"And also this."],[91,"Wait, what's the other villain in that show? Uh, Reverse Flash. Reverse Flash. Uh, Scrotum. Huh?"],[100,"Russell."],
[102,"And then many years ago with Sigils, he said this. Thank you for contacting FH support. This is FH. How can I you?"],
[112,"So yeah, we say some unhinged stuff that has to get edited out. So, we're going to be ourselves on this channel more so than the main channel. So, I wanted to create this cuz I don't again I don't"],
[120,"feel comfortable uploading that stuff to a younger demographic cuz they don't need to hear that crap. You know, we're we're all, you know, over 20. We hear"],
[128,"crap worse than that every day. So, that's what this channel's going to be about. A lot of Steam games. Let us know down in the comments what games you want to watch cuz uh you know, I'm a gamer."],
[136,"I'm a loser. That's what I do every day."],
[137,"So, yeah. Make sure you subscribe. Make sure you share it with your friends next time you go to your retirement meeting cuz your knees are going out and you're getting gray hair or you're going bald."],
[145,"Sorry. Welcome to getting older. All right. See you. Get out of here."]
];
export const videos=[...baseVideos,{videoId:'iGDOWFcMRDs',title:'Sunday Plus introduction',channel:'Sunday Plus',chunks:userSegments.map(([start,text])=>({start,text}))},
{videoId:'decoy-back',title:'Desk stretches',channel:'Fixture',chunks:[{start:0,text:'My back hurts after sitting all day. These stretches help with lower back pain. Keep your back brace on if your clinician recommends it.'}]},
{videoId:'decoy-age',title:'A milestone birthday',channel:'Fixture',chunks:[{start:0,text:'I am getting old. I am pushing forty now and my hair is going gray. Aging is not fun, but I love celebrating birthdays with my children.'}]},
{videoId:'decoy-games',title:'The next chapter',channel:'Fixture',chunks:[{start:0,text:'Welcome to the new gaming channel. Minecraft and Steam games will live here because the main channel is for younger viewers. We edit our jokes out on that channel.'}]},
{videoId:'decoy-brace',title:'New sports equipment',channel:'Fixture',chunks:[{start:0,text:'The old back brace was worn out. I replaced it with a new one so I can play sports again. This equipment review compares three designs.'}]}];
const typo=s=>s.replace(/\b[a-z]{7,}\b/i,w=>w.slice(0,2)+w[3]+w[2]+w.slice(4));
const cases=[];
for(const q of baseQueries)for(const [group,query] of [
['baseline',q.query],['conversational',`that video of the speaker talking about ${q.query}`],
['forgot-title',`i cant remember the title but ${q.query}`],['hedged',`something about ${q.query}, i think`],
['typo-seed',typo(q.query)],['verbose',`can you find the clip where they mentioned ${q.query} to someone`]])cases.push({group,query,expected:[q.videoId]});
const newCases=Object.entries(hard).flatMap(([id,list])=>list.map(query=>({group:'hard-paraphrase',query,expected:[id]})));
const userQueries=[
 'a video of the speaker calling himselve old and having back pain',
 'that video of the speaker calling himselve old and having back pain.',
 'speaker jokes about getting old and his back hurting',
 'the gamer who says hes getting older and needs a back brace',
 'the guy joking his body is falling apart while introducing his other gaming channel',
 'the dude complains about aging and puts on weight',
 'the man went from a hundred eighty to two hundred ten pounds',
 'the speaker approaching forty with a bad back introducing his new channel',
 'the guy with an aching back says this channel is for jokes they cut from the other one',
 'that gaming video he jokes about retirement meetings and losing your hair',
 'he tells younger guys about paying bills then moving back to their mothers basement',
 'he says some of the things they say arent suitable for his younger audience',
 'the gamer telling people to share the video with friends at their retirement meeting',
 'the gaming guy mentions his back support then complains getting older sucks',
 'that video about his new channel where hes joking hes old and heavier now',
 'dude introducing a Steam gaming channel and talking about turning forty and his bad back'
].map(query=>({group:'user-transcript',query,expected:['iGDOWFcMRDs']}));
cases.push(...newCases,...userQueries,...[...newCases,...userQueries].slice(0,100).map(q=>({...q,group:'hard-typo',query:typo(q.query)})));
// Ambiguous queries have multiple acceptable videos. No arbitrary single winner.
const ambiguous=[
['battery',['bat-sei','bat-phone','bat-ev']],['black hole',['bh-tidal','bh-image','bh-hawking']],['minecraft',['mc-farm','mc-golem','mc-door','iGDOWFcMRDs','decoy-games']],['sourdough',['sd-starter','sd-shape','sd-fix']],['react',['re-state','re-effect','re-rsc']],['coffee',['cf-v60','cf-espresso','cf-cold']],['running',['run-marathon','run-shins','run-shoes']],['carbon removal',['co2-dac','co2-trees','co2-ocean']],['money',['fin-index','fin-credit','fin-roth','rome-fall']],['rome',['rome-concrete','rome-aqueduct','rome-fall']],['guitar',['gtr-barre','gtr-strings','gtr-travis']],['car maintenance',['car-oil','car-brakes','car-tires']],['getting old',['iGDOWFcMRDs','decoy-age']],['bad back',['iGDOWFcMRDs','decoy-back','decoy-brace']],['gaming channel',['iGDOWFcMRDs','decoy-games']],['keeping batteries healthy',['bat-phone','bat-ev','bat-sei']],['learning guitar',['gtr-barre','gtr-travis','gtr-strings']],['making bread',['sd-starter','sd-shape','sd-fix']],['saving for retirement',['fin-index','fin-roth']],['hot coffee',['cf-v60','cf-espresso']],['wearing out',['bat-sei','bat-ev','run-shoes','car-brakes','car-tires','decoy-brace']],['getting hurt while running',['run-shins']],['building things in minecraft',['mc-farm','mc-golem','mc-door']],['looking after my car',['car-oil','car-brakes','car-tires','bat-ev']],['climate solutions',['co2-dac','co2-trees','co2-ocean']]
];
cases.push(...ambiguous.map(([query,expected])=>({group:'ambiguous',query,expected})));
const absent=['origami paper cranes','crochet a wool scarf','repairing a leaking faucet','bird migration navigation','how violin bows are made','satellite weather forecasting','learning Japanese writing','the history of chess openings','penguins raising chicks','building a home pottery kiln','sailing knots for beginners','how a dishwasher cleans plates','restoring an antique pocket watch','growing mushrooms indoors','writing a detective novel','how bees communicate directions','the geology of diamond formation','reading ancient Egyptian hieroglyphs','replacing a broken window pane','how a camera autofocus motor works','training a puppy to stay','the rules of cricket scoring','sewing a zipper into a jacket','why leaves change color in autumn','repairing a bicycle derailleur'];
cases.push(...absent.map(query=>({group:'absent-topic',query,expected:[]})));
if(cases.length!==1000)throw Error(`Expected 1000 cases, got ${cases.length}`);
export const queries=cases.map((q,i)=>({id:i+1,...q}));
