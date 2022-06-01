<script>
  import "../app.css";
  import { geojson_store, selected_location_store, bikeshare_transit_store, user_store, points_prompt_store, points_store, prompts_store, current_prompt_store, map_center_store, bikeshare_store, transit_store } from '$lib/stores';
  import { mapboxToken } from '$lib/conf.js'
  import { Map, Geocoder, Marker, controls } from '$lib/components.js'
  import Content from './Content.svelte';
  import map from './Content.svelte';
import {afterUpdate, getContext, onMount, setContext} from 'svelte';
import { get } from 'svelte/store';
  import { variables } from '$lib/variables';
  // import turf from '@turf/helpers';
  import turfBuffer from '@turf/buffer';
  import turfBbox from '@turf/bbox';
  import turfBboxPolygon from '@turf/bbox-polygon';
  import osmtogeojson from 'osmtogeojson'
import bbox from "@turf/bbox";
import { feature } from "@turf/helpers";
import { contextKey } from '$lib/components.js'
import Input from "./Input.svelte";
import { goto } from "$app/navigation";
import { page } from "$app/stores"; 


  // let prompt = "Imagine a place in your community.  A place that hasn't changed in a very long time.  You're going there to take a picture.  Once you arrive, you drop your camera — you reach down for it, and when you stand back up, you are 50 years in the future.  What do you see?  How has this place changed?"

  const { GeolocateControl, NavigationControl } = controls

  let pois = [];

  export let params;

  let poi_mode;
  let poi_purpose;
  let poi_passengers;
  let poi_carry;

  let screenX;
  let screenY;

  // $: screenX = document.getElementsByClassName("mapboxgl-marker mapboxgl-marker-anchor-center")?.[0].getBoundingClientRect().x;
  // $: screenY = document.getElementsByClassName("mapboxgl-marker mapboxgl-marker-anchor-center")?.[0].getBoundingClientRect().y;

  let checked = true;

  let poi_results;

  let loading = false;

  let unique = {};

  $: center = $map_center_store;

  let marker;
  let zoom = 14;
  let mapComponent;

  let create_mode = true;

  let selected_location;

  let mode = "starting";
  </script>
  <slot></slot>