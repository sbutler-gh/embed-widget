<script>
import { goto } from '$app/navigation';


    import {afterUpdate, getContext, onMount, setContext} from 'svelte';
    // import LoadingSpinner from "$lib/LoadingSpinner.svelte"
    // import { Geocoder } from '$lib/geocoder';

    // import { page } from "$app/stores"; 

    let coordinates;

let city;
let country;
let geocoder_input;
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

    onMount(async() => {

        // console.log(page);

  ipToCoordinates()

  })

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

const json = await request.json()

console.log(json);

coordinates = json.loc.split(',');
console.log(coordinates);
coordinates = {"lat": coordinates[0], "lng": coordinates[1]};


city = json.city;
country = json.country;
geocoder_input = `${city}, ${country}`
content = true

data = data = [
        {"org": `XR ${city}`,
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
        {"org": "Declare Emergency",
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
        {"org": "XR DC",
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
        {"org": "XR San Francisco",
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
        }]

console.log(data[0]);

// for (j = 0; j < data.length ; j++) {
//     if (city == data[j].city) {
//         i = j;
//     }
// }

// if (city != )
// i = 0;

// coordinates = {"lat": 38.886503, "lng": -77.1842802};
// document.getElementById('coordinates').innerText = JSON.stringify(coordinates);
// document.getElementById('city').innerText = city;

}

    
    </script>
    
    <!-- <h1>Direct action widget.  Displaying at</h1> -->

    <!-- <div>Coordinates: <p id="coordinates"></p></div>
    <div>City: <p id="city"></p></div> -->

    <div id="banner" style="border: solid 1px black; padding: 10px;">
    <!-- <h3>Get involved in direct action near <span style="text-decoration: underline">Washington DC</span></h3> -->
    <h3>Ready to fight for a livable world?</h3>
    <h3>Here are direct climate action organizations near you.</h3>
    <!-- <h3>
    <Geocoder placeholder={"Enter new location"} accessToken="pk.eyJ1IjoibGV0b3VycG93ZXJzY29tYmluZSIsImEiOiJjazFmN3N0eTUwb3JwM2JwYWk4ZXB1enNtIn0._UjpOqZIeiWqhscosubipw" on:result={function() {console.log(e)}}></Geocoder>
    </h3> -->
    {#if content}
    <h2><a href={data[i].website} target="_blank">{data[i].org}</a></h2>
    <em>{data[i].summary}</em>
    <h4>Want to get involved?</h4>
    {@html data[i].onboarding}
    <!-- <p>Contact: {data[i].contact_email}</p> -->
    <p><span style="color: blue; text-decoration: underline; cursor: pointer;" on:click={function() { i < (data.length - 1) ? i = i + 1 : i = 0; document.getElementById("banner").scrollTop = 80;}}>See more organizations</span></p>
    {:else}
    <p><em>Loading ...</em></p>
    {/if}
    <!-- {#each data as item}
    <h1>{item.org}</h1>
    {@html item.onboarding}
    {/each} -->
    </div>

    <style>
    #banner {
        overflow-y: scroll;
    }
    @media only screen and (min-width: 601px) {
        #banner {
            max-width: 75%;
            max-height: 300px;
     }
    }
    @media only screen and (max-width: 600px) {
        #banner {
            max-width: 100%;
            max-height: 200px;
     }
    }
    </style>