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
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        select.selectedIndex = -1; // no option should be selected
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
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
    	append_styles(target, "svelte-6bjasm", ".checkbox.svelte-6bjasm label.svelte-6bjasm,input[type=\"checkbox\"].svelte-6bjasm.svelte-6bjasm{display:inline}#banner.svelte-6bjasm.svelte-6bjasm{overflow-y:scroll}@media only screen and (min-width: 601px){#banner.svelte-6bjasm.svelte-6bjasm{max-width:75%;max-height:300px}}@media only screen and (max-width: 600px){#banner.svelte-6bjasm.svelte-6bjasm{max-width:100%;max-height:200px}}form.svelte-6bjasm label.svelte-6bjasm,form.svelte-6bjasm select.svelte-6bjasm,form.svelte-6bjasm input.svelte-6bjasm{display:block}form.svelte-6bjasm label.svelte-6bjasm{margin-top:10px}");
    }

    // (237:12) {#if arrest == "no" || arrest == "other"}
    function create_if_block_5(ctx) {
    	let label0;
    	let t1;
    	let div0;
    	let input0;
    	let label1;
    	let br0;
    	let t3;
    	let t4;
    	let div1;
    	let t6;
    	let div2;
    	let t8;
    	let div3;
    	let t10;
    	let div4;
    	let t12;
    	let div5;
    	let t14;
    	let div6;
    	let mounted;
    	let dispose;
    	let if_block = /*know_others*/ ctx[0] && create_if_block_6();

    	return {
    		c() {
    			label0 = element("label");
    			label0.textContent = "What would help you commit to joining an action and risking arrest?";
    			t1 = space();
    			div0 = element("div");
    			input0 = element("input");
    			label1 = element("label");
    			label1.textContent = "I need to know there will be enough other people risking arrest, to give us a high chance of making the action a success.";
    			br0 = element("br");
    			t3 = space();
    			if (if_block) if_block.c();
    			t4 = space();
    			div1 = element("div");
    			div1.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">I need to know it won&#39;t affect my job or my pay.</label><br/>`;
    			t6 = space();
    			div2 = element("div");
    			div2.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">I need to know that transport, childcare, bail, and all costs will be covered for me.</label><br/>`;
    			t8 = space();
    			div3 = element("div");
    			div3.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">I need to know my risks legally and our legal defense.</label><br/>`;
    			t10 = space();
    			div4 = element("div");
    			div4.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">I need a friend willing to join me.</label><br/>`;
    			t12 = space();
    			div5 = element("div");
    			div5.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">I want to meet other resistors/people risking arrest in a gathering (e.g. party, hangout, social)</label><br/>`;
    			t14 = space();
    			div6 = element("div");
    			div6.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Other</label><br/>`;
    			attr(label0, "for", "support");
    			attr(label0, "class", "svelte-6bjasm");
    			attr(input0, "type", "checkbox");
    			attr(input0, "class", "svelte-6bjasm");
    			attr(label1, "class", "svelte-6bjasm");
    			attr(div0, "class", "checkbox svelte-6bjasm");
    			attr(div1, "class", "checkbox svelte-6bjasm");
    			attr(div2, "class", "checkbox svelte-6bjasm");
    			attr(div3, "class", "checkbox svelte-6bjasm");
    			attr(div4, "class", "checkbox svelte-6bjasm");
    			attr(div5, "class", "checkbox svelte-6bjasm");
    			attr(div6, "class", "checkbox svelte-6bjasm");
    		},
    		m(target, anchor) {
    			insert(target, label0, anchor);
    			insert(target, t1, anchor);
    			insert(target, div0, anchor);
    			append(div0, input0);
    			set_input_value(input0, /*know_others*/ ctx[0]);
    			append(div0, label1);
    			append(div0, br0);
    			insert(target, t3, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, t4, anchor);
    			insert(target, div1, anchor);
    			insert(target, t6, anchor);
    			insert(target, div2, anchor);
    			insert(target, t8, anchor);
    			insert(target, div3, anchor);
    			insert(target, t10, anchor);
    			insert(target, div4, anchor);
    			insert(target, t12, anchor);
    			insert(target, div5, anchor);
    			insert(target, t14, anchor);
    			insert(target, div6, anchor);

    			if (!mounted) {
    				dispose = listen(input0, "change", /*input0_change_handler*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*know_others*/ 1) {
    				set_input_value(input0, /*know_others*/ ctx[0]);
    			}

    			if (/*know_others*/ ctx[0]) {
    				if (if_block) ; else {
    					if_block = create_if_block_6();
    					if_block.c();
    					if_block.m(t4.parentNode, t4);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(label0);
    			if (detaching) detach(t1);
    			if (detaching) detach(div0);
    			if (detaching) detach(t3);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(t4);
    			if (detaching) detach(div1);
    			if (detaching) detach(t6);
    			if (detaching) detach(div2);
    			if (detaching) detach(t8);
    			if (detaching) detach(div3);
    			if (detaching) detach(t10);
    			if (detaching) detach(div4);
    			if (detaching) detach(t12);
    			if (detaching) detach(div5);
    			if (detaching) detach(t14);
    			if (detaching) detach(div6);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (242:12) {#if know_others}
    function create_if_block_6(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");

    			div.innerHTML = `<label class="svelte-6bjasm">What kind of chance does the action need for success, before you&#39;ll be willing to join?</label> 
            <input type="range" value="40" class="svelte-6bjasm"/>`;

    			attr(div, "class", "radio");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (282:12) {#if arrest == "no" || arrest == "other"}
    function create_if_block_4(ctx) {
    	let label;
    	let t1;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			label = element("label");
    			label.textContent = "If we could provide these supports, are you willing to conditionally commit to joining actions in the future?";
    			t1 = space();
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Select";
    			option1 = element("option");
    			option1.textContent = "Yes";
    			option2 = element("option");
    			option2.textContent = "No";
    			option3 = element("option");
    			option3.textContent = "Other";
    			attr(label, "for", "conditional_commit");
    			attr(label, "class", "svelte-6bjasm");
    			option0.disabled = true;
    			option0.selected = true;
    			option0.__value = "Select";
    			option0.value = option0.__value;
    			option1.__value = "yes";
    			option1.value = option1.__value;
    			option2.__value = "no";
    			option2.value = option2.__value;
    			option3.__value = "other";
    			option3.value = option3.__value;
    			attr(select, "name", "conditional_commit");
    			attr(select, "class", "svelte-6bjasm");
    			if (/*conditional_commit*/ ctx[2] === void 0) add_render_callback(() => /*select_change_handler_1*/ ctx[5].call(select));
    		},
    		m(target, anchor) {
    			insert(target, label, anchor);
    			insert(target, t1, anchor);
    			insert(target, select, anchor);
    			append(select, option0);
    			append(select, option1);
    			append(select, option2);
    			append(select, option3);
    			select_option(select, /*conditional_commit*/ ctx[2]);

    			if (!mounted) {
    				dispose = listen(select, "change", /*select_change_handler_1*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*conditional_commit*/ 4) {
    				select_option(select, /*conditional_commit*/ ctx[2]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(label);
    			if (detaching) detach(t1);
    			if (detaching) detach(select);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (296:69) 
    function create_if_block_3(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("In addition to risking arrest, are you interested in supporting actions and organizations in other ways?");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (294:12) {#if conditional_commit == "no" || conditional_commit == "other"}
    function create_if_block_2(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("If you're still not willing to commit, are you willing to support direct action organizations in other ways?  Select any that apply.");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (300:12) {#if conditional_commit == "no" || conditional_commit == "other" || arrest == "yes" || conditional_commit == "yes"}
    function create_if_block_1(ctx) {
    	let div0;
    	let t1;
    	let div1;
    	let t3;
    	let div2;
    	let t5;
    	let div3;
    	let t7;
    	let div4;
    	let t9;
    	let div5;
    	let t11;
    	let div6;
    	let t13;
    	let div7;
    	let t15;
    	let div8;
    	let t17;
    	let div9;
    	let t19;
    	let div10;
    	let t21;
    	let div11;
    	let t23;
    	let div12;

    	return {
    		c() {
    			div0 = element("div");
    			div0.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Local team camptain</label>`;
    			t1 = space();
    			div1 = element("div");
    			div1.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Fundraising</label>`;
    			t3 = space();
    			div2 = element("div");
    			div2.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Technical / computer support</label>`;
    			t5 = space();
    			div3 = element("div");
    			div3.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Canvassing and field organizing</label>`;
    			t7 = space();
    			div4 = element("div");
    			div4.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Phone banking</label>`;
    			t9 = space();
    			div5 = element("div");
    			div5.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Legal support</label>`;
    			t11 = space();
    			div6 = element("div");
    			div6.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Transportation support</label>`;
    			t13 = space();
    			div7 = element("div");
    			div7.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Childcare support around actions</label>`;
    			t15 = space();
    			div8 = element("div");
    			div8.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Art, design, media, graphics, printing</label>`;
    			t17 = space();
    			div9 = element("div");
    			div9.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Yard sign outreach</label>`;
    			t19 = space();
    			div10 = element("div");
    			div10.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Donating to climate action organizations</label>`;
    			t21 = space();
    			div11 = element("div");
    			div11.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Software / web development support</label>`;
    			t23 = space();
    			div12 = element("div");
    			div12.innerHTML = `<input type="checkbox" class="svelte-6bjasm"/><label class="svelte-6bjasm">Other ways to contribute</label>`;
    			attr(div0, "class", "checkbox svelte-6bjasm");
    			attr(div1, "class", "checkbox svelte-6bjasm");
    			attr(div2, "class", "checkbox svelte-6bjasm");
    			attr(div3, "class", "checkbox svelte-6bjasm");
    			attr(div4, "class", "checkbox svelte-6bjasm");
    			attr(div5, "class", "checkbox svelte-6bjasm");
    			attr(div6, "class", "checkbox svelte-6bjasm");
    			attr(div7, "class", "checkbox svelte-6bjasm");
    			attr(div8, "class", "checkbox svelte-6bjasm");
    			attr(div9, "class", "checkbox svelte-6bjasm");
    			attr(div10, "class", "checkbox svelte-6bjasm");
    			attr(div11, "class", "checkbox svelte-6bjasm");
    			attr(div12, "class", "checkbox svelte-6bjasm");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t1, anchor);
    			insert(target, div1, anchor);
    			insert(target, t3, anchor);
    			insert(target, div2, anchor);
    			insert(target, t5, anchor);
    			insert(target, div3, anchor);
    			insert(target, t7, anchor);
    			insert(target, div4, anchor);
    			insert(target, t9, anchor);
    			insert(target, div5, anchor);
    			insert(target, t11, anchor);
    			insert(target, div6, anchor);
    			insert(target, t13, anchor);
    			insert(target, div7, anchor);
    			insert(target, t15, anchor);
    			insert(target, div8, anchor);
    			insert(target, t17, anchor);
    			insert(target, div9, anchor);
    			insert(target, t19, anchor);
    			insert(target, div10, anchor);
    			insert(target, t21, anchor);
    			insert(target, div11, anchor);
    			insert(target, t23, anchor);
    			insert(target, div12, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t1);
    			if (detaching) detach(div1);
    			if (detaching) detach(t3);
    			if (detaching) detach(div2);
    			if (detaching) detach(t5);
    			if (detaching) detach(div3);
    			if (detaching) detach(t7);
    			if (detaching) detach(div4);
    			if (detaching) detach(t9);
    			if (detaching) detach(div5);
    			if (detaching) detach(t11);
    			if (detaching) detach(div6);
    			if (detaching) detach(t13);
    			if (detaching) detach(div7);
    			if (detaching) detach(t15);
    			if (detaching) detach(div8);
    			if (detaching) detach(t17);
    			if (detaching) detach(div9);
    			if (detaching) detach(t19);
    			if (detaching) detach(div10);
    			if (detaching) detach(t21);
    			if (detaching) detach(div11);
    			if (detaching) detach(t23);
    			if (detaching) detach(div12);
    		}
    	};
    }

    // (319:12) {#if arrest == "yes"}
    function create_if_block(ctx) {
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let label1;
    	let t4;
    	let input1;
    	let t5;
    	let label2;
    	let t7;
    	let em;
    	let t9;
    	let input2;
    	let t10;
    	let br;
    	let t11;
    	let button;

    	return {
    		c() {
    			label0 = element("label");
    			label0.textContent = "Email*";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			label1 = element("label");
    			label1.textContent = "Zip code";
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			label2 = element("label");
    			label2.textContent = "Mobile number";
    			t7 = space();
    			em = element("em");
    			em.textContent = "We'll connect via secure messaging applications.";
    			t9 = space();
    			input2 = element("input");
    			t10 = space();
    			br = element("br");
    			t11 = space();
    			button = element("button");
    			button.textContent = "Submit to local organizations";
    			attr(label0, "for", "email");
    			attr(label0, "class", "svelte-6bjasm");
    			attr(input0, "type", "email");
    			attr(input0, "name", "email");
    			attr(input0, "placeholder", "jane@example.com");
    			input0.required = true;
    			attr(input0, "class", "svelte-6bjasm");
    			attr(label1, "for", "zip");
    			attr(label1, "class", "svelte-6bjasm");
    			attr(input1, "type", "text");
    			attr(input1, "name", "zip");
    			attr(input1, "class", "svelte-6bjasm");
    			attr(label2, "for", "number");
    			attr(label2, "class", "svelte-6bjasm");
    			attr(input2, "type", "tel");
    			attr(input2, "name", "number");
    			attr(input2, "class", "svelte-6bjasm");
    			attr(button, "type", "button");
    		},
    		m(target, anchor) {
    			insert(target, label0, anchor);
    			insert(target, t1, anchor);
    			insert(target, input0, anchor);
    			insert(target, t2, anchor);
    			insert(target, label1, anchor);
    			insert(target, t4, anchor);
    			insert(target, input1, anchor);
    			insert(target, t5, anchor);
    			insert(target, label2, anchor);
    			insert(target, t7, anchor);
    			insert(target, em, anchor);
    			insert(target, t9, anchor);
    			insert(target, input2, anchor);
    			insert(target, t10, anchor);
    			insert(target, br, anchor);
    			insert(target, t11, anchor);
    			insert(target, button, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(label0);
    			if (detaching) detach(t1);
    			if (detaching) detach(input0);
    			if (detaching) detach(t2);
    			if (detaching) detach(label1);
    			if (detaching) detach(t4);
    			if (detaching) detach(input1);
    			if (detaching) detach(t5);
    			if (detaching) detach(label2);
    			if (detaching) detach(t7);
    			if (detaching) detach(em);
    			if (detaching) detach(t9);
    			if (detaching) detach(input2);
    			if (detaching) detach(t10);
    			if (detaching) detach(br);
    			if (detaching) detach(t11);
    			if (detaching) detach(button);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let h30;
    	let t3;
    	let h31;
    	let t6;
    	let p;
    	let t8;
    	let form;
    	let label0;
    	let t10;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let t15;
    	let t16;
    	let t17;
    	let label1;
    	let t18;
    	let t19;
    	let mounted;
    	let dispose;
    	let if_block0 = (/*arrest*/ ctx[1] == "no" || /*arrest*/ ctx[1] == "other") && create_if_block_5(ctx);
    	let if_block1 = (/*arrest*/ ctx[1] == "no" || /*arrest*/ ctx[1] == "other") && create_if_block_4(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*conditional_commit*/ ctx[2] == "no" || /*conditional_commit*/ ctx[2] == "other") return create_if_block_2;
    		if (/*arrest*/ ctx[1] == "yes" || /*conditional_commit*/ ctx[2] == "yes") return create_if_block_3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block2 = current_block_type && current_block_type(ctx);
    	let if_block3 = (/*conditional_commit*/ ctx[2] == "no" || /*conditional_commit*/ ctx[2] == "other" || /*arrest*/ ctx[1] == "yes" || /*conditional_commit*/ ctx[2] == "yes") && create_if_block_1();
    	let if_block4 = /*arrest*/ ctx[1] == "yes" && create_if_block();

    	return {
    		c() {
    			div = element("div");
    			h30 = element("h3");
    			h30.innerHTML = `Want to make <span style="text-decoration">underline</span> climate action?`;
    			t3 = space();
    			h31 = element("h3");
    			h31.innerHTML = `Onboard the movement.  <em>When 3.5% of people have gone into the streets, we&#39;ve never failed to bring about change.</em>`;
    			t6 = space();
    			p = element("p");
    			p.textContent = "Fill out the information below, and you'll be connected with leading climate action organizations near you.";
    			t8 = space();
    			form = element("form");
    			label0 = element("label");
    			label0.textContent = "Are you willing to risk arrest for climate action?";
    			t10 = space();
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Select";
    			option1 = element("option");
    			option1.textContent = "Yes";
    			option2 = element("option");
    			option2.textContent = "No";
    			option3 = element("option");
    			option3.textContent = "Other";
    			t15 = space();
    			if (if_block0) if_block0.c();
    			t16 = space();
    			if (if_block1) if_block1.c();
    			t17 = space();
    			label1 = element("label");
    			if (if_block2) if_block2.c();
    			t18 = space();
    			if (if_block3) if_block3.c();
    			t19 = space();
    			if (if_block4) if_block4.c();
    			attr(label0, "for", "arrest");
    			attr(label0, "class", "svelte-6bjasm");
    			option0.disabled = true;
    			option0.selected = true;
    			option0.__value = "Select";
    			option0.value = option0.__value;
    			option1.__value = "yes";
    			option1.value = option1.__value;
    			option2.__value = "no";
    			option2.value = option2.__value;
    			option3.__value = "other";
    			option3.value = option3.__value;
    			attr(select, "name", "arrest");
    			attr(select, "class", "svelte-6bjasm");
    			if (/*arrest*/ ctx[1] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[3].call(select));
    			attr(label1, "for", "support_roles");
    			attr(label1, "class", "svelte-6bjasm");
    			attr(form, "class", "svelte-6bjasm");
    			attr(div, "id", "banner");
    			set_style(div, "border", "solid 1px black");
    			set_style(div, "padding", "10px");
    			attr(div, "class", "svelte-6bjasm");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h30);
    			append(div, t3);
    			append(div, h31);
    			append(div, t6);
    			append(div, p);
    			append(div, t8);
    			append(div, form);
    			append(form, label0);
    			append(form, t10);
    			append(form, select);
    			append(select, option0);
    			append(select, option1);
    			append(select, option2);
    			append(select, option3);
    			select_option(select, /*arrest*/ ctx[1]);
    			append(form, t15);
    			if (if_block0) if_block0.m(form, null);
    			append(form, t16);
    			if (if_block1) if_block1.m(form, null);
    			append(form, t17);
    			append(form, label1);
    			if (if_block2) if_block2.m(label1, null);
    			append(form, t18);
    			if (if_block3) if_block3.m(form, null);
    			append(form, t19);
    			if (if_block4) if_block4.m(form, null);

    			if (!mounted) {
    				dispose = listen(select, "change", /*select_change_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*arrest*/ 2) {
    				select_option(select, /*arrest*/ ctx[1]);
    			}

    			if (/*arrest*/ ctx[1] == "no" || /*arrest*/ ctx[1] == "other") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_5(ctx);
    					if_block0.c();
    					if_block0.m(form, t16);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*arrest*/ ctx[1] == "no" || /*arrest*/ ctx[1] == "other") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_4(ctx);
    					if_block1.c();
    					if_block1.m(form, t17);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if (if_block2) if_block2.d(1);
    				if_block2 = current_block_type && current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(label1, null);
    				}
    			}

    			if (/*conditional_commit*/ ctx[2] == "no" || /*conditional_commit*/ ctx[2] == "other" || /*arrest*/ ctx[1] == "yes" || /*conditional_commit*/ ctx[2] == "yes") {
    				if (if_block3) ; else {
    					if_block3 = create_if_block_1();
    					if_block3.c();
    					if_block3.m(form, t19);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*arrest*/ ctx[1] == "yes") {
    				if (if_block4) ; else {
    					if_block4 = create_if_block();
    					if_block4.c();
    					if_block4.m(form, null);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();

    			if (if_block2) {
    				if_block2.d();
    			}

    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let coordinates;
    	let city;
    	let know_others = false;
    	let arrest;
    	let conditional_commit;
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

    		data = data = [
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
    		];

    		console.log(data[0]);
    	} // for (j = 0; j < data.length ; j++) {
    	//     if (city == data[j].city) {

    	function select_change_handler() {
    		arrest = select_value(this);
    		$$invalidate(1, arrest);
    	}

    	function input0_change_handler() {
    		know_others = this.value;
    		$$invalidate(0, know_others);
    	}

    	function select_change_handler_1() {
    		conditional_commit = select_value(this);
    		$$invalidate(2, conditional_commit);
    	}

    	return [
    		know_others,
    		arrest,
    		conditional_commit,
    		select_change_handler,
    		input0_change_handler,
    		select_change_handler_1
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
