import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_DOMAINS,SUGGESTED_SITES,siteGroup,siteOrigins,initialSiteSettings} from '../lib/web-sites.js';
import {policy} from '../lib/web-items.js';
test('suggested sites are unique public domains with the correct display groups',()=>{
 assert.equal(new Set(DEFAULT_DOMAINS).size,DEFAULT_DOMAINS.length);
 for(const [group,sites] of Object.entries(SUGGESTED_SITES))for(const site of sites){assert.equal(policy.domain(site),site);assert.equal(siteGroup(site),group);}
 assert.equal(siteGroup('example.com'),'Added by you');
 assert.deepEqual(siteOrigins(['example.com']),['https://*.example.com/*','http://*.example.com/*']);
});

test('starter sites include YouTube and Instagram once, without restoring exclusions or broadening an active empty scope',()=>{
 const fresh=initialSiteSettings();assert.equal(fresh.enabled,false);assert.ok(fresh.domains.includes('youtube.com'));assert.ok(fresh.domains.includes('instagram.com'));
 assert.equal(initialSiteSettings({...fresh,domains:[],blocked:['youtube.com','instagram.com']}),null);
 const custom=initialSiteSettings({enabled:false,domains:['example.com'],blocked:['youtube.com']});assert.deepEqual(custom.domains,['example.com']);
 const seeded=initialSiteSettings({enabled:true,domains:[],blocked:['instagram.com']});assert.equal(seeded.enabled,false);assert.equal(seeded.paused,true);assert.ok(!seeded.domains.includes('instagram.com'));
 const full=initialSiteSettings({enabled:true,allSites:true,domains:[]});assert.equal(full.enabled,true);
 assert.deepEqual(siteOrigins(['youtube.com']),[]);
});
