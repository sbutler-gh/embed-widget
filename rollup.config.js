import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
// import replace from '@rollup/plugin-replace';
// import dotenv from "dotenv";
// import sveltePreprocess from "svelte-preprocess";
// dotenv.config()

// const configToReplace = {};
// for (const [key, v] of Object.entries(config().parsed)) {
//   configToReplace[`process.env.${key}`] = `'${v}'`;
// }

export default {
	input: 'src/routes/embed.js',
	output: {
		format: 'iife',
		file: './static/dist.js',
		// file: 'dist.js',
    sourcemap: false,
	},
	plugins: [
		svelte({ emitCss: false, }),
		resolve({ browser: true, dedupe: ['svelte'] }),
	],
    // preprocess: sveltePreprocess({
    //     // 👇 Add this attribute
    //     replace: [["process.env.MY_ENV_VAR", process.env.MY_ENV_VAR]],
    // }),
}