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
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function get_binding_group_value(group, __value, checked) {
        const value = new Set();
        for (let i = 0; i < group.length; i += 1) {
            if (group[i].checked)
                value.add(group[i].__value);
        }
        if (!checked) {
            value.delete(__value);
        }
        return Array.from(value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
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
    	append_styles(target, "svelte-wppxrz", "#banner.svelte-wppxrz.svelte-wppxrz{overflow-y:scroll;border:solid 1px black;padding:10px;background:black;color:white;font-family:Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\",Segoe UI Symbol,\"Noto Color Emoji\"}@media only screen and (min-width: 601px){#banner.svelte-wppxrz.svelte-wppxrz{max-width:fit-content;max-height:300px}}@media only screen and (max-width: 600px){#banner.svelte-wppxrz.svelte-wppxrz{max-width:100%;max-height:200px}}form.svelte-wppxrz label.svelte-wppxrz,form.svelte-wppxrz p.svelte-wppxrz,form.svelte-wppxrz input.svelte-wppxrz{display:block}form.svelte-wppxrz label.svelte-wppxrz{margin-top:10px}.checkbox.svelte-wppxrz.svelte-wppxrz{text-align:left;max-width:100%;margin-top:10px}.checkbox.svelte-wppxrz input.svelte-wppxrz{margin-right:5px}.checkbox.svelte-wppxrz input.svelte-wppxrz,.checkbox.svelte-wppxrz label.svelte-wppxrz,.radio.svelte-wppxrz input.svelte-wppxrz,.radio.svelte-wppxrz label.svelte-wppxrz{display:inline;font-size:14px}.radio.svelte-wppxrz.svelte-wppxrz{margin-top:5px}.radio.svelte-wppxrz label.svelte-wppxrz:not(:first-of-type){margin-left:5px}.flex-row.svelte-wppxrz.svelte-wppxrz{display:flex}.flex-row.svelte-wppxrz div.svelte-wppxrz:not(:first-of-type){margin-left:10px}.light.svelte-wppxrz.svelte-wppxrz{border-radius:10px;padding:10px;background:white;border:solid 2px lightblue;color:black;text-align:left !important;max-width:300px;margin:auto}.light.svelte-wppxrz input.svelte-wppxrz:not(.range_input){border:solid lightgrey 1px;border-radius:5px;padding:0.5rem;font-size:16px;max-width:75%}.light.svelte-wppxrz textarea.svelte-wppxrz{border:solid lightgrey 1px;border-radius:5px;padding:0.25rem;font-size:14px;max-width:100%}.range_input.svelte-wppxrz.svelte-wppxrz{background:none;border:none;border-bottom:solid 1px #f0f0f0;color:black;width:25px;display:inline;font-size:16px;padding:0.5rem;outline:none}.light.svelte-wppxrz input.svelte-wppxrz:focus:not(.range_input),.light.svelte-wppxrz textarea.svelte-wppxrz:focus{border-color:#a4d2ff;box-shadow:0 0 6px #1b6ac97f;outline:none}.light.svelte-wppxrz button.svelte-wppxrz{border-radius:20px;color:#fff;border:none;background:#2da562;padding:0.5em 2em;margin-top:10px;font-size:16px;cursor:pointer;margin-left:auto;display:block}.question.svelte-wppxrz.svelte-wppxrz{font-weight:500}");
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[44] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[47] = list[i];
    	return child_ctx;
    }

    // (228:16) {:else}
    function create_else_block(ctx) {
    	let p0;
    	let strong0;
    	let t1;
    	let t2_value = /*submit_results*/ ctx[8].email + "";
    	let t2;
    	let t3;
    	let p1;
    	let strong1;
    	let t5;
    	let t6_value = /*submit_results*/ ctx[8].postal + "";
    	let t6;
    	let t7;
    	let p2;
    	let strong2;
    	let t9;
    	let t10_value = /*submit_results*/ ctx[8].country + "";
    	let t10;
    	let t11;
    	let p3;
    	let strong3;
    	let t13;
    	let t14;
    	let t15;
    	let t16;
    	let t17;
    	let p4;
    	let t20;
    	let p5;
    	let t21;
    	let if_block0 = /*submit_results*/ ctx[8].support_needed.length > 0 && create_if_block_6(ctx);
    	let if_block1 = /*submit_results*/ ctx[8].contribution_areas.length > 0 && create_if_block_5(ctx);

    	return {
    		c() {
    			p0 = element("p");
    			strong0 = element("strong");
    			strong0.textContent = "Email";
    			t1 = text(": ");
    			t2 = text(t2_value);
    			t3 = space();
    			p1 = element("p");
    			strong1 = element("strong");
    			strong1.textContent = "Zip/Postal Code";
    			t5 = text(": ");
    			t6 = text(t6_value);
    			t7 = space();
    			p2 = element("p");
    			strong2 = element("strong");
    			strong2.textContent = "Country";
    			t9 = text(": ");
    			t10 = text(t10_value);
    			t11 = space();
    			p3 = element("p");
    			strong3 = element("strong");
    			strong3.textContent = "Willing to risk arrest?";
    			t13 = text(": ");
    			t14 = text(/*arrest*/ ctx[2]);
    			t15 = space();
    			if (if_block0) if_block0.c();
    			t16 = space();
    			if (if_block1) if_block1.c();
    			t17 = space();
    			p4 = element("p");
    			p4.innerHTML = `<strong>Other skills/ways to contribute</strong>:`;
    			t20 = space();
    			p5 = element("p");
    			t21 = text(/*other_contributions*/ ctx[7]);
    			attr(p0, "class", "svelte-wppxrz");
    			attr(p1, "class", "svelte-wppxrz");
    			attr(p2, "class", "svelte-wppxrz");
    			attr(p3, "class", "svelte-wppxrz");
    			attr(p4, "class", "svelte-wppxrz");
    			attr(p5, "class", "svelte-wppxrz");
    		},
    		m(target, anchor) {
    			insert(target, p0, anchor);
    			append(p0, strong0);
    			append(p0, t1);
    			append(p0, t2);
    			insert(target, t3, anchor);
    			insert(target, p1, anchor);
    			append(p1, strong1);
    			append(p1, t5);
    			append(p1, t6);
    			insert(target, t7, anchor);
    			insert(target, p2, anchor);
    			append(p2, strong2);
    			append(p2, t9);
    			append(p2, t10);
    			insert(target, t11, anchor);
    			insert(target, p3, anchor);
    			append(p3, strong3);
    			append(p3, t13);
    			append(p3, t14);
    			insert(target, t15, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t16, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, t17, anchor);
    			insert(target, p4, anchor);
    			insert(target, t20, anchor);
    			insert(target, p5, anchor);
    			append(p5, t21);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*submit_results*/ 256 && t2_value !== (t2_value = /*submit_results*/ ctx[8].email + "")) set_data(t2, t2_value);
    			if (dirty[0] & /*submit_results*/ 256 && t6_value !== (t6_value = /*submit_results*/ ctx[8].postal + "")) set_data(t6, t6_value);
    			if (dirty[0] & /*submit_results*/ 256 && t10_value !== (t10_value = /*submit_results*/ ctx[8].country + "")) set_data(t10, t10_value);
    			if (dirty[0] & /*arrest*/ 4) set_data(t14, /*arrest*/ ctx[2]);

    			if (/*submit_results*/ ctx[8].support_needed.length > 0) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_6(ctx);
    					if_block0.c();
    					if_block0.m(t16.parentNode, t16);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*submit_results*/ ctx[8].contribution_areas.length > 0) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_5(ctx);
    					if_block1.c();
    					if_block1.m(t17.parentNode, t17);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty[0] & /*other_contributions*/ 128) set_data(t21, /*other_contributions*/ ctx[7]);
    		},
    		d(detaching) {
    			if (detaching) detach(p0);
    			if (detaching) detach(t3);
    			if (detaching) detach(p1);
    			if (detaching) detach(t7);
    			if (detaching) detach(p2);
    			if (detaching) detach(t11);
    			if (detaching) detach(p3);
    			if (detaching) detach(t15);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t16);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach(t17);
    			if (detaching) detach(p4);
    			if (detaching) detach(t20);
    			if (detaching) detach(p5);
    		}
    	};
    }

    // (111:12) {#if !submit_results}
    function create_if_block(ctx) {
    	let div0;
    	let t2;
    	let div3;
    	let div1;
    	let label1;
    	let t4;
    	let input1;
    	let t5;
    	let div2;
    	let label2;
    	let t7;
    	let input2;
    	let t8;
    	let div5;
    	let label3;
    	let t10;
    	let div4;
    	let input3;
    	let label4;
    	let t12;
    	let input4;
    	let label5;
    	let t14;
    	let input5;
    	let label6;
    	let t16;
    	let t17;
    	let if_block1_anchor;
    	let mounted;
    	let dispose;
    	let if_block0 = (/*arrest*/ ctx[2] == "no" || /*arrest*/ ctx[2] == "other") && create_if_block_2(ctx);
    	let if_block1 = /*arrest*/ ctx[2] && create_if_block_1(ctx);

    	return {
    		c() {
    			div0 = element("div");

    			div0.innerHTML = `<label for="email" class="svelte-wppxrz">Email</label> 
                    <input type="email" name="email" placeholder="" required="" class="svelte-wppxrz"/>`;

    			t2 = space();
    			div3 = element("div");
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "ZIP/Postal Code";
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "Country";
    			t7 = space();
    			input2 = element("input");
    			t8 = space();
    			div5 = element("div");
    			label3 = element("label");
    			label3.textContent = "Are you willing to risk arrest in frontline actions?";
    			t10 = space();
    			div4 = element("div");
    			input3 = element("input");
    			label4 = element("label");
    			label4.textContent = "Yes";
    			t12 = space();
    			input4 = element("input");
    			label5 = element("label");
    			label5.textContent = "No";
    			t14 = space();
    			input5 = element("input");
    			label6 = element("label");
    			label6.textContent = "Other";
    			t16 = space();
    			if (if_block0) if_block0.c();
    			t17 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			attr(label1, "for", "postal");
    			attr(label1, "class", "svelte-wppxrz");
    			set_style(input1, "width", "60px");
    			attr(input1, "type", "text");
    			attr(input1, "name", "postal");
    			attr(input1, "placeholder", "");
    			input1.required = true;
    			attr(input1, "class", "svelte-wppxrz");
    			attr(div1, "class", "svelte-wppxrz");
    			attr(label2, "for", "country");
    			attr(label2, "class", "svelte-wppxrz");
    			set_style(input2, "width", "30px");
    			attr(input2, "type", "text");
    			attr(input2, "name", "country");
    			attr(input2, "placeholder", "");
    			input2.required = true;
    			attr(input2, "class", "svelte-wppxrz");
    			set_style(div2, "margin-left", "30px");
    			attr(div2, "class", "svelte-wppxrz");
    			attr(div3, "class", "flex-row svelte-wppxrz");
    			attr(label3, "for", "arrest");
    			attr(label3, "class", "question svelte-wppxrz");
    			attr(input3, "type", "radio");
    			input3.__value = "yes";
    			input3.value = input3.__value;
    			input3.required = true;
    			attr(input3, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][2].push(input3);
    			attr(label4, "class", "svelte-wppxrz");
    			attr(input4, "type", "radio");
    			input4.__value = "no";
    			input4.value = input4.__value;
    			input4.required = true;
    			attr(input4, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][2].push(input4);
    			attr(label5, "class", "svelte-wppxrz");
    			attr(input5, "type", "radio");
    			input5.__value = "other";
    			input5.value = input5.__value;
    			input5.required = true;
    			attr(input5, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][2].push(input5);
    			attr(label6, "class", "svelte-wppxrz");
    			attr(div4, "class", "radio svelte-wppxrz");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t2, anchor);
    			insert(target, div3, anchor);
    			append(div3, div1);
    			append(div1, label1);
    			append(div1, t4);
    			append(div1, input1);
    			set_input_value(input1, /*postal*/ ctx[0]);
    			append(div3, t5);
    			append(div3, div2);
    			append(div2, label2);
    			append(div2, t7);
    			append(div2, input2);
    			set_input_value(input2, /*country*/ ctx[1]);
    			insert(target, t8, anchor);
    			insert(target, div5, anchor);
    			append(div5, label3);
    			append(div5, t10);
    			append(div5, div4);
    			append(div4, input3);
    			input3.checked = input3.__value === /*arrest*/ ctx[2];
    			append(div4, label4);
    			append(div4, t12);
    			append(div4, input4);
    			input4.checked = input4.__value === /*arrest*/ ctx[2];
    			append(div4, label5);
    			append(div4, t14);
    			append(div4, input5);
    			input5.checked = input5.__value === /*arrest*/ ctx[2];
    			append(div4, label6);
    			insert(target, t16, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t17, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, if_block1_anchor, anchor);

    			if (!mounted) {
    				dispose = [
    					listen(input1, "input", /*input1_input_handler*/ ctx[10]),
    					listen(input2, "input", /*input2_input_handler*/ ctx[11]),
    					listen(input3, "change", /*input3_change_handler*/ ctx[12]),
    					listen(input4, "change", /*input4_change_handler*/ ctx[14]),
    					listen(input5, "change", /*input5_change_handler*/ ctx[15])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*postal*/ 1 && input1.value !== /*postal*/ ctx[0]) {
    				set_input_value(input1, /*postal*/ ctx[0]);
    			}

    			if (dirty[0] & /*country*/ 2 && input2.value !== /*country*/ ctx[1]) {
    				set_input_value(input2, /*country*/ ctx[1]);
    			}

    			if (dirty[0] & /*arrest*/ 4) {
    				input3.checked = input3.__value === /*arrest*/ ctx[2];
    			}

    			if (dirty[0] & /*arrest*/ 4) {
    				input4.checked = input4.__value === /*arrest*/ ctx[2];
    			}

    			if (dirty[0] & /*arrest*/ 4) {
    				input5.checked = input5.__value === /*arrest*/ ctx[2];
    			}

    			if (/*arrest*/ ctx[2] == "no" || /*arrest*/ ctx[2] == "other") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					if_block0.m(t17.parentNode, t17);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*arrest*/ ctx[2]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t2);
    			if (detaching) detach(div3);
    			if (detaching) detach(t8);
    			if (detaching) detach(div5);
    			/*$$binding_groups*/ ctx[13][2].splice(/*$$binding_groups*/ ctx[13][2].indexOf(input3), 1);
    			/*$$binding_groups*/ ctx[13][2].splice(/*$$binding_groups*/ ctx[13][2].indexOf(input4), 1);
    			/*$$binding_groups*/ ctx[13][2].splice(/*$$binding_groups*/ ctx[13][2].indexOf(input5), 1);
    			if (detaching) detach(t16);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t17);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach(if_block1_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (233:16) {#if submit_results.support_needed.length > 0}
    function create_if_block_6(ctx) {
    	let p;
    	let t1;
    	let ul;
    	let each_value_1 = /*submit_results*/ ctx[8].support_needed;
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		c() {
    			p = element("p");
    			p.innerHTML = `<strong>Support needed before risking arrest:</strong>`;
    			t1 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(p, "class", "svelte-wppxrz");
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			insert(target, t1, anchor);
    			insert(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*submit_results*/ 256) {
    				each_value_1 = /*submit_results*/ ctx[8].support_needed;
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    			if (detaching) detach(t1);
    			if (detaching) detach(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (240:50) 
    function create_if_block_8(ctx) {
    	let li;
    	let t_value = /*submit_results*/ ctx[8].other_support_needed + "";
    	let t;

    	return {
    		c() {
    			li = element("li");
    			t = text(t_value);
    			set_style(li, "margin-left", "25px");
    			set_style(li, "margin-bottom", "10px");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*submit_results*/ 256 && t_value !== (t_value = /*submit_results*/ ctx[8].other_support_needed + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (238:24) {#if need == "enough_participants"}
    function create_if_block_7(ctx) {
    	let li;
    	let t0_value = /*submit_results*/ ctx[8].chance_of_success_needed + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text(t0_value);
    			t1 = text("% chance of success");
    			set_style(li, "margin-left", "25px");
    			set_style(li, "margin-bottom", "10px");
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*submit_results*/ 256 && t0_value !== (t0_value = /*submit_results*/ ctx[8].chance_of_success_needed + "")) set_data(t0, t0_value);
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (236:20) {#each submit_results.support_needed as need}
    function create_each_block_1(ctx) {
    	let li;
    	let t0_value = /*need*/ ctx[47] + "";
    	let t0;
    	let t1;
    	let t2;

    	function select_block_type_1(ctx, dirty) {
    		if (/*need*/ ctx[47] == "enough_participants") return create_if_block_7;
    		if (/*need*/ ctx[47] == "other") return create_if_block_8;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	return {
    		c() {
    			li = element("li");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    			if (if_block) if_block.m(li, null);
    			append(li, t2);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*submit_results*/ 256 && t0_value !== (t0_value = /*need*/ ctx[47] + "")) set_data(t0, t0_value);

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(li, t2);
    				}
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(li);

    			if (if_block) {
    				if_block.d();
    			}
    		}
    	};
    }

    // (247:16) {#if submit_results.contribution_areas.length > 0}
    function create_if_block_5(ctx) {
    	let p;
    	let t1;
    	let ul;
    	let each_value = /*submit_results*/ ctx[8].contribution_areas;
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			p = element("p");
    			p.innerHTML = `<strong>Areas willing to contribute:</strong>`;
    			t1 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(p, "class", "svelte-wppxrz");
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			insert(target, t1, anchor);
    			insert(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*submit_results*/ 256) {
    				each_value = /*submit_results*/ ctx[8].contribution_areas;
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    			if (detaching) detach(t1);
    			if (detaching) detach(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    // (250:20) {#each submit_results.contribution_areas as contribution}
    function create_each_block(ctx) {
    	let li;
    	let t0_value = /*contribution*/ ctx[44] + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text(t0_value);
    			t1 = space();
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*submit_results*/ 256 && t0_value !== (t0_value = /*contribution*/ ctx[44] + "")) set_data(t0, t0_value);
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (137:16) {#if arrest == "no" || arrest == "other"}
    function create_if_block_2(ctx) {
    	let div7;
    	let label0;
    	let t1;
    	let div0;
    	let input0;
    	let label1;
    	let br0;
    	let t3;
    	let show_if_1 = /*support_needed*/ ctx[3].includes('enough_participants');
    	let t4;
    	let div1;
    	let input1;
    	let label2;
    	let br1;
    	let t6;
    	let div2;
    	let input2;
    	let label3;
    	let br2;
    	let t8;
    	let div3;
    	let input3;
    	let label4;
    	let br3;
    	let t10;
    	let div4;
    	let input4;
    	let label5;
    	let br4;
    	let t12;
    	let div5;
    	let input5;
    	let label6;
    	let br5;
    	let t14;
    	let div6;
    	let input6;
    	let label7;
    	let br6;
    	let t16;
    	let show_if = /*support_needed*/ ctx[3].includes('other');
    	let mounted;
    	let dispose;
    	let if_block0 = show_if_1 && create_if_block_4(ctx);
    	let if_block1 = show_if && create_if_block_3(ctx);

    	return {
    		c() {
    			div7 = element("div");
    			label0 = element("label");
    			label0.textContent = "What would support you in joining frontline actions and risking arrest?";
    			t1 = space();
    			div0 = element("div");
    			input0 = element("input");
    			label1 = element("label");
    			label1.textContent = "I need to know there will be enough people participating, to give our action a high chance of success (e.g. generating significant media attention)";
    			br0 = element("br");
    			t3 = space();
    			if (if_block0) if_block0.c();
    			t4 = space();
    			div1 = element("div");
    			input1 = element("input");
    			label2 = element("label");
    			label2.textContent = "I need to know participating won't affect my job security or ability to get employement.";
    			br1 = element("br");
    			t6 = space();
    			div2 = element("div");
    			input2 = element("input");
    			label3 = element("label");
    			label3.textContent = "I need to know that transport, childcare, bail, and all costs of participation will be covered for me.";
    			br2 = element("br");
    			t8 = space();
    			div3 = element("div");
    			input3 = element("input");
    			label4 = element("label");
    			label4.textContent = "I need to know the legal risks and the legal support provided to participants.";
    			br3 = element("br");
    			t10 = space();
    			div4 = element("div");
    			input4 = element("input");
    			label5 = element("label");
    			label5.textContent = "I need a friend willing to join me.";
    			br4 = element("br");
    			t12 = space();
    			div5 = element("div");
    			input5 = element("input");
    			label6 = element("label");
    			label6.textContent = "I want to meet others locally who are willing to risk arrest";
    			br5 = element("br");
    			t14 = space();
    			div6 = element("div");
    			input6 = element("input");
    			label7 = element("label");
    			label7.textContent = "Other";
    			br6 = element("br");
    			t16 = space();
    			if (if_block1) if_block1.c();
    			attr(label0, "for", "support");
    			set_style(label0, "width", "90%");
    			set_style(label0, "font-style", "italic");
    			set_style(label0, "font-size", "15px");
    			attr(label0, "class", "svelte-wppxrz");
    			attr(input0, "type", "checkbox");
    			input0.__value = "enough_participants";
    			input0.value = input0.__value;
    			attr(input0, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][1].push(input0);
    			attr(label1, "class", "svelte-wppxrz");
    			attr(div0, "class", "checkbox svelte-wppxrz");
    			attr(input1, "type", "checkbox");
    			input1.__value = "job_security";
    			input1.value = input1.__value;
    			attr(input1, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][1].push(input1);
    			attr(label2, "class", "svelte-wppxrz");
    			attr(div1, "class", "checkbox svelte-wppxrz");
    			attr(input2, "type", "checkbox");
    			input2.__value = "costs_will_be_covered";
    			input2.value = input2.__value;
    			attr(input2, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][1].push(input2);
    			attr(label3, "class", "svelte-wppxrz");
    			attr(div2, "class", "checkbox svelte-wppxrz");
    			attr(input3, "type", "checkbox");
    			input3.__value = "legal_information";
    			input3.value = input3.__value;
    			attr(input3, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][1].push(input3);
    			attr(label4, "class", "svelte-wppxrz");
    			attr(div3, "class", "checkbox svelte-wppxrz");
    			attr(input4, "type", "checkbox");
    			input4.__value = "friend_to_join";
    			input4.value = input4.__value;
    			attr(input4, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][1].push(input4);
    			attr(label5, "class", "svelte-wppxrz");
    			attr(div4, "class", "checkbox svelte-wppxrz");
    			attr(input5, "type", "checkbox");
    			input5.__value = "meet_others";
    			input5.value = input5.__value;
    			attr(input5, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][1].push(input5);
    			attr(label6, "class", "svelte-wppxrz");
    			attr(div5, "class", "checkbox svelte-wppxrz");
    			attr(input6, "type", "checkbox");
    			input6.__value = "other";
    			input6.value = input6.__value;
    			attr(input6, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][1].push(input6);
    			attr(label7, "class", "svelte-wppxrz");
    			attr(div6, "class", "checkbox svelte-wppxrz");
    			set_style(div7, "margin-top", "15px");
    		},
    		m(target, anchor) {
    			insert(target, div7, anchor);
    			append(div7, label0);
    			append(div7, t1);
    			append(div7, div0);
    			append(div0, input0);
    			input0.checked = ~/*support_needed*/ ctx[3].indexOf(input0.__value);
    			append(div0, label1);
    			append(div0, br0);
    			append(div7, t3);
    			if (if_block0) if_block0.m(div7, null);
    			append(div7, t4);
    			append(div7, div1);
    			append(div1, input1);
    			input1.checked = ~/*support_needed*/ ctx[3].indexOf(input1.__value);
    			append(div1, label2);
    			append(div1, br1);
    			append(div7, t6);
    			append(div7, div2);
    			append(div2, input2);
    			input2.checked = ~/*support_needed*/ ctx[3].indexOf(input2.__value);
    			append(div2, label3);
    			append(div2, br2);
    			append(div7, t8);
    			append(div7, div3);
    			append(div3, input3);
    			input3.checked = ~/*support_needed*/ ctx[3].indexOf(input3.__value);
    			append(div3, label4);
    			append(div3, br3);
    			append(div7, t10);
    			append(div7, div4);
    			append(div4, input4);
    			input4.checked = ~/*support_needed*/ ctx[3].indexOf(input4.__value);
    			append(div4, label5);
    			append(div4, br4);
    			append(div7, t12);
    			append(div7, div5);
    			append(div5, input5);
    			input5.checked = ~/*support_needed*/ ctx[3].indexOf(input5.__value);
    			append(div5, label6);
    			append(div5, br5);
    			append(div7, t14);
    			append(div7, div6);
    			append(div6, input6);
    			input6.checked = ~/*support_needed*/ ctx[3].indexOf(input6.__value);
    			append(div6, label7);
    			append(div6, br6);
    			append(div6, t16);
    			if (if_block1) if_block1.m(div6, null);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "change", /*input0_change_handler*/ ctx[16]),
    					listen(input1, "change", /*input1_change_handler*/ ctx[19]),
    					listen(input2, "change", /*input2_change_handler*/ ctx[20]),
    					listen(input3, "change", /*input3_change_handler_1*/ ctx[21]),
    					listen(input4, "change", /*input4_change_handler_1*/ ctx[22]),
    					listen(input5, "change", /*input5_change_handler_1*/ ctx[23]),
    					listen(input6, "change", /*input6_change_handler*/ ctx[24])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*support_needed*/ 8) {
    				input0.checked = ~/*support_needed*/ ctx[3].indexOf(input0.__value);
    			}

    			if (dirty[0] & /*support_needed*/ 8) show_if_1 = /*support_needed*/ ctx[3].includes('enough_participants');

    			if (show_if_1) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(div7, t4);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty[0] & /*support_needed*/ 8) {
    				input1.checked = ~/*support_needed*/ ctx[3].indexOf(input1.__value);
    			}

    			if (dirty[0] & /*support_needed*/ 8) {
    				input2.checked = ~/*support_needed*/ ctx[3].indexOf(input2.__value);
    			}

    			if (dirty[0] & /*support_needed*/ 8) {
    				input3.checked = ~/*support_needed*/ ctx[3].indexOf(input3.__value);
    			}

    			if (dirty[0] & /*support_needed*/ 8) {
    				input4.checked = ~/*support_needed*/ ctx[3].indexOf(input4.__value);
    			}

    			if (dirty[0] & /*support_needed*/ 8) {
    				input5.checked = ~/*support_needed*/ ctx[3].indexOf(input5.__value);
    			}

    			if (dirty[0] & /*support_needed*/ 8) {
    				input6.checked = ~/*support_needed*/ ctx[3].indexOf(input6.__value);
    			}

    			if (dirty[0] & /*support_needed*/ 8) show_if = /*support_needed*/ ctx[3].includes('other');

    			if (show_if) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(div6, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div7);
    			/*$$binding_groups*/ ctx[13][1].splice(/*$$binding_groups*/ ctx[13][1].indexOf(input0), 1);
    			if (if_block0) if_block0.d();
    			/*$$binding_groups*/ ctx[13][1].splice(/*$$binding_groups*/ ctx[13][1].indexOf(input1), 1);
    			/*$$binding_groups*/ ctx[13][1].splice(/*$$binding_groups*/ ctx[13][1].indexOf(input2), 1);
    			/*$$binding_groups*/ ctx[13][1].splice(/*$$binding_groups*/ ctx[13][1].indexOf(input3), 1);
    			/*$$binding_groups*/ ctx[13][1].splice(/*$$binding_groups*/ ctx[13][1].indexOf(input4), 1);
    			/*$$binding_groups*/ ctx[13][1].splice(/*$$binding_groups*/ ctx[13][1].indexOf(input5), 1);
    			/*$$binding_groups*/ ctx[13][1].splice(/*$$binding_groups*/ ctx[13][1].indexOf(input6), 1);
    			if (if_block1) if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (143:20) {#if support_needed.includes('enough_participants')}
    function create_if_block_4(ctx) {
    	let div;
    	let label;
    	let t1;
    	let input0;
    	let t2;
    	let input1;
    	let span;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			label = element("label");
    			label.textContent = "How much confidence do you need before you're willing to risk arrest?";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			input1 = element("input");
    			span = element("span");
    			span.textContent = "% chance of success";
    			set_style(label, "width", "90%");
    			set_style(label, "font-style", "italic");
    			set_style(label, "font-size", "15px");
    			attr(label, "class", "svelte-wppxrz");
    			attr(input0, "type", "range");
    			attr(input0, "class", "svelte-wppxrz");
    			attr(input1, "type", "text");
    			attr(input1, "class", "range_input svelte-wppxrz");
    			attr(input1, "min", 0);
    			attr(input1, "max", 99);
    			set_style(span, "font-size", "15px");
    			attr(div, "class", "range");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, label);
    			append(div, t1);
    			append(div, input0);
    			set_input_value(input0, /*chance_of_success_needed*/ ctx[4]);
    			append(div, t2);
    			append(div, input1);
    			set_input_value(input1, /*chance_of_success_needed*/ ctx[4]);
    			append(div, span);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "change", /*input0_change_input_handler*/ ctx[17]),
    					listen(input0, "input", /*input0_change_input_handler*/ ctx[17]),
    					listen(input1, "input", /*input1_input_handler_1*/ ctx[18])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*chance_of_success_needed*/ 16) {
    				set_input_value(input0, /*chance_of_success_needed*/ ctx[4]);
    			}

    			if (dirty[0] & /*chance_of_success_needed*/ 16 && input1.value !== /*chance_of_success_needed*/ ctx[4]) {
    				set_input_value(input1, /*chance_of_success_needed*/ ctx[4]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (174:24) {#if support_needed.includes('other')}
    function create_if_block_3(ctx) {
    	let label;
    	let t1;
    	let textarea;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			label = element("label");
    			label.textContent = "What else would support you in risking arrest?";
    			t1 = space();
    			textarea = element("textarea");
    			set_style(label, "font-size", "14px");
    			set_style(label, "font-style", "italic");
    			attr(label, "class", "svelte-wppxrz");
    			attr(textarea, "type", "text");
    			attr(textarea, "class", "svelte-wppxrz");
    		},
    		m(target, anchor) {
    			insert(target, label, anchor);
    			insert(target, t1, anchor);
    			insert(target, textarea, anchor);
    			set_input_value(textarea, /*other_support_needed*/ ctx[5]);

    			if (!mounted) {
    				dispose = listen(textarea, "input", /*textarea_input_handler*/ ctx[25]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*other_support_needed*/ 32) {
    				set_input_value(textarea, /*other_support_needed*/ ctx[5]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(label);
    			if (detaching) detach(t1);
    			if (detaching) detach(textarea);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (191:16) {#if arrest}
    function create_if_block_1(ctx) {
    	let label0;
    	let t1;
    	let div11;
    	let div0;
    	let input0;
    	let label1;
    	let t3;
    	let div1;
    	let input1;
    	let label2;
    	let t5;
    	let div2;
    	let input2;
    	let label3;
    	let t7;
    	let div3;
    	let input3;
    	let label4;
    	let t9;
    	let div4;
    	let input4;
    	let label5;
    	let t11;
    	let div5;
    	let input5;
    	let label6;
    	let t13;
    	let div6;
    	let input6;
    	let label7;
    	let t15;
    	let div7;
    	let input7;
    	let label8;
    	let t17;
    	let div8;
    	let input8;
    	let label9;
    	let t19;
    	let div9;
    	let input9;
    	let label10;
    	let t21;
    	let div10;
    	let input10;
    	let label11;
    	let t23;
    	let div12;
    	let label12;
    	let t25;
    	let textarea;
    	let t26;
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			label0 = element("label");
    			label0.textContent = "Can you support in any of these areas as well?";
    			t1 = space();
    			div11 = element("div");
    			div0 = element("div");
    			input0 = element("input");
    			label1 = element("label");
    			label1.textContent = "Local neighborhood organizing";
    			t3 = space();
    			div1 = element("div");
    			input1 = element("input");
    			label2 = element("label");
    			label2.textContent = "Fundraising";
    			t5 = space();
    			div2 = element("div");
    			input2 = element("input");
    			label3 = element("label");
    			label3.textContent = "Technical / computer support";
    			t7 = space();
    			div3 = element("div");
    			input3 = element("input");
    			label4 = element("label");
    			label4.textContent = "Canvassing and field organizing";
    			t9 = space();
    			div4 = element("div");
    			input4 = element("input");
    			label5 = element("label");
    			label5.textContent = "Phone banking";
    			t11 = space();
    			div5 = element("div");
    			input5 = element("input");
    			label6 = element("label");
    			label6.textContent = "Legal support";
    			t13 = space();
    			div6 = element("div");
    			input6 = element("input");
    			label7 = element("label");
    			label7.textContent = "Transportation support";
    			t15 = space();
    			div7 = element("div");
    			input7 = element("input");
    			label8 = element("label");
    			label8.textContent = "Childcare support around actions";
    			t17 = space();
    			div8 = element("div");
    			input8 = element("input");
    			label9 = element("label");
    			label9.textContent = "Art, design, video, graphics, media";
    			t19 = space();
    			div9 = element("div");
    			input9 = element("input");
    			label10 = element("label");
    			label10.textContent = "Yard sign outreach";
    			t21 = space();
    			div10 = element("div");
    			input10 = element("input");
    			label11 = element("label");
    			label11.textContent = "Donating to organizations";
    			t23 = space();
    			div12 = element("div");
    			label12 = element("label");
    			label12.textContent = "Any other skills/ways you'd like to contribute?";
    			t25 = space();
    			textarea = element("textarea");
    			t26 = space();
    			button = element("button");
    			button.textContent = "Submit";
    			attr(label0, "for", "other_support");
    			set_style(label0, "width", "90%");
    			set_style(label0, "font-style", "italic");
    			set_style(label0, "font-size", "15px");
    			set_style(label0, "margin-top", "15px");
    			attr(label0, "class", "svelte-wppxrz");
    			attr(input0, "type", "checkbox");
    			input0.__value = "local_organizing";
    			input0.value = input0.__value;
    			attr(input0, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][0].push(input0);
    			attr(label1, "class", "svelte-wppxrz");
    			attr(div0, "class", "checkbox svelte-wppxrz");
    			attr(input1, "type", "checkbox");
    			input1.__value = "fundraising";
    			input1.value = input1.__value;
    			attr(input1, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][0].push(input1);
    			attr(label2, "class", "svelte-wppxrz");
    			attr(div1, "class", "checkbox svelte-wppxrz");
    			attr(input2, "type", "checkbox");
    			input2.__value = "technical_computer";
    			input2.value = input2.__value;
    			attr(input2, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][0].push(input2);
    			attr(label3, "class", "svelte-wppxrz");
    			attr(div2, "class", "checkbox svelte-wppxrz");
    			attr(input3, "type", "checkbox");
    			input3.__value = "canvassing_field_organizing";
    			input3.value = input3.__value;
    			attr(input3, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][0].push(input3);
    			attr(label4, "class", "svelte-wppxrz");
    			attr(div3, "class", "checkbox svelte-wppxrz");
    			attr(input4, "type", "checkbox");
    			input4.__value = "phone_banking";
    			input4.value = input4.__value;
    			attr(input4, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][0].push(input4);
    			attr(label5, "class", "svelte-wppxrz");
    			attr(div4, "class", "checkbox svelte-wppxrz");
    			attr(input5, "type", "checkbox");
    			input5.__value = "legal";
    			input5.value = input5.__value;
    			attr(input5, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][0].push(input5);
    			attr(label6, "class", "svelte-wppxrz");
    			attr(div5, "class", "checkbox svelte-wppxrz");
    			attr(input6, "type", "checkbox");
    			input6.__value = "transportation";
    			input6.value = input6.__value;
    			attr(input6, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][0].push(input6);
    			attr(label7, "class", "svelte-wppxrz");
    			attr(div6, "class", "checkbox svelte-wppxrz");
    			attr(input7, "type", "checkbox");
    			input7.__value = "childcare";
    			input7.value = input7.__value;
    			attr(input7, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][0].push(input7);
    			attr(label8, "class", "svelte-wppxrz");
    			attr(div7, "class", "checkbox svelte-wppxrz");
    			attr(input8, "type", "checkbox");
    			input8.__value = "art_design_video_graphics_media";
    			input8.value = input8.__value;
    			attr(input8, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][0].push(input8);
    			attr(label9, "class", "svelte-wppxrz");
    			attr(div8, "class", "checkbox svelte-wppxrz");
    			attr(input9, "type", "checkbox");
    			input9.__value = "yard_signs";
    			input9.value = input9.__value;
    			attr(input9, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][0].push(input9);
    			attr(label10, "class", "svelte-wppxrz");
    			attr(div9, "class", "checkbox svelte-wppxrz");
    			attr(input10, "type", "checkbox");
    			input10.__value = "donations";
    			input10.value = input10.__value;
    			attr(input10, "class", "svelte-wppxrz");
    			/*$$binding_groups*/ ctx[13][0].push(input10);
    			attr(label11, "class", "svelte-wppxrz");
    			attr(div10, "class", "checkbox svelte-wppxrz");
    			attr(div11, "class", "checkbox svelte-wppxrz");
    			set_style(label12, "width", "90%");
    			set_style(label12, "font-style", "italic");
    			set_style(label12, "font-size", "15px");
    			attr(label12, "class", "svelte-wppxrz");
    			set_style(textarea, "width", "90%");
    			set_style(textarea, "margin-top", "7px");
    			attr(textarea, "class", "svelte-wppxrz");
    			set_style(div12, "margin-top", "15px");
    			attr(button, "type", "submit");
    			attr(button, "class", "svelte-wppxrz");
    		},
    		m(target, anchor) {
    			insert(target, label0, anchor);
    			insert(target, t1, anchor);
    			insert(target, div11, anchor);
    			append(div11, div0);
    			append(div0, input0);
    			input0.checked = ~/*contribution_areas*/ ctx[6].indexOf(input0.__value);
    			append(div0, label1);
    			append(div11, t3);
    			append(div11, div1);
    			append(div1, input1);
    			input1.checked = ~/*contribution_areas*/ ctx[6].indexOf(input1.__value);
    			append(div1, label2);
    			append(div11, t5);
    			append(div11, div2);
    			append(div2, input2);
    			input2.checked = ~/*contribution_areas*/ ctx[6].indexOf(input2.__value);
    			append(div2, label3);
    			append(div11, t7);
    			append(div11, div3);
    			append(div3, input3);
    			input3.checked = ~/*contribution_areas*/ ctx[6].indexOf(input3.__value);
    			append(div3, label4);
    			append(div11, t9);
    			append(div11, div4);
    			append(div4, input4);
    			input4.checked = ~/*contribution_areas*/ ctx[6].indexOf(input4.__value);
    			append(div4, label5);
    			append(div11, t11);
    			append(div11, div5);
    			append(div5, input5);
    			input5.checked = ~/*contribution_areas*/ ctx[6].indexOf(input5.__value);
    			append(div5, label6);
    			append(div11, t13);
    			append(div11, div6);
    			append(div6, input6);
    			input6.checked = ~/*contribution_areas*/ ctx[6].indexOf(input6.__value);
    			append(div6, label7);
    			append(div11, t15);
    			append(div11, div7);
    			append(div7, input7);
    			input7.checked = ~/*contribution_areas*/ ctx[6].indexOf(input7.__value);
    			append(div7, label8);
    			append(div11, t17);
    			append(div11, div8);
    			append(div8, input8);
    			input8.checked = ~/*contribution_areas*/ ctx[6].indexOf(input8.__value);
    			append(div8, label9);
    			append(div11, t19);
    			append(div11, div9);
    			append(div9, input9);
    			input9.checked = ~/*contribution_areas*/ ctx[6].indexOf(input9.__value);
    			append(div9, label10);
    			append(div11, t21);
    			append(div11, div10);
    			append(div10, input10);
    			input10.checked = ~/*contribution_areas*/ ctx[6].indexOf(input10.__value);
    			append(div10, label11);
    			insert(target, t23, anchor);
    			insert(target, div12, anchor);
    			append(div12, label12);
    			append(div12, t25);
    			append(div12, textarea);
    			set_input_value(textarea, /*other_contributions*/ ctx[7]);
    			insert(target, t26, anchor);
    			insert(target, button, anchor);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "change", /*input0_change_handler_1*/ ctx[26]),
    					listen(input1, "change", /*input1_change_handler_1*/ ctx[27]),
    					listen(input2, "change", /*input2_change_handler_1*/ ctx[28]),
    					listen(input3, "change", /*input3_change_handler_2*/ ctx[29]),
    					listen(input4, "change", /*input4_change_handler_2*/ ctx[30]),
    					listen(input5, "change", /*input5_change_handler_2*/ ctx[31]),
    					listen(input6, "change", /*input6_change_handler_1*/ ctx[32]),
    					listen(input7, "change", /*input7_change_handler*/ ctx[33]),
    					listen(input8, "change", /*input8_change_handler*/ ctx[34]),
    					listen(input9, "change", /*input9_change_handler*/ ctx[35]),
    					listen(input10, "change", /*input10_change_handler*/ ctx[36]),
    					listen(textarea, "input", /*textarea_input_handler_1*/ ctx[37])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*contribution_areas*/ 64) {
    				input0.checked = ~/*contribution_areas*/ ctx[6].indexOf(input0.__value);
    			}

    			if (dirty[0] & /*contribution_areas*/ 64) {
    				input1.checked = ~/*contribution_areas*/ ctx[6].indexOf(input1.__value);
    			}

    			if (dirty[0] & /*contribution_areas*/ 64) {
    				input2.checked = ~/*contribution_areas*/ ctx[6].indexOf(input2.__value);
    			}

    			if (dirty[0] & /*contribution_areas*/ 64) {
    				input3.checked = ~/*contribution_areas*/ ctx[6].indexOf(input3.__value);
    			}

    			if (dirty[0] & /*contribution_areas*/ 64) {
    				input4.checked = ~/*contribution_areas*/ ctx[6].indexOf(input4.__value);
    			}

    			if (dirty[0] & /*contribution_areas*/ 64) {
    				input5.checked = ~/*contribution_areas*/ ctx[6].indexOf(input5.__value);
    			}

    			if (dirty[0] & /*contribution_areas*/ 64) {
    				input6.checked = ~/*contribution_areas*/ ctx[6].indexOf(input6.__value);
    			}

    			if (dirty[0] & /*contribution_areas*/ 64) {
    				input7.checked = ~/*contribution_areas*/ ctx[6].indexOf(input7.__value);
    			}

    			if (dirty[0] & /*contribution_areas*/ 64) {
    				input8.checked = ~/*contribution_areas*/ ctx[6].indexOf(input8.__value);
    			}

    			if (dirty[0] & /*contribution_areas*/ 64) {
    				input9.checked = ~/*contribution_areas*/ ctx[6].indexOf(input9.__value);
    			}

    			if (dirty[0] & /*contribution_areas*/ 64) {
    				input10.checked = ~/*contribution_areas*/ ctx[6].indexOf(input10.__value);
    			}

    			if (dirty[0] & /*other_contributions*/ 128) {
    				set_input_value(textarea, /*other_contributions*/ ctx[7]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(label0);
    			if (detaching) detach(t1);
    			if (detaching) detach(div11);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input0), 1);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input1), 1);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input2), 1);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input3), 1);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input4), 1);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input5), 1);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input6), 1);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input7), 1);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input8), 1);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input9), 1);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input10), 1);
    			if (detaching) detach(t23);
    			if (detaching) detach(div12);
    			if (detaching) detach(t26);
    			if (detaching) detach(button);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div1;
    	let div0;
    	let t5;
    	let form;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (!/*submit_results*/ ctx[8]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");

    			div0.innerHTML = `<h3>Ready for <span style="color: palegreen; font-weight: bold">climate action</span>?</h3> 
            <p>Fill out this form, and we&#39;ll connect you with relevant groups where you can put your power to use.</p>`;

    			t5 = space();
    			form = element("form");
    			if_block.c();
    			set_style(div0, "text-align", "center");
    			attr(form, "class", "light svelte-wppxrz");
    			attr(div1, "id", "banner");
    			attr(div1, "class", "svelte-wppxrz");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div1, t5);
    			append(div1, form);
    			if_block.m(form, null);

    			if (!mounted) {
    				dispose = listen(form, "submit", prevent_default(/*submitForm*/ ctx[9]));
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(form, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let coordinates;
    	let postal;
    	let country;
    	let arrest = null;
    	let support_needed = [];
    	let chance_of_success_needed = 40;
    	let other_support_needed;
    	let contribution_areas = [];
    	let other_contributions;
    	let submit_results;

    	onMount(async () => {
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
    		$$invalidate(1, country = json.country);
    		$$invalidate(0, postal = json.postal);
    	}

    	async function submitForm(e) {
    		var formData = new FormData(e.target);
    		formData.append('arrest', arrest);
    		formData.append('support_needed', support_needed);
    		formData.append('chance_of_success_needed', chance_of_success_needed);
    		formData.append('other_support_needed', other_support_needed);
    		formData.append('contribution_areas', contribution_areas);
    		formData.append('other_contributions', other_contributions);
    		var object = {};

    		formData.forEach(function (value, key) {
    			object[key] = value;
    		});

    		var json = JSON.stringify(object);
    		console.log(json);
    		object.support_needed = support_needed;
    		object.contribution_areas = contribution_areas;
    		$$invalidate(8, submit_results = object);
    		console.log(submit_results);
    		console.log(submit_results.support_needed);
    		console.log(submit_results.other_support_needed);
    		console.log(submit_results.other_contributions);
    		console.log(submit_results.chance_of_success_needed);
    	}

    	const $$binding_groups = [[], [], []];

    	function input1_input_handler() {
    		postal = this.value;
    		$$invalidate(0, postal);
    	}

    	function input2_input_handler() {
    		country = this.value;
    		$$invalidate(1, country);
    	}

    	function input3_change_handler() {
    		arrest = this.__value;
    		$$invalidate(2, arrest);
    	}

    	function input4_change_handler() {
    		arrest = this.__value;
    		$$invalidate(2, arrest);
    	}

    	function input5_change_handler() {
    		arrest = this.__value;
    		$$invalidate(2, arrest);
    	}

    	function input0_change_handler() {
    		support_needed = get_binding_group_value($$binding_groups[1], this.__value, this.checked);
    		$$invalidate(3, support_needed);
    	}

    	function input0_change_input_handler() {
    		chance_of_success_needed = to_number(this.value);
    		$$invalidate(4, chance_of_success_needed);
    	}

    	function input1_input_handler_1() {
    		chance_of_success_needed = this.value;
    		$$invalidate(4, chance_of_success_needed);
    	}

    	function input1_change_handler() {
    		support_needed = get_binding_group_value($$binding_groups[1], this.__value, this.checked);
    		$$invalidate(3, support_needed);
    	}

    	function input2_change_handler() {
    		support_needed = get_binding_group_value($$binding_groups[1], this.__value, this.checked);
    		$$invalidate(3, support_needed);
    	}

    	function input3_change_handler_1() {
    		support_needed = get_binding_group_value($$binding_groups[1], this.__value, this.checked);
    		$$invalidate(3, support_needed);
    	}

    	function input4_change_handler_1() {
    		support_needed = get_binding_group_value($$binding_groups[1], this.__value, this.checked);
    		$$invalidate(3, support_needed);
    	}

    	function input5_change_handler_1() {
    		support_needed = get_binding_group_value($$binding_groups[1], this.__value, this.checked);
    		$$invalidate(3, support_needed);
    	}

    	function input6_change_handler() {
    		support_needed = get_binding_group_value($$binding_groups[1], this.__value, this.checked);
    		$$invalidate(3, support_needed);
    	}

    	function textarea_input_handler() {
    		other_support_needed = this.value;
    		$$invalidate(5, other_support_needed);
    	}

    	function input0_change_handler_1() {
    		contribution_areas = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(6, contribution_areas);
    	}

    	function input1_change_handler_1() {
    		contribution_areas = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(6, contribution_areas);
    	}

    	function input2_change_handler_1() {
    		contribution_areas = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(6, contribution_areas);
    	}

    	function input3_change_handler_2() {
    		contribution_areas = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(6, contribution_areas);
    	}

    	function input4_change_handler_2() {
    		contribution_areas = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(6, contribution_areas);
    	}

    	function input5_change_handler_2() {
    		contribution_areas = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(6, contribution_areas);
    	}

    	function input6_change_handler_1() {
    		contribution_areas = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(6, contribution_areas);
    	}

    	function input7_change_handler() {
    		contribution_areas = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(6, contribution_areas);
    	}

    	function input8_change_handler() {
    		contribution_areas = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(6, contribution_areas);
    	}

    	function input9_change_handler() {
    		contribution_areas = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(6, contribution_areas);
    	}

    	function input10_change_handler() {
    		contribution_areas = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(6, contribution_areas);
    	}

    	function textarea_input_handler_1() {
    		other_contributions = this.value;
    		$$invalidate(7, other_contributions);
    	}

    	return [
    		postal,
    		country,
    		arrest,
    		support_needed,
    		chance_of_success_needed,
    		other_support_needed,
    		contribution_areas,
    		other_contributions,
    		submit_results,
    		submitForm,
    		input1_input_handler,
    		input2_input_handler,
    		input3_change_handler,
    		$$binding_groups,
    		input4_change_handler,
    		input5_change_handler,
    		input0_change_handler,
    		input0_change_input_handler,
    		input1_input_handler_1,
    		input1_change_handler,
    		input2_change_handler,
    		input3_change_handler_1,
    		input4_change_handler_1,
    		input5_change_handler_1,
    		input6_change_handler,
    		textarea_input_handler,
    		input0_change_handler_1,
    		input1_change_handler_1,
    		input2_change_handler_1,
    		input3_change_handler_2,
    		input4_change_handler_2,
    		input5_change_handler_2,
    		input6_change_handler_1,
    		input7_change_handler,
    		input8_change_handler,
    		input9_change_handler,
    		input10_change_handler,
    		textarea_input_handler_1
    	];
    }

    class Embed extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {}, add_css, [-1, -1]);
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
