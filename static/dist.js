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
    	append_styles(target, "svelte-k5gabr", ".dark.svelte-k5gabr input.svelte-k5gabr,.dark.svelte-k5gabr textarea.svelte-k5gabr{background:none;color:white;border:none;outline:none;border-bottom:solid 1px white}.dark.svelte-k5gabr input.svelte-k5gabr:focus,.dark.svelte-k5gabr textarea.svelte-k5gabr:focus{border-color:#a4d2ff;box-shadow:0 0 6px #1b6ac97f;outline:none}#banner.svelte-k5gabr.svelte-k5gabr{overflow-y:scroll;border:solid 1px black;padding:10px;background:black;color:white;font-family:Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\",Segoe UI Symbol,\"Noto Color Emoji\"}@media only screen and (min-width: 601px){#banner.svelte-k5gabr.svelte-k5gabr{max-width:fit-content;max-height:300px}}@media only screen and (max-width: 600px){#banner.svelte-k5gabr.svelte-k5gabr{max-width:100%;max-height:200px}}form.svelte-k5gabr label.svelte-k5gabr,form.svelte-k5gabr p.svelte-k5gabr,form.svelte-k5gabr input.svelte-k5gabr{display:block}form.svelte-k5gabr label.svelte-k5gabr{margin-top:10px}.flex-row.svelte-k5gabr.svelte-k5gabr{display:flex}.flex-row.svelte-k5gabr div.svelte-k5gabr:not(:first-of-type){margin-left:10px}.greenbutton.svelte-k5gabr.svelte-k5gabr{border-radius:20px;color:#fff;border:none;background:#2da562;padding:0.25em 1em;margin-top:10px;font-size:16px;cursor:pointer;margin-left:auto;display:block;margin-top:20px}");
    }

    // (132:16) {:else}
    function create_else_block(ctx) {
    	let p0;
    	let t1;
    	let p1;
    	let strong0;
    	let t3;
    	let t4_value = /*submit_results*/ ctx[0].email + "";
    	let t4;
    	let t5;
    	let p2;
    	let strong1;
    	let t7;
    	let t8_value = /*submit_results*/ ctx[0].address + "";
    	let t8;
    	let t9;
    	let p3;
    	let strong2;
    	let t11;
    	let t12_value = /*submit_results*/ ctx[0].interests + "";
    	let t12;

    	return {
    		c() {
    			p0 = element("p");
    			p0.innerHTML = `<em>Perfect!  Now look out for an email connecting you to local climate action groups in your area, and more information about leading real change.</em>`;
    			t1 = space();
    			p1 = element("p");
    			strong0 = element("strong");
    			strong0.textContent = "Email";
    			t3 = text(": ");
    			t4 = text(t4_value);
    			t5 = space();
    			p2 = element("p");
    			strong1 = element("strong");
    			strong1.textContent = "Address";
    			t7 = text(": ");
    			t8 = text(t8_value);
    			t9 = space();
    			p3 = element("p");
    			strong2 = element("strong");
    			strong2.textContent = "Interests and skills";
    			t11 = text(": ");
    			t12 = text(t12_value);
    		},
    		m(target, anchor) {
    			insert(target, p0, anchor);
    			insert(target, t1, anchor);
    			insert(target, p1, anchor);
    			append(p1, strong0);
    			append(p1, t3);
    			append(p1, t4);
    			insert(target, t5, anchor);
    			insert(target, p2, anchor);
    			append(p2, strong1);
    			append(p2, t7);
    			append(p2, t8);
    			insert(target, t9, anchor);
    			insert(target, p3, anchor);
    			append(p3, strong2);
    			append(p3, t11);
    			append(p3, t12);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*submit_results*/ 1 && t4_value !== (t4_value = /*submit_results*/ ctx[0].email + "")) set_data(t4, t4_value);
    			if (dirty & /*submit_results*/ 1 && t8_value !== (t8_value = /*submit_results*/ ctx[0].address + "")) set_data(t8, t8_value);
    			if (dirty & /*submit_results*/ 1 && t12_value !== (t12_value = /*submit_results*/ ctx[0].interests + "")) set_data(t12, t12_value);
    		},
    		d(detaching) {
    			if (detaching) detach(p0);
    			if (detaching) detach(t1);
    			if (detaching) detach(p1);
    			if (detaching) detach(t5);
    			if (detaching) detach(p2);
    			if (detaching) detach(t9);
    			if (detaching) detach(p3);
    		}
    	};
    }

    // (101:8) {#if !submit_results}
    function create_if_block(ctx) {
    	let form;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			form = element("form");

    			form.innerHTML = `<div style="text-align: center"><h3>Ready for <span style="color: palegreen; font-weight: bold">climate action</span>?</h3> 
            <p class="svelte-k5gabr">Add your details below, and we&#39;ll connect you with local groups and drive action together.</p></div> 

            <div class="flex-row svelte-k5gabr" style="margin: auto; width: fit-content;"><div class="svelte-k5gabr"><label for="email" class="svelte-k5gabr">Email</label> 
                    <input style="width: 150px; font-size: 16px; margin-top: 5px;" type="email" name="email" placeholder="" required="" class="svelte-k5gabr"/></div> 
                <div class="svelte-k5gabr"><label for="address" class="svelte-k5gabr">Address</label> 
                    <input style="width: 200px; font-size: 16px; margin-top: 5px;" type="text" name="address" required="" class="svelte-k5gabr"/></div> 
                    <div class="svelte-k5gabr"><label for="interests" class="svelte-k5gabr">Describe your interests and skills</label> 
                        <textarea style="width: 300px; height: 21.5px;" name="interests" class="svelte-k5gabr"></textarea></div></div> 
            <div><button class="greenbutton svelte-k5gabr">Submit</button></div>`;

    			attr(form, "class", "dark svelte-k5gabr");
    		},
    		m(target, anchor) {
    			insert(target, form, anchor);

    			if (!mounted) {
    				dispose = listen(form, "submit", /*submitForm*/ ctx[1]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(form);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;

    	function select_block_type(ctx, dirty) {
    		if (!/*submit_results*/ ctx[0]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			if_block.c();
    			attr(div, "id", "banner");
    			attr(div, "class", "svelte-k5gabr");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
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
    	let submit_results;

    	onMount(async () => {
    		
    	}); //   ipToCoordinates()

    	async function submitForm(e) {
    		var formData = new FormData(e.target);

    		// formData.append('arrest', arrest);
    		// formData.append('support_needed', support_needed);
    		// formData.append('chance_of_success_needed', chance_of_success_needed);
    		// formData.append('other_support_needed', other_support_needed);
    		// formData.append('contribution_areas', contribution_areas);
    		// formData.append('other_contributions', other_contributions);
    		var object = {};

    		formData.forEach(function (value, key) {
    			object[key] = value;
    		});

    		var json = JSON.stringify(object);
    		console.log(json);

    		// object.support_needed = support_needed;
    		// object.contribution_areas = contribution_areas;
    		$$invalidate(0, submit_results = object);
    	} // console.log(submit_results);
    	// console.log(submit_results.support_needed);

    	return [submit_results, submitForm];
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
