// New final confirmation: frozen before extended-model or passage-policy selection.
const records=[
['solar','When daylight changes','Sky Notebook',[
'In a solar eclipse the Moon passes between Earth and the Sun. The narrow path of totality is where the Moon completely covers the bright solar disc.',
'A partial view of the Sun still needs appropriate eye protection. Ordinary sunglasses are not suitable eclipse viewing equipment.'
],['the moon blocks the daytime light along a narrow path','the clip where being outside the narrow strip means you dont see it completely covered','the person said regular dark glasses arent enough for looking at the sun','the shadow on earth was made by the moon passing in front','that daytime sky event where the bright disc gets covered']],
['lunar','A moon changing colour','Sky Notebook',[
'In a lunar eclipse Earth lies between the Sun and Moon. Sunlight passing through Earths atmosphere can give the eclipsed Moon a reddish appearance.',
'A lunar eclipse can be seen from much of the night side of Earth. It does not require standing inside the narrow track used for a total solar eclipse.'
],['the moon turns reddish because light passes through our air','the night sky event can be seen across a whole side of earth','earth gets in the way of light going toward the moon','the eclipse doesnt need you to travel to one narrow strip','the moon video about earths shadow rather than the sun disappearing']],
['print-warp','The edge lifting away','Layer Bench',[
'A plastic print can curl upward when its lower layers cool and contract unevenly. A draft or poor adhesion to the build surface can make this warping worse.',
'A clean build surface and suitable temperature settings help the first layer stay attached. A brim increases the area holding the base down.'
],['the plastic thing peeled upward at the corners as it cooled','the printer needed a wider flat edge to keep the base down','a draught made the bottom of the object lift off','the first layer needed to stick to a clean surface','the printing video about uneven shrinking pulling corners up']],
['print-string','Threads between two towers','Layer Bench',[
'Fine plastic hairs between separate printed parts often come from material oozing during travel moves. Retraction pulls filament back to reduce that leakage.',
'Wet filament and excessive nozzle temperature can worsen stringing. Changing bed adhesion alone does not address plastic leaking from the moving nozzle.'
],['the printer left little hairs while moving between separate parts','pulling the filament backward helps stop it leaking during travel','the strings came from the nozzle rather than the bottom peeling off','the damp plastic spool made the wispy strands worse','the printer video says changing how the base sticks wont fix the fine hairs']],
['hash','A fingerprint for a file','Cipher Notes',[
'A cryptographic hash maps data to a fixed length digest. It is used to check whether a file has changed, but it is not encryption that can be undone with a secret key.',
'A salt makes identical passwords produce different stored values. Password storage needs a deliberately expensive password hashing method rather than only a fast general purpose digest.'
],['the file fingerprint tells you if something changed but cant be unlocked','the passwords should be made expensive to guess rather than just quickly scrambled','the same password gets a different stored result because of a salt','the one way digest isnt a locked message with a key','the code speaker comparing a file fingerprint to reversible secrecy']],
['encrypt','Opening a protected message','Cipher Notes',[
'Encryption transforms a message so that the proper key can recover its contents. An authenticated encryption scheme also detects tampering with the protected message.',
'Reusing a nonce with schemes that require uniqueness can break their security. A random looking output is not evidence that the encryption was implemented correctly.'
],['the scrambled message can be recovered if you have the proper key','the code video says reusing a little one time value can break the protection','the protected message should also reveal if someone altered it','the random looking data didnt prove the encryption was correct','the speaker explains a locked message rather than an irreversible fingerprint']],
['bio-light','A glow made from a reaction','Ocean Notebook',[
'Bioluminescent organisms generate light through a chemical reaction. That differs from fluorescence, which absorbs incoming light and re-emits it in another colour.',
'A glowing animal may use its light for signalling, camouflage or attracting prey. The light source is a biological chemical process rather than merely reflecting a lamp.'
],['the sea animal makes its own light with chemistry','the glowing creature didnt need a coloured lamp shining on it','the animal uses a chemical glow to signal or hide','the ocean clip about producing light rather than changing light that arrives','the living thing makes the glow inside itself']],
['fluorescent','Colour under a special lamp','Ocean Notebook',[
'Fluorescence needs an external light source. A substance absorbs shorter wavelength light and releases some of the energy as a longer wavelength colour.',
'Removing the excitation light usually stops the fluorescent glow quickly. Long lasting glow in the dark materials involve a different delayed emission process.'
],['the glowing colour stopped when the special lamp was turned off','the substance changes incoming light into a different colour','the glow needed a source of shorter wavelength light first','the fluorescent object wasnt making its own chemical light','the clip about an outside lamp making something glow briefly']],
['watch-quartz','A crystal keeping time','Time Bench',[
'A quartz watch commonly uses a crystal oscillating at 32768 times per second. Electronics divide this stable rhythm down to time the display.',
'A depleted battery can stop a quartz movement even if its gears are intact. Winding the crown is not a substitute for replacing a battery in an ordinary quartz watch.'
],['the watch counts a crystal vibrating thousands of times each second','twisting the little knob wont replace a dead battery','the electronics divide a fast steady rhythm into seconds','the small timepiece stopped even though its gears werent broken','the watch with a crystal ticking at 32768 per second']],
['watch-spring','A moving balance wheel','Time Bench',[
'A mechanical watch stores energy in a mainspring and meters it through an escapement. A balance wheel and hairspring regulate the beat.',
'A movement beating 28800 times an hour has a different rate from a quartz oscillator counted per second. Mechanical accuracy can vary with position and temperature.'
],['the watch gets its energy from a wound spring','the little balance wheel controls how fast the spring energy is let out','the timepiece changes its accuracy depending on how it is sitting','the mechanical movement beats 28800 times an hour','the watch person explaining a hairspring instead of a vibrating crystal']],
['rain-jacket','Water on a fabric surface','Trail Laundry',[
'A waterproof jacket can wet out when its outer water repellent finish wears off. Water soaking the face fabric does not automatically mean the inner membrane has a hole.',
'Cleaning with a suitable product and restoring the finish can help water bead again. Fabric softener can interfere with the performance of technical clothing.'
],['the raincoat soaked outside even though the inner layer wasnt torn','the water stopped forming little beads on the jacket','the hiking person said dont add fabric softener','the coat needed its outer finish restored rather than assuming a hole','the outdoor clothing looked soaked because its surface treatment wore out']],
['down-bag','A sleeping bag losing puff','Trail Laundry',[
'Down insulation traps warm air when its clusters expand. A compressed or wet sleeping bag can lose loft and feel much colder.',
'Dry the bag thoroughly using a suitable gentle process so damp clusters separate again. Storing it loosely rather than tightly compressed helps preserve its loft.'
],['the sleeping bag felt colder because its filling couldnt puff up','the damp feathers needed drying until the clumps separated','dont leave the insulated bag squashed in its little sack forever','the warmth comes from air held between expanded down clusters','the outdoor gear lost warmth when it stayed wet and flat']]
];
export const videos=records.map(([name,title,channel,texts])=>({videoId:'h-final-'+name,title,channel,chunks:texts.map((text,i)=>({start:i*30,text}))}));
const cases=records.flatMap(([name,,,texts,qs])=>qs.map(query=>({query,group:'final-authored',expected:['h-final-'+name]})));
for(const [i,r]of records.entries())cases.push({query:i%2?`can you find the one where ${r[4][0]}`:`the speaker was saying ${r[4][2].replace(/\b[a-z]{8,}\b/,w=>w.slice(0,2)+w[3]+w[2]+w.slice(4))}`,group:'final-variant',expected:['h-final-'+r[0]]});
for(const [name,q]of [['solar','the moon covers the sun, not earth covering the moon'],['lunar','earths atmosphere makes the moon red, not a daytime solar eclipse'],['print-warp','the corners lift from the bed, not little strings leaking from the nozzle'],['print-string','the nozzle leaves hairs during travel, not the corners peeling off'],['hash','a one way password digest rather than a message you decrypt'],['encrypt','a reversible message with a key, not just a file fingerprint'],['bio-light','the living animal produces light chemically rather than fluorescence'],['fluorescent','the glow needs incoming light rather than an internal chemical reaction'],['watch-quartz','32768 times per second, not 28800 per hour'],['watch-spring','28800 per hour in a mechanical watch, not 32768 per second'],['rain-jacket','water stops beading on a raincoat, not feathers losing loft'],['down-bag','wet down losing its puffiness, not a jacket membrane leaking']])cases.push({query:q,group:'final-contrast-number',expected:['h-final-'+name]});
for(const query of ['the violin maker carving a new bridge','the tea ceremony where they whisked green powder','how submarines replace oxygen underwater','the librarian repairing a torn medieval book','why a helicopter rotor needs a tail fan','the dentist demonstrating a ceramic crown','how to score a fencing bout','the sea turtle finding its nesting beach','repairing a cracked saxophone reed','how a waterfall makes a rainbow','the baker folding butter into croissant dough','the drone operator losing radio contact','the tennis player changing their racket grip','a painter restoring a Renaissance fresco','a scientist measuring the depth of Antarctic ice','the beekeeper finding the queen in a hive'])cases.push({query,group:'final-absent',expected:[]});
export const queries=cases;
if(videos.length!==12||queries.length!==100)throw Error('Confirmation count changed');
