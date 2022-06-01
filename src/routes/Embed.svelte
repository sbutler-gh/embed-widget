<script>

    import {afterUpdate, getContext, onMount, setContext} from 'svelte';

    onMount(async() => {

  ipToCoordinates()

  })

     // We take the user's IP, get coordinates from it (an approximate location — usually the data center nearest them), and update the map location to those coordinates.
     async function ipToCoordinates() {

let coordinates;

let city;
let country;


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
// coordinates = {"lat": 38.886503, "lng": -77.1842802};

city = json.city;
country = json.country;

document.getElementById('coordinates').innerText = JSON.stringify(coordinates);
document.getElementById('city').innerText = city;

}

    
    </script>
    
    <h1>Direct action widget.  Displaying at {window.location.origin}</h1>

    <p>Other information, to give a sense of what we can do:</p>
    <ul>
        <li>Coordinates loaded on page load (for widget initialization): <p id="coordinates"></p></li>
        <li>City loaded on page load (for widget initialization): <p id="city"></p></li>
    </ul>
