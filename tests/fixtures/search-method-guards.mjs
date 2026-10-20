import {videos} from './confusable.mjs';
const quoteCases=videos.slice(0,15).map(v=>({query:'"'+v.chunks[0].text.split(/[.!?]/)[0]+'"',expected:[v.videoId],group:'guard-quote'}));
const contrast=[
['the battery video about a coating stealing lithium, not charging a phone in a hot car','bat-sei'],
['the phone charging schedule before the alarm, not the chemistry of the coating','bat-phone'],
['the space video about making a photograph rather than falling inside','bh-image'],
['the space thing slowly disappearing, not taking its photo','bh-hawking'],
['the Minecraft machine that scares villagers, not the plant harvester','mc-golem'],
['the secret entrance trigger under a rug rather than the iron producing machine','mc-door'],
['the bread problem caused by slicing too early, not a hungry culture in a jar','sd-fix'],
['the jar needs feeding when a gray puddle forms, not the loaf needing a cut','sd-starter'],
['the React stale callback fix, not the effect dependency loop','re-state'],
['the React code that executes on the backend rather than a state setter callback','re-rsc'],
['the coffee soaked in cold water overnight, not the fast pressurized shot','cf-cold'],
['the shot that should yield 36 grams from 18 grams, not the cone drip method','cf-espresso'],
['the running injury from ramping up mileage, not the expensive racing footwear','run-shins'],
['the climate idea turns captured gas into rock, not growing a forest','co2-dac'],
['the ancient water supply slopes downhill, not the building material that repairs cracks','rome-aqueduct']
].map(([query,id])=>({query,expected:[id],group:'guard-contrast'}));
const numbers=[['coffee with 18 grams in and 36 grams out','cf-espresso'],['the 1 to 8 coffee steeped for 16 hours','cf-cold'],['the racing shoes saving 4 percent of energy','run-shoes'],['raising weekly running distance by no more than 10 percent','run-shins'],['rotate vehicle tires every 5000 miles','car-tires']].map(([query,id])=>({query,expected:[id],group:'guard-number'}));
const names=[['the Motor Explained video on tires','car-tires'],['the Stride Coach video about footwear','run-shoes'],['Crumb Club about hungry starter','sd-starter'],['the Earth Lab video using minerals in seawater','co2-ocean'],['Code School reading the database without browser code','re-rsc']].map(([query,id])=>({query,expected:[id],group:'guard-channel'}));
export const queries=[...quoteCases,...contrast,...numbers,...names];
if(queries.length!==40)throw Error('Expected 40 guards');
