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
    	append_styles(target, "svelte-llnzqb", "#banner.svelte-llnzqb.svelte-llnzqb{overflow-y:scroll;border:solid 1px black;padding:10px;background:black;color:white;font-family:Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\",Segoe UI Symbol,\"Noto Color Emoji\"}@media only screen and (min-width: 601px){#banner.svelte-llnzqb.svelte-llnzqb{max-width:fit-content;max-height:300px}.support.svelte-llnzqb.svelte-llnzqb{margin:auto;width:400px;margin-top:25px}.lead.svelte-llnzqb.svelte-llnzqb{max-width:75%;margin:auto}.responsive.svelte-llnzqb .flex-row.svelte-llnzqb{display:flex}.flex-row.svelte-llnzqb .form-item.svelte-llnzqb{margin-left:20px}.form-item.svelte-llnzqb input.svelte-llnzqb{font-size:16px;margin-top:5px}#address_input.svelte-llnzqb.svelte-llnzqb{width:200px}.responsive.svelte-llnzqb input.svelte-llnzqb,.responsive.svelte-llnzqb textarea.svelte-llnzqb{background:none;color:white;border:none;outline:none;border-bottom:solid 1px white}.responsive.svelte-llnzqb input.svelte-llnzqb:focus,.responsive.svelte-llnzqb textarea.svelte-llnzqb:focus{border-color:#a4d2ff;box-shadow:0 0 6px #1b6ac97f;outline:none}}@media only screen and (max-width: 600px){#banner.svelte-llnzqb.svelte-llnzqb{max-width:100%;max-height:200px}.responsive.svelte-llnzqb.svelte-llnzqb{border-radius:10px;padding:10px;background:white;border:solid 2px lightblue;color:black;text-align:left !important;max-width:300px;margin:auto}.responsive.svelte-llnzqb input.svelte-llnzqb:not(.range_input){border:solid lightgrey 1px;border-radius:5px;padding:0.5rem;font-size:16px;max-width:75%}.responsive.svelte-llnzqb textarea.svelte-llnzqb{border:solid lightgrey 1px;border-radius:5px;padding:0.25rem;font-size:14px;max-width:100%}#address_input.svelte-llnzqb.svelte-llnzqb{max-width:90%;width:300px}.responsive.svelte-llnzqb input.svelte-llnzqb:focus:not(.range_input),.responsive.svelte-llnzqb textarea.svelte-llnzqb:focus{border-color:#a4d2ff;box-shadow:0 0 6px #1b6ac97f;outline:none}.responsive.svelte-llnzqb button.svelte-llnzqb{border-radius:20px;color:#fff;border:none;background:#2da562;padding:0.5em 2em;margin-top:10px;font-size:16px;cursor:pointer;margin-left:auto;display:block}}form.svelte-llnzqb label.svelte-llnzqb,form.svelte-llnzqb input.svelte-llnzqb{display:block}form.svelte-llnzqb label.svelte-llnzqb{margin-top:10px}.checkbox.svelte-llnzqb.svelte-llnzqb{text-align:left;max-width:100%;margin-top:10px}.checkbox.svelte-llnzqb input.svelte-llnzqb{margin-right:5px}.checkbox.svelte-llnzqb input.svelte-llnzqb,.checkbox.svelte-llnzqb label.svelte-llnzqb,.radio.svelte-llnzqb input.svelte-llnzqb,.radio.svelte-llnzqb label.svelte-llnzqb{display:inline;font-size:14px}.radio.svelte-llnzqb.svelte-llnzqb{margin-top:5px}.radio.svelte-llnzqb label.svelte-llnzqb:not(:first-of-type){margin-left:5px}.greenbutton.svelte-llnzqb.svelte-llnzqb{border-radius:20px;color:#fff;border:none;background:#2da562;padding:0.25em 1em;margin-top:10px;font-size:16px;cursor:pointer;margin-left:auto;display:block;margin-top:20px}");
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[27] = list[i];
    	return child_ctx;
    }

    // (184:16) {:else}
    function create_else_block(ctx) {
    	let p0;
    	let t1;
    	let p1;
    	let t3;
    	let p2;
    	let strong0;
    	let t5;
    	let t6_value = /*submit_results*/ ctx[3].email + "";
    	let t6;
    	let t7;
    	let p3;
    	let strong1;
    	let t9;
    	let t10_value = /*submit_results*/ ctx[3].address + "";
    	let t10;
    	let t11;
    	let p4;
    	let strong2;
    	let t13;
    	let t14_value = /*submit_results*/ ctx[3].arrest + "";
    	let t14;
    	let t15;
    	let if_block_anchor;
    	let if_block = /*submit_results*/ ctx[3].support_needed && create_if_block_3(ctx);

    	return {
    		c() {
    			p0 = element("p");
    			p0.innerHTML = `<em>Success!  Now look out for an email connecting you to local climate action groups in your area, and information about leading direct action.</em>`;
    			t1 = space();
    			p1 = element("p");
    			p1.textContent = "This is a demo — no email being sent at this time.  You can see the information submitted through the form here:";
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
    			strong2.textContent = "Willing to get arrested";
    			t13 = text(": ");
    			t14 = text(t14_value);
    			t15 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
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
    			insert(target, t15, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*submit_results*/ 8 && t6_value !== (t6_value = /*submit_results*/ ctx[3].email + "")) set_data(t6, t6_value);
    			if (dirty & /*submit_results*/ 8 && t10_value !== (t10_value = /*submit_results*/ ctx[3].address + "")) set_data(t10, t10_value);
    			if (dirty & /*submit_results*/ 8 && t14_value !== (t14_value = /*submit_results*/ ctx[3].arrest + "")) set_data(t14, t14_value);

    			if (/*submit_results*/ ctx[3].support_needed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_3(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
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
    			if (detaching) detach(t15);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (101:8) {#if !submit_results}
    function create_if_block(ctx) {
    	let div0;
    	let t5;
    	let form;
    	let div5;
    	let div1;
    	let t8;
    	let div2;
    	let t11;
    	let div4;
    	let label2;
    	let t13;
    	let div3;
    	let input2;
    	let label3;
    	let t15;
    	let input3;
    	let label4;
    	let t17;
    	let input4;
    	let label5;
    	let t19;
    	let t20;
    	let div6;
    	let mounted;
    	let dispose;
    	let if_block = (/*arrest*/ ctx[0] == "no" || /*arrest*/ ctx[0] == "other") && create_if_block_1(ctx);

    	return {
    		c() {
    			div0 = element("div");

    			div0.innerHTML = `<h3>Ready for <span style="color: palegreen; font-weight: bold">climate action</span>?</h3> 
            <p style="">Connect with local climate groups, and help drive direct action.</p>`;

    			t5 = space();
    			form = element("form");
    			div5 = element("div");
    			div1 = element("div");

    			div1.innerHTML = `<label for="email" class="svelte-llnzqb">Email</label> 
                    <input style="" type="email" name="email" placeholder="" required="" class="svelte-llnzqb"/>`;

    			t8 = space();
    			div2 = element("div");

    			div2.innerHTML = `<label for="address" class="svelte-llnzqb">Address</label> 
                    <input id="address_input" style="" type="text" name="address" placeholder="123 Main Street, New York, NY, 12345" required="" class="svelte-llnzqb"/>`;

    			t11 = space();
    			div4 = element("div");
    			label2 = element("label");
    			label2.textContent = "Are you willing to risk arrest in frontline actions?";
    			t13 = space();
    			div3 = element("div");
    			input2 = element("input");
    			label3 = element("label");
    			label3.textContent = "Yes";
    			t15 = space();
    			input3 = element("input");
    			label4 = element("label");
    			label4.textContent = "No";
    			t17 = space();
    			input4 = element("input");
    			label5 = element("label");
    			label5.textContent = "Other";
    			t19 = space();
    			if (if_block) if_block.c();
    			t20 = space();
    			div6 = element("div");
    			div6.innerHTML = `<button class="greenbutton svelte-llnzqb">Submit</button>`;
    			attr(div0, "class", "lead svelte-llnzqb");
    			set_style(div0, "text-align", "center");
    			attr(div1, "class", "form-item svelte-llnzqb");
    			attr(div2, "class", "form-item svelte-llnzqb");
    			attr(label2, "for", "arrest");
    			attr(label2, "class", " svelte-llnzqb");
    			attr(input2, "type", "radio");
    			input2.__value = "yes";
    			input2.value = input2.__value;
    			input2.required = true;
    			attr(input2, "class", "svelte-llnzqb");
    			/*$$binding_groups*/ ctx[6][1].push(input2);
    			attr(label3, "class", "svelte-llnzqb");
    			attr(input3, "type", "radio");
    			input3.__value = "no";
    			input3.value = input3.__value;
    			input3.required = true;
    			attr(input3, "class", "svelte-llnzqb");
    			/*$$binding_groups*/ ctx[6][1].push(input3);
    			attr(label4, "class", "svelte-llnzqb");
    			attr(input4, "type", "radio");
    			input4.__value = "other";
    			input4.value = input4.__value;
    			input4.required = true;
    			attr(input4, "class", "svelte-llnzqb");
    			/*$$binding_groups*/ ctx[6][1].push(input4);
    			attr(label5, "class", "svelte-llnzqb");
    			attr(div3, "class", "radio svelte-llnzqb");
    			set_style(div3, "margin", "auto");
    			set_style(div3, "width", "fit-content");
    			attr(div4, "class", "form-item svelte-llnzqb");
    			attr(div5, "class", "flex-row svelte-llnzqb");
    			set_style(div5, "margin", "auto");
    			set_style(div5, "width", "fit-content");
    			attr(div6, "class", "form-item");
    			attr(form, "class", "responsive svelte-llnzqb");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t5, anchor);
    			insert(target, form, anchor);
    			append(form, div5);
    			append(div5, div1);
    			append(div5, t8);
    			append(div5, div2);
    			append(div5, t11);
    			append(div5, div4);
    			append(div4, label2);
    			append(div4, t13);
    			append(div4, div3);
    			append(div3, input2);
    			input2.checked = input2.__value === /*arrest*/ ctx[0];
    			append(div3, label3);
    			append(div3, t15);
    			append(div3, input3);
    			input3.checked = input3.__value === /*arrest*/ ctx[0];
    			append(div3, label4);
    			append(div3, t17);
    			append(div3, input4);
    			input4.checked = input4.__value === /*arrest*/ ctx[0];
    			append(div3, label5);
    			append(form, t19);
    			if (if_block) if_block.m(form, null);
    			append(form, t20);
    			append(form, div6);

    			if (!mounted) {
    				dispose = [
    					listen(input2, "change", /*input2_change_handler*/ ctx[5]),
    					listen(input3, "change", /*input3_change_handler*/ ctx[7]),
    					listen(input4, "change", /*input4_change_handler*/ ctx[8]),
    					listen(form, "submit", /*submitForm*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*arrest*/ 1) {
    				input2.checked = input2.__value === /*arrest*/ ctx[0];
    			}

    			if (dirty & /*arrest*/ 1) {
    				input3.checked = input3.__value === /*arrest*/ ctx[0];
    			}

    			if (dirty & /*arrest*/ 1) {
    				input4.checked = input4.__value === /*arrest*/ ctx[0];
    			}

    			if (/*arrest*/ ctx[0] == "no" || /*arrest*/ ctx[0] == "other") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(form, t20);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t5);
    			if (detaching) detach(form);
    			/*$$binding_groups*/ ctx[6][1].splice(/*$$binding_groups*/ ctx[6][1].indexOf(input2), 1);
    			/*$$binding_groups*/ ctx[6][1].splice(/*$$binding_groups*/ ctx[6][1].indexOf(input3), 1);
    			/*$$binding_groups*/ ctx[6][1].splice(/*$$binding_groups*/ ctx[6][1].indexOf(input4), 1);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (190:16) {#if submit_results.support_needed}
    function create_if_block_3(ctx) {
    	let p;
    	let t1;
    	let ul;
    	let t2;
    	let each_value = /*submit_results*/ ctx[3].support_needed;
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	let if_block = /*submit_results*/ ctx[3].other_support_needed != "undefined" && create_if_block_4(ctx);

    	return {
    		c() {
    			p = element("p");
    			p.innerHTML = `<strong>Support needed:</strong>`;
    			t1 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			if (if_block) if_block.c();
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			insert(target, t1, anchor);
    			insert(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			append(ul, t2);
    			if (if_block) if_block.m(ul, null);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*submit_results*/ 8) {
    				each_value = /*submit_results*/ ctx[3].support_needed;
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, t2);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (/*submit_results*/ ctx[3].other_support_needed != "undefined") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_4(ctx);
    					if_block.c();
    					if_block.m(ul, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    			if (detaching) detach(t1);
    			if (detaching) detach(ul);
    			destroy_each(each_blocks, detaching);
    			if (if_block) if_block.d();
    		}
    	};
    }

    // (193:20) {#each submit_results.support_needed as support}
    function create_each_block(ctx) {
    	let li;
    	let t_value = /*support*/ ctx[27] + "";
    	let t;

    	return {
    		c() {
    			li = element("li");
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*submit_results*/ 8 && t_value !== (t_value = /*support*/ ctx[27] + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (196:20) {#if submit_results.other_support_needed != "undefined"}
    function create_if_block_4(ctx) {
    	let li;
    	let t_value = /*submit_results*/ ctx[3].other_support_needed + "";
    	let t;

    	return {
    		c() {
    			li = element("li");
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*submit_results*/ 8 && t_value !== (t_value = /*submit_results*/ ctx[3].other_support_needed + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (135:12) {#if arrest == "no" || arrest == "other"}
    function create_if_block_1(ctx) {
    	let div7;
    	let label0;
    	let t1;
    	let div0;
    	let input0;
    	let label1;
    	let br0;
    	let t3;
    	let div1;
    	let input1;
    	let label2;
    	let br1;
    	let t5;
    	let div2;
    	let input2;
    	let label3;
    	let br2;
    	let t7;
    	let div3;
    	let input3;
    	let label4;
    	let br3;
    	let t9;
    	let div4;
    	let input4;
    	let label5;
    	let br4;
    	let t11;
    	let div5;
    	let input5;
    	let label6;
    	let br5;
    	let t13;
    	let div6;
    	let input6;
    	let label7;
    	let br6;
    	let t15;
    	let show_if = /*support_needed*/ ctx[1].includes('other');
    	let mounted;
    	let dispose;
    	let if_block = show_if && create_if_block_2(ctx);

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
    			div1 = element("div");
    			input1 = element("input");
    			label2 = element("label");
    			label2.textContent = "I need to know participating won't affect my job security or ability to get employement.";
    			br1 = element("br");
    			t5 = space();
    			div2 = element("div");
    			input2 = element("input");
    			label3 = element("label");
    			label3.textContent = "I need to know that transport, childcare, bail, and all costs of participation will be covered for me.";
    			br2 = element("br");
    			t7 = space();
    			div3 = element("div");
    			input3 = element("input");
    			label4 = element("label");
    			label4.textContent = "I need to know the legal risks and the legal support provided to participants.";
    			br3 = element("br");
    			t9 = space();
    			div4 = element("div");
    			input4 = element("input");
    			label5 = element("label");
    			label5.textContent = "I need a friend willing to join me.";
    			br4 = element("br");
    			t11 = space();
    			div5 = element("div");
    			input5 = element("input");
    			label6 = element("label");
    			label6.textContent = "I want to meet others locally who are willing to risk arrest";
    			br5 = element("br");
    			t13 = space();
    			div6 = element("div");
    			input6 = element("input");
    			label7 = element("label");
    			label7.textContent = "Other";
    			br6 = element("br");
    			t15 = space();
    			if (if_block) if_block.c();
    			attr(label0, "for", "support");
    			set_style(label0, "width", "90%");
    			set_style(label0, "font-style", "italic");
    			set_style(label0, "font-size", "15px");
    			attr(label0, "class", "svelte-llnzqb");
    			attr(input0, "type", "checkbox");
    			input0.__value = "enough_participants";
    			input0.value = input0.__value;
    			attr(input0, "class", "svelte-llnzqb");
    			/*$$binding_groups*/ ctx[6][0].push(input0);
    			attr(label1, "class", "svelte-llnzqb");
    			attr(div0, "class", "checkbox svelte-llnzqb");
    			attr(input1, "type", "checkbox");
    			input1.__value = "job_security";
    			input1.value = input1.__value;
    			attr(input1, "class", "svelte-llnzqb");
    			/*$$binding_groups*/ ctx[6][0].push(input1);
    			attr(label2, "class", "svelte-llnzqb");
    			attr(div1, "class", "checkbox svelte-llnzqb");
    			attr(input2, "type", "checkbox");
    			input2.__value = "costs_will_be_covered";
    			input2.value = input2.__value;
    			attr(input2, "class", "svelte-llnzqb");
    			/*$$binding_groups*/ ctx[6][0].push(input2);
    			attr(label3, "class", "svelte-llnzqb");
    			attr(div2, "class", "checkbox svelte-llnzqb");
    			attr(input3, "type", "checkbox");
    			input3.__value = "legal_information";
    			input3.value = input3.__value;
    			attr(input3, "class", "svelte-llnzqb");
    			/*$$binding_groups*/ ctx[6][0].push(input3);
    			attr(label4, "class", "svelte-llnzqb");
    			attr(div3, "class", "checkbox svelte-llnzqb");
    			attr(input4, "type", "checkbox");
    			input4.__value = "friend_to_join";
    			input4.value = input4.__value;
    			attr(input4, "class", "svelte-llnzqb");
    			/*$$binding_groups*/ ctx[6][0].push(input4);
    			attr(label5, "class", "svelte-llnzqb");
    			attr(div4, "class", "checkbox svelte-llnzqb");
    			attr(input5, "type", "checkbox");
    			input5.__value = "meet_others";
    			input5.value = input5.__value;
    			attr(input5, "class", "svelte-llnzqb");
    			/*$$binding_groups*/ ctx[6][0].push(input5);
    			attr(label6, "class", "svelte-llnzqb");
    			attr(div5, "class", "checkbox svelte-llnzqb");
    			attr(input6, "type", "checkbox");
    			input6.__value = "other";
    			input6.value = input6.__value;
    			attr(input6, "class", "svelte-llnzqb");
    			/*$$binding_groups*/ ctx[6][0].push(input6);
    			attr(label7, "class", "svelte-llnzqb");
    			attr(div6, "class", "checkbox svelte-llnzqb");
    			attr(div7, "class", "support svelte-llnzqb");
    			attr(div7, "style", "");
    		},
    		m(target, anchor) {
    			insert(target, div7, anchor);
    			append(div7, label0);
    			append(div7, t1);
    			append(div7, div0);
    			append(div0, input0);
    			input0.checked = ~/*support_needed*/ ctx[1].indexOf(input0.__value);
    			append(div0, label1);
    			append(div0, br0);
    			append(div7, t3);
    			append(div7, div1);
    			append(div1, input1);
    			input1.checked = ~/*support_needed*/ ctx[1].indexOf(input1.__value);
    			append(div1, label2);
    			append(div1, br1);
    			append(div7, t5);
    			append(div7, div2);
    			append(div2, input2);
    			input2.checked = ~/*support_needed*/ ctx[1].indexOf(input2.__value);
    			append(div2, label3);
    			append(div2, br2);
    			append(div7, t7);
    			append(div7, div3);
    			append(div3, input3);
    			input3.checked = ~/*support_needed*/ ctx[1].indexOf(input3.__value);
    			append(div3, label4);
    			append(div3, br3);
    			append(div7, t9);
    			append(div7, div4);
    			append(div4, input4);
    			input4.checked = ~/*support_needed*/ ctx[1].indexOf(input4.__value);
    			append(div4, label5);
    			append(div4, br4);
    			append(div7, t11);
    			append(div7, div5);
    			append(div5, input5);
    			input5.checked = ~/*support_needed*/ ctx[1].indexOf(input5.__value);
    			append(div5, label6);
    			append(div5, br5);
    			append(div7, t13);
    			append(div7, div6);
    			append(div6, input6);
    			input6.checked = ~/*support_needed*/ ctx[1].indexOf(input6.__value);
    			append(div6, label7);
    			append(div6, br6);
    			append(div6, t15);
    			if (if_block) if_block.m(div6, null);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "change", /*input0_change_handler*/ ctx[9]),
    					listen(input1, "change", /*input1_change_handler*/ ctx[10]),
    					listen(input2, "change", /*input2_change_handler_1*/ ctx[11]),
    					listen(input3, "change", /*input3_change_handler_1*/ ctx[12]),
    					listen(input4, "change", /*input4_change_handler_1*/ ctx[13]),
    					listen(input5, "change", /*input5_change_handler*/ ctx[14]),
    					listen(input6, "change", /*input6_change_handler*/ ctx[15])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*support_needed*/ 2) {
    				input0.checked = ~/*support_needed*/ ctx[1].indexOf(input0.__value);
    			}

    			if (dirty & /*support_needed*/ 2) {
    				input1.checked = ~/*support_needed*/ ctx[1].indexOf(input1.__value);
    			}

    			if (dirty & /*support_needed*/ 2) {
    				input2.checked = ~/*support_needed*/ ctx[1].indexOf(input2.__value);
    			}

    			if (dirty & /*support_needed*/ 2) {
    				input3.checked = ~/*support_needed*/ ctx[1].indexOf(input3.__value);
    			}

    			if (dirty & /*support_needed*/ 2) {
    				input4.checked = ~/*support_needed*/ ctx[1].indexOf(input4.__value);
    			}

    			if (dirty & /*support_needed*/ 2) {
    				input5.checked = ~/*support_needed*/ ctx[1].indexOf(input5.__value);
    			}

    			if (dirty & /*support_needed*/ 2) {
    				input6.checked = ~/*support_needed*/ ctx[1].indexOf(input6.__value);
    			}

    			if (dirty & /*support_needed*/ 2) show_if = /*support_needed*/ ctx[1].includes('other');

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(div6, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div7);
    			/*$$binding_groups*/ ctx[6][0].splice(/*$$binding_groups*/ ctx[6][0].indexOf(input0), 1);
    			/*$$binding_groups*/ ctx[6][0].splice(/*$$binding_groups*/ ctx[6][0].indexOf(input1), 1);
    			/*$$binding_groups*/ ctx[6][0].splice(/*$$binding_groups*/ ctx[6][0].indexOf(input2), 1);
    			/*$$binding_groups*/ ctx[6][0].splice(/*$$binding_groups*/ ctx[6][0].indexOf(input3), 1);
    			/*$$binding_groups*/ ctx[6][0].splice(/*$$binding_groups*/ ctx[6][0].indexOf(input4), 1);
    			/*$$binding_groups*/ ctx[6][0].splice(/*$$binding_groups*/ ctx[6][0].indexOf(input5), 1);
    			/*$$binding_groups*/ ctx[6][0].splice(/*$$binding_groups*/ ctx[6][0].indexOf(input6), 1);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (172:20) {#if support_needed.includes('other')}
    function create_if_block_2(ctx) {
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
    			attr(label, "class", "svelte-llnzqb");
    			attr(textarea, "type", "text");
    			attr(textarea, "class", "svelte-llnzqb");
    		},
    		m(target, anchor) {
    			insert(target, label, anchor);
    			insert(target, t1, anchor);
    			insert(target, textarea, anchor);
    			set_input_value(textarea, /*other_support_needed*/ ctx[2]);

    			if (!mounted) {
    				dispose = listen(textarea, "input", /*textarea_input_handler*/ ctx[16]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*other_support_needed*/ 4) {
    				set_input_value(textarea, /*other_support_needed*/ ctx[2]);
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

    function create_fragment(ctx) {
    	let div;

    	function select_block_type(ctx, dirty) {
    		if (!/*submit_results*/ ctx[3]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			if_block.c();
    			attr(div, "id", "banner");
    			attr(div, "class", "svelte-llnzqb");
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
    	let arrest = null;
    	let support_needed = [];
    	let other_support_needed;
    	let submit_results;

    	onMount(async () => {
    		
    	}); //   ipToCoordinates()

    	async function submitForm(e) {
    		var formData = new FormData(e.target);
    		formData.append('arrest', arrest);
    		formData.append('support_needed', support_needed);

    		// formData.append('chance_of_success_needed', chance_of_success_needed);
    		formData.append('other_support_needed', other_support_needed);

    		// formData.append('contribution_areas', contribution_areas);
    		// formData.append('other_contributions', other_contributions);
    		var object = {};

    		formData.forEach(function (value, key) {
    			object[key] = value;
    		});

    		var json = JSON.stringify(object);
    		console.log(json);
    		object.support_needed = support_needed;

    		// object.contribution_areas = contribution_areas;
    		$$invalidate(3, submit_results = object);
    	} // console.log(submit_results);
    	// console.log(submit_results.support_needed);

    	const $$binding_groups = [[], []];

    	function input2_change_handler() {
    		arrest = this.__value;
    		$$invalidate(0, arrest);
    	}

    	function input3_change_handler() {
    		arrest = this.__value;
    		$$invalidate(0, arrest);
    	}

    	function input4_change_handler() {
    		arrest = this.__value;
    		$$invalidate(0, arrest);
    	}

    	function input0_change_handler() {
    		support_needed = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(1, support_needed);
    	}

    	function input1_change_handler() {
    		support_needed = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(1, support_needed);
    	}

    	function input2_change_handler_1() {
    		support_needed = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(1, support_needed);
    	}

    	function input3_change_handler_1() {
    		support_needed = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(1, support_needed);
    	}

    	function input4_change_handler_1() {
    		support_needed = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(1, support_needed);
    	}

    	function input5_change_handler() {
    		support_needed = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(1, support_needed);
    	}

    	function input6_change_handler() {
    		support_needed = get_binding_group_value($$binding_groups[0], this.__value, this.checked);
    		$$invalidate(1, support_needed);
    	}

    	function textarea_input_handler() {
    		other_support_needed = this.value;
    		$$invalidate(2, other_support_needed);
    	}

    	return [
    		arrest,
    		support_needed,
    		other_support_needed,
    		submit_results,
    		submitForm,
    		input2_change_handler,
    		$$binding_groups,
    		input3_change_handler,
    		input4_change_handler,
    		input0_change_handler,
    		input1_change_handler,
    		input2_change_handler_1,
    		input3_change_handler_1,
    		input4_change_handler_1,
    		input5_change_handler,
    		input6_change_handler,
    		textarea_input_handler
    	];
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
