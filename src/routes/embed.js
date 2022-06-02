import Embed from './embed.svelte';

var div = document.createElement('DIV');
var script = document.currentScript;
script.parentNode.insertBefore(div, script);

const embed = new Embed({
	target: div,
	props: { name: 'direct action' },
});