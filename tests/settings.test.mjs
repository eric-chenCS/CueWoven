import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,defaultsForMemory,resetPreferences} from '../lib/settings.js';
test('reset preferences restores capture/search/appearance without changing retention or mutating the input',()=>{
 const settings={enabled:false,lightMode:true,scenesEnabled:false,screenTextEnabled:false,speechEnabled:false,dwellSeconds:60,perVideo:5,maxAgeDays:0,importMaxAgeDays:90,sceneStorageMB:1024,otherPreference:'keep'};
 const original=structuredClone(settings),result=resetPreferences(settings);
 assert.deepEqual(settings,original);
 for(const key of ['enabled','lightMode','scenesEnabled','screenTextEnabled','speechEnabled','dwellSeconds','perVideo'])assert.equal(result.settings[key],DEFAULT_SETTINGS[key]);
 assert.equal(result.settings.maxAgeDays,0);assert.equal(result.settings.importMaxAgeDays,90);assert.equal(result.settings.sceneStorageMB,1024);assert.equal(result.settings.otherPreference,'keep');
 assert.equal(result.theme,'light');
 assert.deepEqual(Object.keys(result).sort(),['settings','theme']);
 assert.deepEqual(resetPreferences().settings,DEFAULT_SETTINGS);
 assert.equal(resetPreferences({maxAgeDays:7,importMaxAgeDays:0}).settings.importMaxAgeDays,0);
});

test('only valid physical memory of 8 GiB or less defaults to Lite mode', () => {
 for (const gib of [0.5, 2, 4, 7.7, 8]) assert.equal(defaultsForMemory(gib * 1024 ** 3).lightMode, true);
 for (const capacity of [8 * 1024 ** 3 + 1, 12 * 1024 ** 3, 16 * 1024 ** 3, 32 * 1024 ** 3, undefined, null, 0, -1, NaN, Infinity, '8']) assert.equal(defaultsForMemory(capacity).lightMode, false);
 assert.deepEqual({...defaultsForMemory(8 * 1024 ** 3), lightMode:false}, DEFAULT_SETTINGS);
});

test('reset uses the device default without dropping saved retention choices', () => {
 const result = resetPreferences({lightMode:false, maxAgeDays:7, importMaxAgeDays:90, sceneStorageMB:64}, defaultsForMemory(8 * 1024 ** 3));
 assert.equal(result.settings.lightMode, true);
 assert.equal(result.settings.speechEnabled, true);
 assert.equal(result.settings.maxAgeDays, 7);
 assert.equal(result.settings.importMaxAgeDays, 90);
 assert.equal(result.settings.sceneStorageMB, 64);
});
