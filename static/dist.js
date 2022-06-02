(function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    class HtmlTag {
        constructor() {
            this.e = this.n = null;
        }
        c(html) {
            this.h(html);
        }
        m(html, target, anchor = null) {
            if (!this.e) {
                this.e = element(target.nodeName);
                this.t = target;
                this.c(html);
            }
            this.i(anchor);
        }
        h(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        i(anchor) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(this.t, this.n[i], anchor);
            }
        }
        p(html) {
            this.d();
            this.h(html);
            this.i(this.a);
        }
        d() {
            this.n.forEach(detach);
        }
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    /* src/routes/embed.svelte generated by Svelte v3.47.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (100:4) {#each data as item}
    function create_each_block(ctx) {
    	let h1;
    	let t0_value = /*item*/ ctx[1].org + "";
    	let t0;
    	let t1;
    	let html_tag;
    	let raw_value = /*item*/ ctx[1].onboarding + "";
    	let html_anchor;

    	return {
    		c() {
    			h1 = element("h1");
    			t0 = text(t0_value);
    			t1 = space();
    			html_tag = new HtmlTag();
    			html_anchor = empty();
    			html_tag.a = html_anchor;
    		},
    		m(target, anchor) {
    			insert(target, h1, anchor);
    			append(h1, t0);
    			insert(target, t1, anchor);
    			html_tag.m(raw_value, target, anchor);
    			insert(target, html_anchor, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t1);
    			if (detaching) detach(html_anchor);
    			if (detaching) html_tag.d();
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div0;
    	let t1;
    	let div1;
    	let t3;
    	let each_1_anchor;
    	let each_value = /*data*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div0 = element("div");
    			div0.innerHTML = `Coordinates: <p id="coordinates"></p>`;
    			t1 = space();
    			div1 = element("div");
    			div1.innerHTML = `City: <p id="city"></p>`;
    			t3 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t1, anchor);
    			insert(target, div1, anchor);
    			insert(target, t3, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*data*/ 1) {
    				each_value = /*data*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t1);
    			if (detaching) detach(div1);
    			if (detaching) detach(t3);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    async function ipToCoordinates() {
    	let coordinates;
    	let city;
    	const ip = await fetch("https://serene-journey-42564.herokuapp.com/https://api.ipify.org?format=json&callback=getIP");
    	const ip_json = await ip.json();
    	console.log(ip_json);

    	const request = await fetch(`https://serene-journey-42564.herokuapp.com/ipinfo.io/${ip_json["ip"]}/geo?token=d41bed18e5fda2`, {
    		method: 'GET',
    		"Content-Type": "application/json",
    		"charset": "utf-8",
    		"Access-Control-Allow-Headers": "X-Requested-With",
    		"X-Requested-With": "XMLHttpRequest"
    	});

    	const json = await request.json();
    	console.log(json);
    	coordinates = json.loc.split(',');
    	console.log(coordinates);

    	coordinates = {
    		"lat": coordinates[0],
    		"lng": coordinates[1]
    	};

    	// coordinates = {"lat": 38.886503, "lng": -77.1842802};
    	city = json.city;
    	document.getElementById('coordinates').innerText = JSON.stringify(coordinates);
    	document.getElementById('city').innerText = city;
    }

    function instance($$self) {
    	let data = [
    		{
    			"org": "Declare Emergency",
    			"coordinates": "38.889248, -77.050636",
    			"city": "Washington DC",
    			"country": "USA",
    			"website": "https://www.declareemergency.org/",
    			"onboarding": `<p>Fill out form at <a target="_blank" href="https://actionnetwork.org/forms/d02bf10d60ec3acb502016dc0f8bf1226deb8714">https://actionnetwork.org/forms/d02bf10d60ec3acb502016dc0f8bf1226deb8714/</a></p>`,
    			"form_url": "https://actionnetwork.org/forms/d02bf10d60ec3acb502016dc0f8bf1226deb8714",
    			"events_url": "https://linktr.ee/declareemergency"
    		},
    		{
    			"org": "XR DC",
    			"coordinates": "38.889248, -77.050636",
    			"city": "Washington DC",
    			"country": "USA",
    			"website": "https://www.xrdc.org/",
    			"onboarding": `<p>Fill out form at <a target="_blank" href="https://actionnetwork.org/forms/xrdc-rebel-card?source=direct_link">https://actionnetwork.org/forms/xrdc-rebel-card?source=direct_link</a></p>`,
    			"form_url": "https://actionnetwork.org/forms/xrdc-rebel-card?source=direct_link",
    			"events_url": "https://www.xrdc.org/events"
    		},
    		{
    			"org": "XR San Francisco",
    			"coordinates": "37.733795, -122.446747",
    			"city": "San Francisco",
    			"country": "USA",
    			"website": "https://extinctionrebellionsfbay.org/",
    			"onboarding": `<p>1. <a target="_blank" href="https://www.youtube.com/watch?v=UKFU0kPgF_M">Watch a 30 minute orientation</a> to learn more about Extinction Rebellion SF Bay.</p><p>After watching the orientation video, sign up for a 30 minute 1:1 chat with an XR SF Bay organizer to ask any questions and find your place in our chapter:</p>
        <ul>
            <li><a href="https://calendly.com/gretchen-sf/30min" target="_blank">Schedule time with Gretchen</a> (outreach, general questions)</li>
            <li><a href="https://calendly.com/xrsfwelcome/121_chat" target="_blank">Schedule time with Betsy</a> (street theater, outreach, general questions)</li>
            <li><a href="https://calendly.com/rayekahn/30min" target="_blank">Schedule time with Raye</a> (nonviolent direct action, regenerative cultures)</li>
            <li><a href="https://calendly.com/tiffanybbarber/30min" target="_blank">Schedule time with Tiffany</a> (digital strategy, outreach and training)</li>
            <li><a href="https://calendly.com/leahredwood/30min" target="_blank">Schedule time with Leah</a> (action planning, allyship, finance)</li>
            <li><a href="https://calendly.com/jadenorthrup_xrsfbay/30min" target="_blank">Schedule time with Jade</a> (social media, photo/video, tech)</li>
            </ul>
            <p>Alternatively: check out our <a href="https://docs.google.com/document/d/1yksVh2xTR3cZUIJy72xFVVEB_rPtL4fpRquJ1wZKZ9I/edit?usp=sharing" target="_blank">Starter Guide</a> if you'd like an in-depth read or contact a <a href="https://extinctionrebellionsfbay.org/connect" target="_blank">working group</a> if you have questions.</p>`,
    			"form_url": "https://actionnetwork.org/forms/xr-bay-area-sign-up",
    			"events_url": "https://extinctionrebellionsfbay.org/events/"
    		}
    	];

    	onMount(async () => {
    		// console.log(page);
    		ipToCoordinates();
    	});

    	return [data];
    }

    class Embed extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    var div = document.createElement('DIV');
    var script = document.currentScript;
    script.parentNode.insertBefore(div, script);

    new Embed({
    	target: div,
    	props: { name: 'direct action' },
    });

})();
