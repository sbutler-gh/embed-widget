<script>

    import {onMount} from 'svelte';
    let coordinates;

let city;
let postal;
let country;
let geocoder_input;
let content = false;
let i = 0;

let arrest = null;
let conditional_commit = null;
let support_needed = [];
let chance_of_success_needed = 40;
let other_support_needed;

let contribution_areas = [];
let other_contributions;

let submit_results;

let data = [];

    onMount(async() => {

//   ipToCoordinates()

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
            geocoder_input = `${city}, ${country}`;
            postal = json.postal;
            content = true

    }

    async function submitForm(e) {

        var formData = new FormData(e.target);

        // formData.append('arrest', arrest);
        // formData.append('support_needed', support_needed);
        // formData.append('chance_of_success_needed', chance_of_success_needed);
        // formData.append('other_support_needed', other_support_needed);
        // formData.append('contribution_areas', contribution_areas);
        // formData.append('other_contributions', other_contributions);

        var object = {};
        formData.forEach(function(value, key){
            object[key] = value;
        });
        var json = JSON.stringify(object);

        console.log(json);

        // object.support_needed = support_needed;
        // object.contribution_areas = contribution_areas;

        submit_results = object;
        // console.log(submit_results);
        // console.log(submit_results.support_needed);
        // console.log(submit_results.other_support_needed);
        // console.log(submit_results.other_contributions);
        // console.log(submit_results.chance_of_success_needed);
    }

    </script>
    

    <div id="banner">

        {#if !submit_results}
        <div class="lead" style="text-align: center">
            <h3>Ready for <span style="color: palegreen; font-weight: bold">climate action</span>?</h3>
            <p style="">Connect with local climate groups, and help drive collective action.</p>
            <!-- <p>It's time we take the lead.  Add your details below, and we'll help you empower collective action.</p> -->
            </div>

        <form class="responsive" on:submit={submitForm}>

            <div class="flex-row" style="margin: auto; width: fit-content;">
                <div class="form-item">
                    <label for="email">Email</label>
                    <input style="" type="email" name="email" placeholder="" required>
                </div>
                <div class="form-item">
                    <label for="address">Address</label>
                    <input id="address_input" style="" type="text" name="address" placeholder="123 Main Street, New York, NY, 12345" required>
                    <!-- <input style="width: 60px;" type="text" name="postal" bind:value={postal} placeholder="" required> -->
                    </div>
                    <div class="form-item">
                        <label for="interests">Describe your interests and skills</label>
                        <textarea style="width: 300px;" name="interests"></textarea>
                        <!-- <input style="width: 300px; font-size: 16px; margin-top: 5px;" type="text" name="interests" required> -->
                    </div>
            </div>
            <div class="form-item">
                <button class="greenbutton">Submit</button>
                </div>
            </form>

                {:else}
                <p><em>Perfect!  Now look out for an email connecting you to local climate action groups in your area, and more information about leading real change.</em></p>
                <p>(This is a demo of what the form submission could look like — there isn't an email being sent at this time.)</p>
                <p><strong>Email</strong>: {submit_results.email}</p>
                <p><strong>Address</strong>: {submit_results.address}</p>
                <p><strong>Interests and skills</strong>: {submit_results.interests}</p>
                <!-- <p><strong>Willing to risk arrest?</strong>: {arrest}</p> -->
                {/if}

                <!-- <div style="text-align: center; position: relative; display: none;">
                    <img src="./warming_world.gif">
        
                    <div style="position: absolute; top: 10%; left: 50%; transform:translate(-50%); margin: auto;">
                    <h3 style="background: black; width: fit-content; margin: auto; padding: 5px;">Ready for <span style="color: palegreen; font-weight: bold">climate action</span>?</h3>
                    <br>
        
                    <form class="">
        
                        <div class="flex-row">
                            <div>
                                <label for="email" style="color: black; font-weight: bold;">Email</label>
                                <input type="email" name="email" placeholder="" required>
                            </div>
                            <div>
                                <label for="postal" style="color: black; font-weight: bold;">Address</label>
                                <input style="width: 200px;" type="text" name="postal" required>
                                </div>
                        </div>
                        <button>Submit</button>
                        </form>
                    </div>
        
                </div> -->
    </div>

    <style>

    #banner {
        overflow-y: scroll;
        border: solid 1px black; 
        padding: 10px;
        background: black;
        color: white;
        font-family: Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,"Apple Color Emoji","Segoe UI Emoji",Segoe UI Symbol,"Noto Color Emoji";
    }

    @media only screen and (min-width: 601px) {
        #banner {
            max-width: fit-content;
            max-height: 300px;
     }

     .lead {
         max-width: 75%;
         margin: auto;
     }

     .responsive .flex-row {
         display: flex;
     }

     .flex-row .form-item {
        margin-left: 20px;
    }

     .form-item input {
        font-size: 16px; margin-top: 5px;
     }

     .form-item textarea {
        height: 21.5px;
        width: 300px;
     }

     #address_input {
         width: 200px;
     }

     .responsive input, .responsive textarea {
            background: none;
            color: white;
            border: none;
            outline: none;
            border-bottom: solid 1px white;
        }

        .responsive input:focus, .responsive textarea:focus {
            border-color: #a4d2ff;
        box-shadow: 0 0 6px #1b6ac97f;
        outline: none;
        }

     
    }
    @media only screen and (max-width: 600px) {
        #banner {
            max-width: 100%;
            max-height: 200px;
     }

     .responsive {
    border-radius: 10px;
    padding: 10px;
    /* box-shadow: 0 -1px 10px #0000000d, 0 1px 4px #0000001a, 0 10px 30px #f3ece8; */
    background: white;
    border: solid 2px lightblue;
    color: black;
    text-align: left !important;
    max-width: 300px;
    margin: auto;
    }

    .responsive input:not(.range_input) {
        border: solid lightgrey 1px;
        border-radius: 5px;
        padding: 0.5rem;
        font-size: 16px;
        max-width: 75%;
    }

    .responsive textarea {
        border: solid lightgrey 1px;
        border-radius: 5px;
        padding: 0.25rem;
        font-size: 14px;
        max-width: 100%; 
    }

    #address_input {
         max-width: 90%;
         width: 300px;
     }

    .range_input {
        background: none;
        border: none;
        border-bottom: solid 1px #f0f0f0;
        color: black;
        width: 25px;
        display: inline;
        font-size: 16px;
        padding: 0.5rem;
        outline: none;
    }

    .responsive input:focus:not(.range_input), .responsive textarea:focus {
        border-color: #a4d2ff;
        box-shadow: 0 0 6px #1b6ac97f;
        outline: none;
    }

    .responsive button {
        border-radius: 20px;
    color: #fff;
    border: none;
    background: #2da562;
    padding: 0.5em 2em;
    margin-top: 10px;
    font-size: 16px;
    cursor: pointer;
    margin-left: auto;
    display: block;
    }

    /* .form-item {
        max-width: 90%;
    } */

    }

    form label, form p, form select, form input {
        display: block;
        /* margin: auto; */
    }

    form label {
        margin-top: 10px;
    }

    .checkbox {
        text-align: left;
        max-width: 100%;
        margin-top: 10px;
    }

    .checkbox input {
        margin-right: 5px;
    }

    .checkbox input, .checkbox label, .radio input, .radio label {
        display: inline;
        font-size: 14px;
    }

    .radio {
        margin-top: 5px;
    }

    .radio label:not(:first-of-type) {
        margin-left: 5px;
    }

    /* .flex-row {
        display: flex;
    } */

    .light {
    border-radius: 10px;
    padding: 10px;
    /* box-shadow: 0 -1px 10px #0000000d, 0 1px 4px #0000001a, 0 10px 30px #f3ece8; */
    background: white;
    border: solid 2px lightblue;
    color: black;
    text-align: left !important;
    max-width: 300px;
    margin: auto;
    }

    .light input:not(.range_input) {
        border: solid lightgrey 1px;
        border-radius: 5px;
        padding: 0.5rem;
        font-size: 16px;
        max-width: 75%;
    }

    .light textarea {
        border: solid lightgrey 1px;
        border-radius: 5px;
        padding: 0.25rem;
        font-size: 14px;
        max-width: 100%; 
    }

    .range_input {
        background: none;
        border: none;
        border-bottom: solid 1px #f0f0f0;
        color: black;
        width: 25px;
        display: inline;
        font-size: 16px;
        padding: 0.5rem;
        outline: none;
    }

    .light input:focus:not(.range_input), .light textarea:focus {
        border-color: #a4d2ff;
        box-shadow: 0 0 6px #1b6ac97f;
        outline: none;
    }

    .light button {
        border-radius: 20px;
    color: #fff;
    border: none;
    background: #2da562;
    padding: 0.5em 2em;
    margin-top: 10px;
    font-size: 16px;
    cursor: pointer;
    margin-left: auto;
    display: block;
    }

    .greenbutton {
        border-radius: 20px;
    color: #fff;
    border: none;
    background: #2da562;
    padding: 0.25em 1em;
    margin-top: 10px;
    font-size: 16px;
    cursor: pointer;
    margin-left: auto;
    display: block;
    margin-top: 20px;
    }

    .question {
        font-weight: 500;
    }
    </style>