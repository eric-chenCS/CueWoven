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

test('new setups save automatically with YouTube only and keep explicit pauses, custom lists and exclusions',()=>{
 const fresh=initialSiteSettings();assert.equal(fresh.enabled,true);assert.deepEqual(fresh.domains,['youtube.com']);assert.equal(fresh.siteDefaultsVersion,2);
 assert.equal(initialSiteSettings({...fresh,domains:[],blocked:['youtube.com']}),null);
 const excluded=initialSiteSettings({blocked:['youtube.com']});assert.deepEqual(excluded.domains,[]);
 const custom=initialSiteSettings({enabled:false,domains:['example.com'],blocked:['youtube.com']});assert.deepEqual(custom.domains,['example.com']);assert.equal(custom.enabled,false);
 const paused=initialSiteSettings({enabled:true,paused:true,domains:['youtube.com']});assert.equal(paused.paused,true);
 const untouched=initialSiteSettings({siteDefaultsInitialized:true,enabled:false,paused:false,domains:[...DEFAULT_DOMAINS]});assert.equal(untouched.enabled,true);assert.deepEqual(untouched.domains,['youtube.com']);
 const selected=initialSiteSettings({siteDefaultsInitialized:true,enabled:true,domains:[...DEFAULT_DOMAINS]});assert.deepEqual(selected.domains,DEFAULT_DOMAINS);
 assert.equal(initialSiteSettings({enabled:true,allSites:true,domains:[]}).allSites,true);
 assert.deepEqual(siteOrigins(['youtube.com']),[]);
});
