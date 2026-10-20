import {videos as base} from './search-stress.mjs';
import {videos as fresh} from './search-fresh.mjs';
// Written after choosing the policy, before evaluating this confirmation set.
// No policy/threshold changes are made from these outcomes.
const cases=[
['the battery slowly losing its usable stuff to a layer on the inside','bat-sei'],
['the mobile learns when i get up and avoids sitting fully charged overnight','bat-phone'],
['the vehicle power pack has fluid flowing underneath to stop it overheating','bat-ev'],
['the astronaut could pass the boundary of a gigantic dark space object and feel fine','bh-tidal'],
['the orange space donut is glowing material around a shadow','bh-image'],
['the space object should eventually run out of mass by leaking energy','bh-hawking'],
['the tall plant in the block game gets knocked down automatically when it reaches a sensor','mc-farm'],
['the village monster needs a nametag so the metal factory keeps running','mc-golem'],
['the hidden block entrance wont work unless the upper pistons wait a moment','mc-door'],
['the bread culture smells like yogurt and gets much bigger after feeding','sd-starter'],
['the bread cut makes a flap by directing where it expands in the oven','sd-shape'],
['the dent in the dough should return slowly instead of bouncing straight back','sd-fix'],
['the variable doesnt update immediately when i call the React setter','re-state'],
['the function needs to stop its pending network request when the component disappears','re-effect'],
['the database query happens on the backend so the visitor gets less script','re-rsc'],
['the cone coffee gets a short wetting first to let trapped bubbles escape','cf-v60'],
['the pressure coffee needs its grounds spread evenly so the water doesnt tunnel through','cf-espresso'],
['the cold coffee concentrate can sit in the fridge for about a fortnight','cf-cold'],
['the long race training includes practicing little food packets while running','run-marathon'],
['the leg pain advice includes slow heel lifts to absorb the pounding','run-shins'],
['the expensive bouncy footwear wears out quickly so save it for race days','run-shoes'],
['the air cleaning machines make a ton of captured gas cost hundreds','co2-dac'],
['putting the wrong forest into grassland can damage the environment','co2-trees'],
['the seaweed climate plan is hard to measure once it sinks far down','co2-ocean'],
['the investing video says even a small annual percentage charge adds up over decades','fin-index'],
['keep the oldest payment card open because the age of the record matters','fin-credit'],
['the retirement account lets you take the original contributions out without a penalty','fin-roth'],
['the ancient harbor wall repairs little cracks with white bits inside','rome-concrete'],
['the ancient water delivery mostly runs below the ground instead of on arches','rome-aqueduct'],
['the old empire made army pay with coins containing less silver','rome-fall'],
['the difficult guitar chord is easier when the finger rolls onto the hard edge','gtr-barre'],
['the guitar needs retuning repeatedly after the fresh strings stretch','gtr-strings'],
['the guitar picking pattern needs the thumb to be automatic before the fingers join in','gtr-travis'],
['the new engine filter should be hand tight and have some fresh oil on its seal','car-oil'],
['the little tab on the stopping pad makes a squeal as it wears out','car-brakes'],
['the air pressure number belongs on the door frame rather than the tire wall','car-tires'],
['the cupboard and thick reinforced walls are why the bedroom internet is weak','wifi-room'],
['the microwave uses the crowded radio band so switch to the faster frequency','wifi-band'],
['the leafy plant is wilting because wet roots cannot breathe','plant-water'],
['the plant gets burned if it moves from shade straight into strong sun','plant-light'],
['the dog photo needs a shorter exposure even if the sensor gain adds noise','photo-motion'],
['the face picture should focus on the nearest eye rather than the nose','photo-focus'],
['the afternoon stimulant still affects sleep even if i can fall asleep','sleep-caffeine'],
['the morning outdoor brightness helps keep my waking schedule steady','sleep-clock'],
['the airline might take the cabin suitcase so keep the charger and medicines removable','trip-bag'],
['the security check cares how big the shampoo bottle is even if its almost empty','trip-liquid'],
['trying to explain the lesson with the book shut is better than looking at it again','learn-recall'],
['spread revision across several days and revisit difficult material sooner','learn-space']
];
const typo=s=>s.replace(/\b[a-z]{8,}\b/i,w=>w.slice(0,3)+w[4]+w[3]+w.slice(5));
export const videos=[...base,...fresh];
export const queries=cases.flatMap(([query,videoId],i)=>[{query,expected:[videoId],group:'confirm-authored'},{query:i%2?`i vaguely remember a video where ${query}`:typo(query),expected:[videoId],group:i%2?'confirm-conversational':'confirm-typo'}]);
if(queries.length!==96)throw Error('Expected 96 confirmation cases');
