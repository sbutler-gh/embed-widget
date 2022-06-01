import cloudflare from "@sveltejs/adapter-cloudflare";
import netlify from "@sveltejs/adapter-netlify";
import auto from "@sveltejs/adapter-auto";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: auto(),
  },
}

export default config