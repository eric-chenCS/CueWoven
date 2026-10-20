import {itemLink} from './web-items.js';
import {sampleLink} from './samples.js';
import {deepLink,playbackStart} from './search.js';
export const resultLink=hit=>sampleLink(hit)||itemLink(hit)||(hit.titleOnly?'https://www.youtube.com/watch?v='+encodeURIComponent(hit.videoId):deepLink(hit.videoId,playbackStart(hit)));
