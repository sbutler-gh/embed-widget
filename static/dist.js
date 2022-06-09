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
    	append_styles(target, "svelte-1q1mvlp", "#banner.svelte-1q1mvlp.svelte-1q1mvlp{overflow-y:scroll;border:solid 1px black;padding:10px;background:black;color:white;font-family:Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\",Segoe UI Symbol,\"Noto Color Emoji\"}@media only screen and (min-width: 601px){#banner.svelte-1q1mvlp.svelte-1q1mvlp{max-width:fit-content;max-height:300px}.lead.svelte-1q1mvlp.svelte-1q1mvlp{max-width:75%;margin:auto}.responsive.svelte-1q1mvlp .flex-row.svelte-1q1mvlp{display:flex}.flex-row.svelte-1q1mvlp .form-item.svelte-1q1mvlp{margin-left:20px}.form-item.svelte-1q1mvlp input.svelte-1q1mvlp{font-size:16px;margin-top:5px}.form-item.svelte-1q1mvlp textarea.svelte-1q1mvlp{height:21.5px;width:300px}#address_input.svelte-1q1mvlp.svelte-1q1mvlp{width:200px}.responsive.svelte-1q1mvlp input.svelte-1q1mvlp,.responsive.svelte-1q1mvlp textarea.svelte-1q1mvlp{background:none;color:white;border:none;outline:none;border-bottom:solid 1px white}.responsive.svelte-1q1mvlp input.svelte-1q1mvlp:focus,.responsive.svelte-1q1mvlp textarea.svelte-1q1mvlp:focus{border-color:#a4d2ff;box-shadow:0 0 6px #1b6ac97f;outline:none}}@media only screen and (max-width: 600px){#banner.svelte-1q1mvlp.svelte-1q1mvlp{max-width:100%;max-height:200px}.responsive.svelte-1q1mvlp.svelte-1q1mvlp{border-radius:10px;padding:10px;background:white;border:solid 2px lightblue;color:black;text-align:left !important;max-width:300px;margin:auto}.responsive.svelte-1q1mvlp input.svelte-1q1mvlp:not(.range_input){border:solid lightgrey 1px;border-radius:5px;padding:0.5rem;font-size:16px;max-width:75%}.responsive.svelte-1q1mvlp textarea.svelte-1q1mvlp{border:solid lightgrey 1px;border-radius:5px;padding:0.25rem;font-size:14px;max-width:100%}#address_input.svelte-1q1mvlp.svelte-1q1mvlp{max-width:90%;width:300px}.responsive.svelte-1q1mvlp input.svelte-1q1mvlp:focus:not(.range_input),.responsive.svelte-1q1mvlp textarea.svelte-1q1mvlp:focus{border-color:#a4d2ff;box-shadow:0 0 6px #1b6ac97f;outline:none}.responsive.svelte-1q1mvlp button.svelte-1q1mvlp{border-radius:20px;color:#fff;border:none;background:#2da562;padding:0.5em 2em;margin-top:10px;font-size:16px;cursor:pointer;margin-left:auto;display:block}}form.svelte-1q1mvlp label.svelte-1q1mvlp,form.svelte-1q1mvlp input.svelte-1q1mvlp{display:block}form.svelte-1q1mvlp label.svelte-1q1mvlp{margin-top:10px}.greenbutton.svelte-1q1mvlp.svelte-1q1mvlp{border-radius:20px;color:#fff;border:none;background:#2da562;padding:0.25em 1em;margin-top:10px;font-size:16px;cursor:pointer;margin-left:auto;display:block;margin-top:20px}");
    }

    // (131:16) {:else}
    function create_else_block(ctx) {
    	let p0;
    	let t1;
    	let p1;
    	let t3;
    	let p2;
    	let strong0;
    	let t5;
    	let t6_value = /*submit_results*/ ctx[0].email + "";
    	let t6;
    	let t7;
    	let p3;
    	let strong1;
    	let t9;
    	let t10_value = /*submit_results*/ ctx[0].address + "";
    	let t10;
    	let t11;
    	let p4;
    	let strong2;
    	let t13;
    	let t14_value = /*submit_results*/ ctx[0].interests + "";
    	let t14;

    	return {
    		c() {
    			p0 = element("p");
    			p0.innerHTML = `<em>Perfect!  Now look out for an email connecting you to local climate action groups in your area, and more information about leading real change.</em>`;
    			t1 = space();
    			p1 = element("p");
    			p1.textContent = "(This is a demo of what the form submission could look like — there isn't an email being sent at this time.)";
    			t3 = space();
    			p2 = element("p");
    			strong0 = element("strong");
    			strong0.textContent = "Email";
    			t5 = text(": ");
    			t6 = text(t6_value);
    			t7 = space();
    			p3 = element("p");
    			strong1 = element("strong");
    			strong1.textContent = "Address";
    			t9 = text(": ");
    			t10 = text(t10_value);
    			t11 = space();
    			p4 = element("p");
    			strong2 = element("strong");
    			strong2.textContent = "Interests and skills";
    			t13 = text(": ");
    			t14 = text(t14_value);
    		},
    		m(target, anchor) {
    			insert(target, p0, anchor);
    			insert(target, t1, anchor);
    			insert(target, p1, anchor);
    			insert(target, t3, anchor);
    			insert(target, p2, anchor);
    			append(p2, strong0);
    			append(p2, t5);
    			append(p2, t6);
    			insert(target, t7, anchor);
    			insert(target, p3, anchor);
    			append(p3, strong1);
    			append(p3, t9);
    			append(p3, t10);
    			insert(target, t11, anchor);
    			insert(target, p4, anchor);
    			append(p4, strong2);
    			append(p4, t13);
    			append(p4, t14);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*submit_results*/ 1 && t6_value !== (t6_value = /*submit_results*/ ctx[0].email + "")) set_data(t6, t6_value);
    			if (dirty & /*submit_results*/ 1 && t10_value !== (t10_value = /*submit_results*/ ctx[0].address + "")) set_data(t10, t10_value);
    			if (dirty & /*submit_results*/ 1 && t14_value !== (t14_value = /*submit_results*/ ctx[0].interests + "")) set_data(t14, t14_value);
    		},
    		d(detaching) {
    			if (detaching) detach(p0);
    			if (detaching) detach(t1);
    			if (detaching) detach(p1);
    			if (detaching) detach(t3);
    			if (detaching) detach(p2);
    			if (detaching) detach(t7);
    			if (detaching) detach(p3);
    			if (detaching) detach(t11);
    			if (detaching) detach(p4);
    		}
    	};
    }

    // (101:8) {#if !submit_results}
    function create_if_block(ctx) {
    	let div0;
    	let t5;
    	let form;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div0 = element("div");

    			div0.innerHTML = `<h3>Ready for <span style="color: palegreen; font-weight: bold">climate action</span>?</h3> 
            <p style="">Connect with local climate groups, and help drive collective action.</p>`;

    			t5 = space();
    			form = element("form");

    			form.innerHTML = `<div class="flex-row svelte-1q1mvlp" style="margin: auto; width: fit-content;"><div class="form-item svelte-1q1mvlp"><label for="email" class="svelte-1q1mvlp">Email</label> 
                    <input style="" type="email" name="email" placeholder="" required="" class="svelte-1q1mvlp"/></div> 
                <div class="form-item svelte-1q1mvlp"><label for="address" class="svelte-1q1mvlp">Address</label> 
                    <input id="address_input" style="" type="text" name="address" placeholder="123 Main Street, New York, NY, 12345" required="" class="svelte-1q1mvlp"/></div> 
                    <div class="form-item svelte-1q1mvlp"><label for="interests" class="svelte-1q1mvlp">Describe your interests and skills</label> 
                        <textarea style="width: 300px;" name="interests" class="svelte-1q1mvlp"></textarea></div></div> 
            <div class="form-item"><button class="greenbutton svelte-1q1mvlp">Submit</button></div>`;

    			attr(div0, "class", "lead svelte-1q1mvlp");
    			set_style(div0, "text-align", "center");
    			attr(form, "class", "responsive svelte-1q1mvlp");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t5, anchor);
    			insert(target, form, anchor);

    			if (!mounted) {
    				dispose = listen(form, "submit", /*submitForm*/ ctx[1]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t5);
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
    			attr(div, "class", "svelte-1q1mvlp");
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
