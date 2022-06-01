import { n as noop, a as safe_not_equal, c as create_ssr_component, b as subscribe, g as getContext } from "./index-f034c715.js";
import MiniScroller from "../entries/pages/MiniScroller.svelte.js";
const contextKey = {};
const subscriber_queue = [];
function writable(value, start = noop) {
  let stop;
  const subscribers = /* @__PURE__ */ new Set();
  function set(new_value) {
    if (safe_not_equal(value, new_value)) {
      value = new_value;
      if (stop) {
        const run_queue = !subscriber_queue.length;
        for (const subscriber of subscribers) {
          subscriber[1]();
          subscriber_queue.push(subscriber, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue.length; i += 2) {
            subscriber_queue[i][0](subscriber_queue[i + 1]);
          }
          subscriber_queue.length = 0;
        }
      }
    }
  }
  function update(fn) {
    set(fn(value));
  }
  function subscribe2(run, invalidate = noop) {
    const subscriber = [run, invalidate];
    subscribers.add(subscriber);
    if (subscribers.size === 1) {
      stop = start(set) || noop;
    }
    run(value);
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        stop();
        stop = null;
      }
    };
  }
  return { set, update, subscribe: subscribe2 };
}
var Map_svelte_svelte_type_style_lang = "";
var Geocoder_svelte_svelte_type_style_lang = "";
var GeolocateControl_svelte_svelte_type_style_lang = "";
let inputs_store = writable([]);
const Earthquakes = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $inputs_store, $$unsubscribe_inputs_store;
  $$unsubscribe_inputs_store = subscribe(inputs_store, (value) => $inputs_store = value);
  const { getMap, getMapbox } = getContext(contextKey);
  const map = getMap();
  const mapbox = getMapbox();
  if (map.getSource("earthquakes")) {
    console.log("exists");
    let data = {
      "type": "FeatureCollection",
      "crs": {
        "type": "name",
        "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" }
      },
      "features": $inputs_store
    };
    map.getSource("earthquakes").setData(data);
  } else {
    map.addSource("earthquakes", {
      type: "geojson",
      data: {
        "type": "FeatureCollection",
        "crs": {
          "type": "name",
          "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" }
        },
        "features": $inputs_store
      },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "earthquakes",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          "#51bbd6",
          100,
          "#f1f075",
          750,
          "#f28cb1"
        ],
        "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40]
      }
    });
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "earthquakes",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12
      }
    });
    map.addLayer({
      id: "unclustered-point",
      type: "circle",
      source: "earthquakes",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#11b4da",
        "circle-radius": 4,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#fff"
      }
    });
  }
  map.on("click", "clusters", function(e) {
    const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
    const clusterId = features[0].properties.cluster_id;
    map.getSource("earthquakes").getClusterExpansionZoom(clusterId, function(err, zoom) {
      if (err) {
        return;
      }
      map.easeTo({
        center: features[0].geometry.coordinates,
        zoom
      });
    });
  });
  map.on("mouseenter", "clusters", function() {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "clusters", function() {
    map.getCanvas().style.cursor = "";
  });
  map.on("click", "unclustered-point", function(e) {
    const coordinates = e.features[0].geometry.coordinates.slice();
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }
    console.log(e.features[0]);
    map.setCenter(coordinates);
    new mapbox.Popup({}).setLngLat(coordinates).setHTML('<div id="mini-scroller"></div>').addTo(map);
    new MiniScroller({
      target: document.getElementById("mini-scroller"),
      props: {
        id: e.features[0]._vectorTileFeature.properties.id
      }
    });
  });
  map.on("mouseenter", "unclustered-point", function() {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "unclustered-point", function() {
    map.getCanvas().style.cursor = "";
  });
  $$unsubscribe_inputs_store();
  return ``;
});
export { Earthquakes as E, contextKey as c, inputs_store as i, writable as w };
