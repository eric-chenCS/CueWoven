import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_DOMAINS,SUGGESTED_SITES,siteGroup,siteOrigins} from '../lib/web-sites.js';
import {policy} from '../lib/web-items.js';
test('suggested sites are unique public domains with the correct display groups',()=>{
 assert.equal(new Set(DEFAULT_DOMAINS).size,DEFAULT_DOMAINS.length);
 for(const [group,sites] of Object.entries(SUGGESTED_SITES))for(const site of sites){assert.equal(policy.domain(site),site);assert.equal(siteGroup(site),group);}
 assert.equal(siteGroup('example.com'),'Added by you');
 assert.deepEqual(siteOrigins(['example.com']),['https://*.example.com/*','http://*.example.com/*']);
});
