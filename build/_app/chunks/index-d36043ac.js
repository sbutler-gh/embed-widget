function E(){}function H(t,n){for(const e in n)t[e]=n[e];return t}function B(t){return t()}function M(){return Object.create(null)}function y(t){t.forEach(B)}function D(t){return typeof t=="function"}function ot(t,n){return t!=t?n==n:t!==n||t&&typeof t=="object"||typeof t=="function"}function I(t){return Object.keys(t).length===0}function L(t,...n){if(t==null)return E;const e=t.subscribe(...n);return e.unsubscribe?()=>e.unsubscribe():e}function st(t){let n;return L(t,e=>n=e)(),n}function ut(t,n,e){t.$$.on_destroy.push(L(n,e))}function lt(t,n,e,i){if(t){const r=O(t,n,e,i);return t[0](r)}}function O(t,n,e,i){return t[1]&&i?H(e.ctx.slice(),t[1](i(n))):e.ctx}function at(t,n,e,i){if(t[2]&&i){const r=t[2](i(e));if(n.dirty===void 0)return r;if(typeof r=="object"){const l=[],o=Math.max(n.dirty.length,r.length);for(let s=0;s<o;s+=1)l[s]=n.dirty[s]|r[s];return l}return n.dirty|r}return n.dirty}function ft(t,n,e,i,r,l){if(r){const o=O(n,e,i,l);t.p(o,r)}}function dt(t){if(t.ctx.length>32){const n=[],e=t.ctx.length/32;for(let i=0;i<e;i++)n[i]=-1;return n}return-1}function _t(t,n,e){return t.set(e),n}function ht(t){return t&&D(t.destroy)?t.destroy:E}let v=!1;function W(){v=!0}function G(){v=!1}function J(t,n,e,i){for(;t<n;){const r=t+(n-t>>1);e(r)<=i?t=r+1:n=r}return t}function K(t){if(t.hydrate_init)return;t.hydrate_init=!0;let n=t.childNodes;if(t.nodeName==="HEAD"){const c=[];for(let u=0;u<n.length;u++){const f=n[u];f.claim_order!==void 0&&c.push(f)}n=c}const e=new Int32Array(n.length+1),i=new Int32Array(n.length);e[0]=-1;let r=0;for(let c=0;c<n.length;c++){const u=n[c].claim_order,f=(r>0&&n[e[r]].claim_order<=u?r+1:J(1,r,b=>n[e[b]].claim_order,u))-1;i[c]=e[f]+1;const a=f+1;e[a]=c,r=Math.max(a,r)}const l=[],o=[];let s=n.length-1;for(let c=e[r]+1;c!=0;c=i[c-1]){for(l.push(n[c-1]);s>=c;s--)o.push(n[s]);s--}for(;s>=0;s--)o.push(n[s]);l.reverse(),o.sort((c,u)=>c.claim_order-u.claim_order);for(let c=0,u=0;c<o.length;c++){for(;u<l.length&&o[c].claim_order>=l[u].claim_order;)u++;const f=u<l.length?l[u]:null;t.insertBefore(o[c],f)}}function Q(t,n){if(v){for(K(t),(t.actual_end_child===void 0||t.actual_end_child!==null&&t.actual_end_child.parentElement!==t)&&(t.actual_end_child=t.firstChild);t.actual_end_child!==null&&t.actual_end_child.claim_order===void 0;)t.actual_end_child=t.actual_end_child.nextSibling;n!==t.actual_end_child?(n.claim_order!==void 0||n.parentNode!==t)&&t.insertBefore(n,t.actual_end_child):t.actual_end_child=n.nextSibling}else(n.parentNode!==t||n.nextSibling!==null)&&t.appendChild(n)}function mt(t,n,e){v&&!e?Q(t,n):(n.parentNode!==t||n.nextSibling!=e)&&t.insertBefore(n,e||null)}function R(t){t.parentNode.removeChild(t)}function U(t){return document.createElement(t)}function N(t){return document.createTextNode(t)}function pt(){return N(" ")}function yt(){return N("")}function bt(t,n,e,i){return t.addEventListener(n,e,i),()=>t.removeEventListener(n,e,i)}function gt(t,n,e){e==null?t.removeAttribute(n):t.getAttribute(n)!==e&&t.setAttribute(n,e)}function V(t){return Array.from(t.childNodes)}function X(t){t.claim_info===void 0&&(t.claim_info={last_index:0,total_claimed:0})}function P(t,n,e,i,r=!1){X(t);const l=(()=>{for(let o=t.claim_info.last_index;o<t.length;o++){const s=t[o];if(n(s)){const c=e(s);return c===void 0?t.splice(o,1):t[o]=c,r||(t.claim_info.last_index=o),s}}for(let o=t.claim_info.last_index-1;o>=0;o--){const s=t[o];if(n(s)){const c=e(s);return c===void 0?t.splice(o,1):t[o]=c,r?c===void 0&&t.claim_info.last_index--:t.claim_info.last_index=o,s}}return i()})();return l.claim_order=t.claim_info.total_claimed,t.claim_info.total_claimed+=1,l}function Y(t,n,e,i){return P(t,r=>r.nodeName===n,r=>{const l=[];for(let o=0;o<r.attributes.length;o++){const s=r.attributes[o];e[s.name]||l.push(s.name)}l.forEach(o=>r.removeAttribute(o))},()=>i(n))}function xt(t,n,e){return Y(t,n,e,U)}function Z(t,n){return P(t,e=>e.nodeType===3,e=>{const i=""+n;if(e.data.startsWith(i)){if(e.data.length!==i.length)return e.splitText(i.length)}else e.data=i},()=>N(n),!0)}function $t(t){return Z(t," ")}function Et(t,n){n=""+n,t.wholeText!==n&&(t.data=n)}function vt(t,n,e,i){e===null?t.style.removeProperty(n):t.style.setProperty(n,e,i?"important":"")}function tt(t,n,e=!1){const i=document.createEvent("CustomEvent");return i.initCustomEvent(t,e,!1,n),i}let p;function m(t){p=t}function _(){if(!p)throw new Error("Function called outside component initialization");return p}function kt(t){_().$$.on_mount.push(t)}function wt(t){_().$$.after_update.push(t)}function jt(t){_().$$.on_destroy.push(t)}function Ct(){const t=_();return(n,e)=>{const i=t.$$.callbacks[n];if(i){const r=tt(n,e);i.slice().forEach(l=>{l.call(t,r)})}}}function Nt(t,n){_().$$.context.set(t,n)}function At(t){return _().$$.context.get(t)}function St(t,n){const e=t.$$.callbacks[n.type];e&&e.slice().forEach(i=>i.call(this,n))}const h=[],T=[],x=[],w=[],q=Promise.resolve();let j=!1;function z(){j||(j=!0,q.then(F))}function Mt(){return z(),q}function C(t){x.push(t)}function Tt(t){w.push(t)}const k=new Set;let g=0;function F(){const t=p;do{for(;g<h.length;){const n=h[g];g++,m(n),nt(n.$$)}for(m(null),h.length=0,g=0;T.length;)T.pop()();for(let n=0;n<x.length;n+=1){const e=x[n];k.has(e)||(k.add(e),e())}x.length=0}while(h.length);for(;w.length;)w.pop()();j=!1,k.clear(),m(t)}function nt(t){if(t.fragment!==null){t.update(),y(t.before_update);const n=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,n),t.after_update.forEach(C)}}const $=new Set;let d;function Bt(){d={r:0,c:[],p:d}}function Dt(){d.r||y(d.c),d=d.p}function et(t,n){t&&t.i&&($.delete(t),t.i(n))}function Lt(t,n,e,i){if(t&&t.o){if($.has(t))return;$.add(t),d.c.push(()=>{$.delete(t),i&&(e&&t.d(1),i())}),t.o(n)}}function Ot(t,n){const e={},i={},r={$$scope:1};let l=t.length;for(;l--;){const o=t[l],s=n[l];if(s){for(const c in o)c in s||(i[c]=1);for(const c in s)r[c]||(e[c]=s[c],r[c]=1);t[l]=s}else for(const c in o)r[c]=1}for(const o in i)o in e||(e[o]=void 0);return e}function Pt(t){return typeof t=="object"&&t!==null?t:{}}function qt(t,n,e){const i=t.$$.props[n];i!==void 0&&(t.$$.bound[i]=e,e(t.$$.ctx[i]))}function zt(t){t&&t.c()}function Ft(t,n){t&&t.l(n)}function it(t,n,e,i){const{fragment:r,on_mount:l,on_destroy:o,after_update:s}=t.$$;r&&r.m(n,e),i||C(()=>{const c=l.map(B).filter(D);o?o.push(...c):y(c),t.$$.on_mount=[]}),s.forEach(C)}function rt(t,n){const e=t.$$;e.fragment!==null&&(y(e.on_destroy),e.fragment&&e.fragment.d(n),e.on_destroy=e.fragment=null,e.ctx=[])}function ct(t,n){t.$$.dirty[0]===-1&&(h.push(t),z(),t.$$.dirty.fill(0)),t.$$.dirty[n/31|0]|=1<<n%31}function Ht(t,n,e,i,r,l,o,s=[-1]){const c=p;m(t);const u=t.$$={fragment:null,ctx:null,props:l,update:E,not_equal:r,bound:M(),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(n.context||(c?c.$$.context:[])),callbacks:M(),dirty:s,skip_bound:!1,root:n.target||c.$$.root};o&&o(u.root);let f=!1;if(u.ctx=e?e(t,n.props||{},(a,b,...A)=>{const S=A.length?A[0]:b;return u.ctx&&r(u.ctx[a],u.ctx[a]=S)&&(!u.skip_bound&&u.bound[a]&&u.bound[a](S),f&&ct(t,a)),b}):[],u.update(),f=!0,y(u.before_update),u.fragment=i?i(u.ctx):!1,n.target){if(n.hydrate){W();const a=V(n.target);u.fragment&&u.fragment.l(a),a.forEach(R)}else u.fragment&&u.fragment.c();n.intro&&et(t.$$.fragment),it(t,n.target,n.anchor,n.customElement),G(),F()}m(c)}class It{$destroy(){rt(this,1),this.$destroy=E}$on(n,e){const i=this.$$.callbacks[n]||(this.$$.callbacks[n]=[]);return i.push(e),()=>{const r=i.indexOf(e);r!==-1&&i.splice(r,1)}}$set(n){this.$$set&&!I(n)&&(this.$$.skip_bound=!0,this.$$set(n),this.$$.skip_bound=!1)}}export{Pt as A,rt as B,H as C,Mt as D,E,lt as F,ft as G,dt as H,at as I,Q as J,ut as K,At as L,ht as M,bt as N,y as O,Ct as P,jt as Q,St as R,It as S,T,st as U,qt as V,Tt as W,_t as X,V as a,gt as b,xt as c,R as d,U as e,vt as f,mt as g,Z as h,Ht as i,Et as j,pt as k,yt as l,$t as m,Bt as n,Lt as o,Dt as p,et as q,Nt as r,ot as s,N as t,wt as u,kt as v,zt as w,Ft as x,it as y,Ot as z};
