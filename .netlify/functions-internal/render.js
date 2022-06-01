import { init } from '../handler.js';

export const handler = init({
	appDir: "_app",
	assets: new Set(["favicon.png","normalize.css","prettify.css","style.css"]),
	mimeTypes: {".png":"image/png",".css":"text/css"},
	_: {
		entry: {"file":"start-abfaedfd.js","js":["start-abfaedfd.js","chunks/index-d36043ac.js","chunks/index-fb66156c.js"],"css":[]},
		nodes: [
			() => import('../server/nodes/0.js'),
			() => import('../server/nodes/1.js'),
			() => import('../server/nodes/4.js'),
			() => import('../server/nodes/2.js'),
			() => import('../server/nodes/3.js')
		],
		routes: [
			{
				type: 'page',
				id: "",
				pattern: /^\/$/,
				names: [],
				types: [],
				path: "/",
				shadow: null,
				a: [0,2],
				b: [1]
			},
			{
				type: 'endpoint',
				id: "publish_location",
				pattern: /^\/publish_location\/?$/,
				names: [],
				types: [],
				load: () => import('../server/entries/endpoints/publish_location.js')
			},
			{
				type: 'endpoint',
				id: "load_sites",
				pattern: /^\/load_sites\/?$/,
				names: [],
				types: [],
				load: () => import('../server/entries/endpoints/load_sites.js')
			},
			{
				type: 'page',
				id: "Earthquakes",
				pattern: /^\/Earthquakes\/?$/,
				names: [],
				types: [],
				path: "/Earthquakes",
				shadow: null,
				a: [0,3],
				b: [1]
			},
			{
				type: 'page',
				id: "MiniScroller",
				pattern: /^\/MiniScroller\/?$/,
				names: [],
				types: [],
				path: "/MiniScroller",
				shadow: null,
				a: [0,4],
				b: [1]
			}
		],
		matchers: async () => {
			
			return {  };
		}
	}
});
