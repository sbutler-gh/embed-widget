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
            geocoder_input = `${city}, ${country}`;
            postal = json.postal;
            content = true

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
        formData.forEach(function(value, key){
            object[key] = value;
        });
        var json = JSON.stringify(object);

        console.log(json);

        object.support_needed = support_needed;
        object.contribution_areas = contribution_areas;

        submit_results = object;
        console.log(submit_results);
        console.log(submit_results.support_needed);
        console.log(submit_results.other_support_needed);
        console.log(submit_results.other_contributions);
        console.log(submit_results.chance_of_success_needed);
    }

    </script>
    

    <div id="banner">
        <div style="text-align: center;">
            <!-- <h3>Ready to <span style="color: yellow; font-weight: bold">end extraction</span> and <span style="color: palegreen; font-weight: bold">build new worlds</span>?</h3> -->
            <!-- <p>Fill out the form below, and you'll be connected with leading organizers and actions near you.</p> -->
            <h3>Ready for <span style="color: palegreen; font-weight: bold">climate action</span>?</h3>
            <p>Fill out this form, and we'll connect you with relevant groups where you can put your power to use.</p>

        <!-- <h3><em>Movements that have engage 3.5% of the population have never failed to bring about change.</em></h3>
        <p>Are you ready to join the <span style="color: palegreen; font-weight: bold">climate movement</span>?</p> -->
        </div>

        <form class="light" on:submit|preventDefault={submitForm}>

            {#if !submit_results}
                <div>
                    <label for="email">Email</label>
                    <input type="email" name="email" placeholder="" required>
                </div>

                <div class="flex-row">
                    <div>
                    <label for="postal">ZIP/Postal Code</label>
                    <input style="width: 60px;" type="text" name="postal" bind:value={postal} placeholder="" required>
                    </div>
                    <div style="margin-left: 30px;">
                        <label for="country">Country</label>
                        <input style="width: 30px" type="text" name="country" bind:value={country} placeholder="" required>
                    </div>
                </div>

                <div>
                <label for="arrest" class="question">Are you willing to risk arrest in frontline actions?</label>
                <div class="radio">
                    <input type="radio" value="yes" bind:group={arrest} required><label>Yes</label>
                    <input type="radio" value="no" bind:group={arrest} required><label>No</label>
                    <input type="radio" value="other" bind:group={arrest} required><label>Other</label>
                </div>
                </div>

                {#if arrest == "no" || arrest == "other"}
                <div style="margin-top: 15px;">
                    <label for="support"  style="width: 90%; font-style: italic; font-size: 15px;">What would support you in joining frontline actions and risking arrest?</label>
                    <div class="checkbox">
                    <input type="checkbox" bind:group={support_needed} value="enough_participants"><label>I need to know there will be enough people participating, to give our action a high chance of success (e.g. generating significant media attention)</label><br/>
                    </div>
                    {#if support_needed.includes('enough_participants')}
                    <div class="range">
                    <label style="width: 90%; font-style: italic; font-size: 15px;">How much confidence do you need before you're willing to risk arrest?</label>
                    <input type="range" bind:value={chance_of_success_needed}>
                    <input type="text" class="range_input" bind:value={chance_of_success_needed} min={0} max={99}><span style="font-size: 15px">% chance of success</span>
                    </div>
                    {/if}
                    <!-- {#if support.includes('enough_participants')}
                    <div class="range">
                    <label style="width: 90%; font-style: italic; font-size: 15px;">How confident do you need to be in an action's chance of success, before you'll be willing to participate?</label>
                    <input type="range" bind:value={percent_success}>
                    <input type="number" class="range_input" bind:value={percent_success} min="0" max="99"><span>%</span>
                    </div>
                    {/if} -->
                    <div class="checkbox">
                    <input type="checkbox" bind:group={support_needed} value="job_security"><label>I need to know participating won't affect my job security or ability to get employement.</label><br/>
                    </div>
                    <div class="checkbox">
                    <input type="checkbox" bind:group={support_needed} value="costs_will_be_covered"><label>I need to know that transport, childcare, bail, and all costs of participation will be covered for me.</label><br/>
                    </div>
                    <div class="checkbox">
                    <input type="checkbox" bind:group={support_needed} value="legal_information"><label>I need to know the legal risks and the legal support provided to participants.</label><br/>
                    </div>
                    <div class="checkbox">
                    <input type="checkbox" bind:group={support_needed} value="friend_to_join"><label>I need a friend willing to join me.</label><br/>
                    </div>
                    <div class="checkbox">
                        <input type="checkbox" bind:group={support_needed} value="meet_others"><label>I want to meet others locally who are willing to risk arrest</label><br/>
                    </div>
                    <div class="checkbox">
                        <input type="checkbox" bind:group={support_needed} value="other"><label>Other</label><br/>
                        {#if support_needed.includes('other')}
                        <label style="font-size: 14px; font-style: italic;">What else would support you in risking arrest?</label>
                        <textarea type="text" bind:value={other_support_needed}></textarea>
                        {/if}
                    </div>
                    </div>
        
                    <!-- {#if support.length > 0}
                    <label for="conditional_commit">If we could provide these supports, are you willing to conditionally commit to risking arrest in the future?</label>
                    <div class="radio">
                        <input type="radio" value="yes" bind:group={conditional_commit}><label>Yes</label>
                        <input type="radio" value="no" bind:group={conditional_commit}><label>No</label>
                        <input type="radio" value="other" bind:group={conditional_commit}><label>Other</label>
                    </div>
                    {/if} -->
                {/if}

                {#if arrest}
                <label for="other_support"  style="width: 90%; font-style: italic; font-size: 15px; margin-top: 15px;">Can you support in any of these areas as well?</label>
                <div class="checkbox">
                <div class="checkbox">
                <input type="checkbox" bind:group={contribution_areas} value="local_organizing"><label>Local neighborhood organizing</label>
                </div>
                <div class="checkbox">
                <input type="checkbox" bind:group={contribution_areas} value="fundraising"><label>Fundraising</label></div>
                <div class="checkbox">
                <input type="checkbox" bind:group={contribution_areas} value="technical_computer"><label>Technical / computer support</label></div>
                <div class="checkbox">
                <input type="checkbox" bind:group={contribution_areas} value="canvassing_field_organizing"><label>Canvassing and field organizing</label></div>
                <div class="checkbox">
                <input type="checkbox" bind:group={contribution_areas} value="phone_banking"><label>Phone banking</label></div>
                <div class="checkbox">
                <input type="checkbox" bind:group={contribution_areas} value="legal"><label>Legal support</label></div>
                <div class="checkbox">
                <input type="checkbox" bind:group={contribution_areas} value="transportation"><label>Transportation support</label></div>
                <div class="checkbox">
                <input type="checkbox" bind:group={contribution_areas} value="childcare"><label>Childcare support around actions</label></div>
                <div class="checkbox">
                <input type="checkbox" bind:group={contribution_areas} value="art_design_video_graphics_media"><label>Art, design, video, graphics, media</label></div>
                <div class="checkbox">
                <input type="checkbox" bind:group={contribution_areas} value="yard_signs"><label>Yard sign outreach</label></div>
                <div class="checkbox">
                <input type="checkbox" bind:group={contribution_areas} value="donations"><label>Donating to organizations</label></div>
                </div>


                <div style="margin-top: 15px;">
                    <label style="width: 90%; font-style: italic; font-size: 15px;">Any other skills/ways you'd like to contribute?</label>
                    <textarea bind:value={other_contributions} style="width: 90%; margin-top: 7px;"></textarea>
                </div>

                <button type="submit">Submit</button>
                {/if}

                {:else}
                <p><strong>Email</strong>: {submit_results.email}</p>
                <p><strong>Zip/Postal Code</strong>: {submit_results.postal}</p>
                <p><strong>Country</strong>: {submit_results.country}</p>
                <p><strong>Willing to risk arrest?</strong>: {arrest}</p>
                {#if submit_results.support_needed.length > 0}
                <p><strong>Support needed before risking arrest:</strong></p>
                <ul>
                    {#each submit_results.support_needed as need}
                    <li>{need}
                        {#if need == "enough_participants"}
                        <li style="margin-left: 25px; margin-bottom: 10px;">{submit_results.chance_of_success_needed}% chance of success</li>
                        {:else if need == "other"}
                        <li style="margin-left: 25px; margin-bottom: 10px;">{submit_results.other_support_needed}</li>
                        {/if}
                    </li>
                    {/each}
                </ul>
                {/if}
                {#if submit_results.contribution_areas.length > 0}
                <p><strong>Areas willing to contribute:</strong></p>
                <ul>
                    {#each submit_results.contribution_areas as contribution}
                    <li>{contribution}
                        <!-- {#if contribution.value == "other"}
                        <li>{submit_results.other_contributions}</li>
                        {/if} -->
                    </li>
                    {/each}
                </ul>
                {/if}
                <p><strong>Other skills/ways to contribute</strong>:</p>
                <p>{other_contributions}</p>
                {/if}

                
<!-- 
                {#if arrest}
                <button type="button">Submit</button>
                {/if} -->

            <!-- <button type="button" style="padding: 0.25em 1em;" on:click={nextFormPage}>Next</button> -->
            <!-- <button type="button" style="background: lightgrey; color: grey; padding: 0.25em 1em; margin: 0;" on:click={backFormPage}>Back</button> -->
            <!-- <button style="margin-left: auto; display: block; background: forestgreen; color: white; border-radius: 10px; font-weight: bold; margin-top: 10px; border: none; padding: 5px 10px; cursor: pointer;">Submit</button> -->
        </form>
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
    }
    @media only screen and (max-width: 600px) {
        #banner {
            max-width: 100%;
            max-height: 200px;
     }
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

    .flex-row {
        display: flex;
    }

    .flex-row div:not(:first-of-type) {
        margin-left: 10px;
    }

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

    .question {
        font-weight: 500;
    }
    </style>