import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,resetPreferences} from '../lib/settings.js';
test('reset preferences restores capture/search/appearance without changing retention or mutating the input',()=>{
 const settings={enabled:false,lightMode:true,scenesEnabled:false,screenTextEnabled:false,speechEnabled:false,dwellSeconds:60,perVideo:5,transcriptConcurrency:10,maxAgeDays:0,importMaxAgeDays:90,sceneStorageMB:1024,otherPreference:'keep'};
 const original=structuredClone(settings),result=resetPreferences(settings);
 assert.deepEqual(settings,original);
 for(const key of ['enabled','lightMode','scenesEnabled','screenTextEnabled','speechEnabled','dwellSeconds','perVideo','transcriptConcurrency'])assert.equal(result.settings[key],DEFAULT_SETTINGS[key]);
 assert.equal(result.settings.maxAgeDays,0);assert.equal(result.settings.importMaxAgeDays,90);assert.equal(result.settings.sceneStorageMB,1024);assert.equal(result.settings.otherPreference,'keep');
 assert.equal(result.theme,'system');
 assert.deepEqual(Object.keys(result).sort(),['settings','theme']);
 assert.deepEqual(resetPreferences().settings,DEFAULT_SETTINGS);
 assert.equal(resetPreferences({maxAgeDays:7,importMaxAgeDays:0}).settings.importMaxAgeDays,0);
});
