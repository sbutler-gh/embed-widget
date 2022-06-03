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
    function append_styles(target, style_sheet_id, styles) {
        const append_styles_to = get_root_for_style(target);
        if (!append_styles_to.getElementById(style_sheet_id)) {
            const style = element('style');
            style.id = style_sheet_id;
            style.textContent = styles;
            append_stylesheet(append_styles_to, style);
        }
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
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
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
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

    /* src/routes/Embed.svelte generated by Svelte v3.47.0 */

    function add_css(target) {
    	append_styles(target, "svelte-lncimr", "#banner.svelte-lncimr{overflow-y:scroll}@media only screen and (min-width: 601px){#banner.svelte-lncimr{max-width:75%;max-height:300px}}@media only screen and (max-width: 600px){#banner.svelte-lncimr{max-width:100%;max-height:200px}}");
    }

    // (210:4) {:else}
    function create_else_block(ctx) {
    	let p;

    	return {
    		c() {
    			p = element("p");
    			p.innerHTML = `<em>Loading ...</em>`;
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (203:4) {#if content}
    function create_if_block(ctx) {
    	let h2;
    	let a;
    	let t0_value = /*data*/ ctx[2][/*i*/ ctx[1]].org + "";
    	let t0;
    	let a_href_value;
    	let t1;
    	let em;
    	let t2_value = /*data*/ ctx[2][/*i*/ ctx[1]].summary + "";
    	let t2;
    	let t3;
    	let h4;
    	let t5;
    	let html_tag;
    	let raw_value = /*data*/ ctx[2][/*i*/ ctx[1]].onboarding + "";
    	let t6;
    	let p;
    	let span;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			h2 = element("h2");
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			em = element("em");
    			t2 = text(t2_value);
    			t3 = space();
    			h4 = element("h4");
    			h4.textContent = "Want to get involved?";
    			t5 = space();
    			html_tag = new HtmlTag();
    			t6 = space();
    			p = element("p");
    			span = element("span");
    			span.textContent = "See more organizations";
    			attr(a, "href", a_href_value = /*data*/ ctx[2][/*i*/ ctx[1]].website);
    			attr(a, "target", "_blank");
    			html_tag.a = t6;
    			set_style(span, "color", "blue");
    			set_style(span, "text-decoration", "underline");
    			set_style(span, "cursor", "pointer");
    		},
    		m(target, anchor) {
    			insert(target, h2, anchor);
    			append(h2, a);
    			append(a, t0);
    			insert(target, t1, anchor);
    			insert(target, em, anchor);
    			append(em, t2);
    			insert(target, t3, anchor);
    			insert(target, h4, anchor);
    			insert(target, t5, anchor);
    			html_tag.m(raw_value, target, anchor);
    			insert(target, t6, anchor);
    			insert(target, p, anchor);
    			append(p, span);

    			if (!mounted) {
    				dispose = listen(span, "click", /*click_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*data, i*/ 6 && t0_value !== (t0_value = /*data*/ ctx[2][/*i*/ ctx[1]].org + "")) set_data(t0, t0_value);

    			if (dirty & /*data, i*/ 6 && a_href_value !== (a_href_value = /*data*/ ctx[2][/*i*/ ctx[1]].website)) {
    				attr(a, "href", a_href_value);
    			}

    			if (dirty & /*data, i*/ 6 && t2_value !== (t2_value = /*data*/ ctx[2][/*i*/ ctx[1]].summary + "")) set_data(t2, t2_value);
    			if (dirty & /*data, i*/ 6 && raw_value !== (raw_value = /*data*/ ctx[2][/*i*/ ctx[1]].onboarding + "")) html_tag.p(raw_value);
    		},
    		d(detaching) {
    			if (detaching) detach(h2);
    			if (detaching) detach(t1);
    			if (detaching) detach(em);
    			if (detaching) detach(t3);
    			if (detaching) detach(h4);
    			if (detaching) detach(t5);
    			if (detaching) html_tag.d();
    			if (detaching) detach(t6);
    			if (detaching) detach(p);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let h30;
    	let t1;
    	let h31;
    	let t3;

    	function select_block_type(ctx, dirty) {
    		if (/*content*/ ctx[0]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			h30 = element("h3");
    			h30.textContent = "Ready to fight for a livable world?";
    			t1 = space();
    			h31 = element("h3");
    			h31.textContent = "Here are direct climate action organizations near you.";
    			t3 = space();
    			if_block.c();
    			attr(div, "id", "banner");
    			set_style(div, "border", "solid 1px black");
    			set_style(div, "padding", "10px");
    			attr(div, "class", "svelte-lncimr");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h30);
    			append(div, t1);
    			append(div, h31);
    			append(div, t3);
    			if_block.m(div, null);
    		},
    		p(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if_block.d();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let coordinates;
    	let city;
    	let content = false;
    	let i = 0;
    	let data = [];

    	// let data = [
    	//     {"org": `XR ${city}`,
    	//     "summary": `XR ${city} is an organization focused on direct action in ${city}, based on XR principles.  We're looking for supporters who are ready to take to the streets with us and are willing to provide capacity, help with operations, and be willing to get arrested.`,
    	//     "coordinates": `${coordinates}`,
    	//     "city": `${city}`,
    	//     "country": "USA",
    	//     "website": "https://www.xrdc.org/",
    	//     "onboarding": `<p>To get onboarded, fill out <a target="_blank" href="https://actionnetwork.org/forms/xrdc-rebel-card?source=direct_link">this form</a> and we'll be in touch with next steps!</p>`,
    	//     "form_url": "https://actionnetwork.org/forms/xrdc-rebel-card?source=direct_link",
    	//     "events_url": "https://www.xrdc.org/events",
    	//     "contact_email": "declareemergency@protonmail.com"
    	//     },
    	//     {"org": "Declare Emergency",
    	//     "summary": "Declare Emergency is an organization focused on direct action in the Washington DC area, to get the U.S. government to declare a climate emergency.  We're looking for supporters who are ready to take to the streets with us and are willing to provide capacity, help with operations, and be willing to get arrested.",
    	//     "coordinates": "38.889248, -77.050636",
    	//     "city": "Washington DC",
    	//     "country": "USA",
    	//     "website": "https://www.declareemergency.org/",
    	//     "onboarding": `<p>To get onboarded, fill out <a target="_blank" href="https://actionnetwork.org/forms/d02bf10d60ec3acb502016dc0f8bf1226deb8714">this form</a>, and register for one of this week's Zoom calls at <a target="_blank" href="https://linktr.ee/declareemergency">https://linktr.ee/declareemergency</a></p>`,
    	//     "form_url": "https://actionnetwork.org/forms/d02bf10d60ec3acb502016dc0f8bf1226deb8714",
    	//     "events_url": "https://linktr.ee/declareemergency",
    	//     "contact_email": "declareemergency@protonmail.com"
    	//     },
    	//     {"org": "XR DC",
    	//     "summary": "XR DC is an organization focused on direct action in the Washington DC area, based on XR principles.  We're looking for supporters who are ready to take to the streets with us and are willing to provide capacity, help with operations, and be willing to get arrested.",
    	//     "coordinates": "38.889248, -77.050636",
    	//     "city": "Washington DC",
    	//     "country": "USA",
    	//     "website": "https://www.xrdc.org/",
    	//     "onboarding": `<p>To get onboarded, fill out <a target="_blank" href="https://actionnetwork.org/forms/xrdc-rebel-card?source=direct_link">this form</a> and we'll be in touch with next steps!</p>`,
    	//     "form_url": "https://actionnetwork.org/forms/xrdc-rebel-card?source=direct_link",
    	//     "events_url": "https://www.xrdc.org/events",
    	//     "contact_email": "extinctionrebelliondc@protonmail.com"
    	//     },
    	//     {"org": "XR San Francisco",
    	//     "summary": "XR San Francisco is an organization focused on direct action in the Bay Area, based on XR principles.  We're looking for supporters who are ready to take to the streets with us and are willing to provide capacity, help with operations, and be willing to get arrested.",
    	//     "coordinates": "37.733795, -122.446747",
    	//     "city": "San Francisco",
    	//     "country": "USA",
    	//     "website": "https://extinctionrebellionsfbay.org/",
    	//     "onboarding": `<p>Onboarding</p><p>1. <a target="_blank" href="https://www.youtube.com/watch?v=UKFU0kPgF_M">Watch a 30 minute orientation</a> to learn more about Extinction Rebellion SF Bay.</p><p>After watching the orientation video, sign up for a 30 minute 1:1 chat with an XR SF Bay organizer to ask any questions and find your place in our chapter:</p>
    	//     <ul>
    	//         <li><a href="https://calendly.com/gretchen-sf/30min" target="_blank">Schedule time with Gretchen</a> (outreach, general questions)</li>
    	//         <li><a href="https://calendly.com/xrsfwelcome/121_chat" target="_blank">Schedule time with Betsy</a> (street theater, outreach, general questions)</li>
    	//         <li><a href="https://calendly.com/rayekahn/30min" target="_blank">Schedule time with Raye</a> (nonviolent direct action, regenerative cultures)</li>
    	//         <li><a href="https://calendly.com/tiffanybbarber/30min" target="_blank">Schedule time with Tiffany</a> (digital strategy, outreach and training)</li>
    	//         <li><a href="https://calendly.com/leahredwood/30min" target="_blank">Schedule time with Leah</a> (action planning, allyship, finance)</li>
    	//         <li><a href="https://calendly.com/jadenorthrup_xrsfbay/30min" target="_blank">Schedule time with Jade</a> (social media, photo/video, tech)</li>
    	//         </ul>
    	//         <p>Alternatively: check out our <a href="https://docs.google.com/document/d/1yksVh2xTR3cZUIJy72xFVVEB_rPtL4fpRquJ1wZKZ9I/edit?usp=sharing" target="_blank">Starter Guide</a> if you'd like an in-depth read or contact a <a href="https://extinctionrebellionsfbay.org/connect" target="_blank">working group</a> if you have questions.</p>`,
    	//     "form_url": "https://actionnetwork.org/forms/xr-bay-area-sign-up",
    	//     "events_url": "https://extinctionrebellionsfbay.org/events/",
    	//     "contact_email": "dawg@xrsfbay.org"
    	//     },
    	// ]
    	onMount(async () => {
    		// console.log(page);
    		ipToCoordinates();
    	});

    	// We take the user's IP, get coordinates from it (an approximate location — usually the data center nearest them), and update the map location to those coordinates.
    	async function ipToCoordinates() {
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

    		city = json.city;
    		$$invalidate(0, content = true);

    		$$invalidate(2, data = $$invalidate(2, data = [
    			{
    				"org": `XR ${city}`,
    				"summary": `XR ${city} is an organization focused on direct action in ${city}, based on XR principles.  We're looking for supporters who are ready to take to the streets with us and are willing to provide capacity, help with operations, and be willing to get arrested.`,
    				"coordinates": `${coordinates}`,
    				"city": `${city}`,
    				"country": "USA",
    				"website": "https://www.xrdc.org/",
    				"onboarding": `<p>To get onboarded, fill out <a target="_blank" href="https://actionnetwork.org/forms/sign-your-affinity-group-up-for-g7-cop26">this form</a> and we'll be in touch with next steps!</p>`,
    				"form_url": "https://actionnetwork.org/forms/sign-your-affinity-group-up-for-g7-cop26",
    				"events_url": "https://www.xrdc.org/events",
    				"contact_email": `xr${city.charAt(0).toLowerCase()}${city.slice(1)}@...`
    			},
    			{
    				"org": "Declare Emergency",
    				"summary": "Declare Emergency is an organization focused on direct action in the Washington DC area, to get the U.S. government to declare a climate emergency.  We're looking for supporters who are ready to take to the streets with us and are willing to provide capacity, help with operations, and be willing to get arrested.",
    				"coordinates": "38.889248, -77.050636",
    				"city": "Washington DC",
    				"country": "USA",
    				"website": "https://www.declareemergency.org/",
    				"onboarding": `<p>To get onboarded, fill out <a target="_blank" href="https://actionnetwork.org/forms/d02bf10d60ec3acb502016dc0f8bf1226deb8714">this form</a>, and register for one of this week's Zoom calls at <a target="_blank" href="https://linktr.ee/declareemergency">https://linktr.ee/declareemergency</a></p>`,
    				"form_url": "https://actionnetwork.org/forms/d02bf10d60ec3acb502016dc0f8bf1226deb8714",
    				"events_url": "https://linktr.ee/declareemergency",
    				"contact_email": "declareemergency@protonmail.com"
    			},
    			{
    				"org": "XR DC",
    				"summary": "XR DC is an organization focused on direct action in the Washington DC area, based on XR principles.  We're looking for supporters who are ready to take to the streets with us and are willing to provide capacity, help with operations, and be willing to get arrested.",
    				"coordinates": "38.889248, -77.050636",
    				"city": "Washington DC",
    				"country": "USA",
    				"website": "https://www.xrdc.org/",
    				"onboarding": `<p>To get onboarded, fill out <a target="_blank" href="https://actionnetwork.org/forms/xrdc-rebel-card?source=direct_link">this form</a> and we'll be in touch with next steps!</p>`,
    				"form_url": "https://actionnetwork.org/forms/xrdc-rebel-card?source=direct_link",
    				"events_url": "https://www.xrdc.org/events",
    				"contact_email": "extinctionrebelliondc@protonmail.com"
    			},
    			{
    				"org": "XR San Francisco",
    				"summary": "XR San Francisco is an organization focused on direct action in the Bay Area, based on XR principles.  We're looking for supporters who are ready to take to the streets with us and are willing to provide capacity, help with operations, and be willing to get arrested.",
    				"coordinates": "37.733795, -122.446747",
    				"city": "San Francisco",
    				"country": "USA",
    				"website": "https://extinctionrebellionsfbay.org/",
    				"onboarding": `<p>Onboarding</p><p>1. <a target="_blank" href="https://www.youtube.com/watch?v=UKFU0kPgF_M">Watch a 30 minute orientation</a> to learn more about Extinction Rebellion SF Bay.</p><p>After watching the orientation video, sign up for a 30 minute 1:1 chat with an XR SF Bay organizer to ask any questions and find your place in our chapter:</p>
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
    				"events_url": "https://extinctionrebellionsfbay.org/events/",
    				"contact_email": "dawg@xrsfbay.org"
    			}
    		]));

    		console.log(data[0]);
    	} // for (j = 0; j < data.length ; j++) {
    	//     if (city == data[j].city) {

    	const click_handler = function () {
    		i < data.length - 1
    		? $$invalidate(1, i = i + 1)
    		: $$invalidate(1, i = 0);

    		document.getElementById("banner").scrollTop = 80;
    	};

    	return [content, i, data, click_handler];
    }

    class Embed extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {}, add_css);
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
