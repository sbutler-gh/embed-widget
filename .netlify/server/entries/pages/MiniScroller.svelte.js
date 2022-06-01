import { c as create_ssr_component, e as escape } from "../../chunks/index-f034c715.js";
const MiniScroller = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let { id = "test" } = $$props;
  if ($$props.id === void 0 && $$bindings.id && id !== void 0)
    $$bindings.id(id);
  return `<p>${escape(id)}</p>`;
});
export { MiniScroller as default };
