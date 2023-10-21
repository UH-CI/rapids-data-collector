

let southWest = L.latLng(20.805385510716093, -156.73919677734378);
let northEast = L.latLng(20.933704959327144, -156.60186767578128);
let bounds = L.latLngBounds(southWest, northEast);
let map = L.map("map", {
    maxBounds: bounds,
    minZoom: 13,
    maxZoom: 20
}).setView([20.871593978421544, -156.6777849197388], 18);
L.tileLayer("http://www.google.com/maps/vt?lyrs=y@189&gl=en&x={x}&y={y}&z={z}", {
    maxZoom: 20
}).addTo(map);
map.on("click", (e) => {
    let {lat, lng} = e.latlng;
    //round to 6 decimals
    let precision = Math.pow(10, 6);
    lat = Math.round(lat * precision) / precision;
    lng = Math.round(lng * precision) / precision;
    document.getElementById("lat").value = lat;
    document.getElementById("lng").value = lng;
});

const form = document.getElementById("form");
form.addEventListener("submit", formSubmit);
const message = document.getElementById("submitMessage");

function convertTimestamp(formData) {
    let timestamp = new Date(formData.get("userTimestamp"));
    //subtract 10 hours so utc converted time will be in hawaii timezone
    timestamp.setHours(timestamp.getHours() - 10);
    //remove Z from iso string and replace with tz offset
    timestampString = timestamp.toISOString().slice(0, -1) + "-10:00";
    //replace timestamp
    formData.set("userTimestamp", timestampString);
}

const formWrapper = document.getElementById("form-wrapper");
const formWrapperChildren = [...formWrapper.childNodes];
console.log(formWrapperChildren);

function formReturn() {
    formWrapper.innerHTML = "";
    for(let child of formWrapperChildren) {
        formWrapper.appendChild(child);
    }
    setTimeout(() => {
        map.invalidateSize();
    }, 0);
}

const formReturnButton = document.createElement("button");
formReturnButton.addEventListener("click", formReturn);
formReturnButton.innerHTML = "<i class='fa-solid fa-chevron-left' style='padding-right:10px;'></i>Return to Form"
const submissionResponse = document.createElement("div");
submissionResponse.style= "margin:20px;";

"Please "

function validate(formData) {
    let valid = false;
    for(pair of formData.entries()) {
        if((pair[0] == "description" &&  pair[1] != "") || (pair[0] == "file" && pair[1].size > 0)) {
            valid = true;
        }
    }
    return valid;
    "Please provide either a description or file to upload"
}

function formSubmit(event) {
    event.preventDefault();

    let formData = new FormData(form);
    for(pair of formData.entries()) {
        console.log(pair);
        //console.log(formData.get("userTimestamp"))
    }
    // let timestamp = new Date(formData.get("userTimestamp"));
    // timestamp.setHours(timestamp.getHours() - 10);
    // timestampString = timestamp.toISOString().slice(0, -1) + "-10:00";
    // formData.set("userTimestamp", timestampString);
    // console.log(new Date(formData.get("userTimestamp")));



    const rText = "<p>Your file was successfully submitted. Thank you for your contribution!</p>";
    submissionResponse.innerHTML = rText;
    formWrapper.innerHTML = "";
    formWrapper.appendChild(formReturnButton);
    formWrapper.appendChild(submissionResponse);

    // grecaptcha.ready(function() {
    //     grecaptcha.execute("captcha_token", {action: "submit"}).then((token) => {
    //         message.innerHTML = "<hr> <h3>Your file is uploading...</h3>"
    //         let url = "http://149.165.154.247/upload";
    //         let request = new XMLHttpRequest();
    //         request.open("POST", url, true);
    //         // request.setRequestHeader("Content-Type", "multipart/form-data");
    //         request.onload = () => {
    //             message.innerHTML = "<hr> <h3>Your file was successfully submitted. Thank you for your contribution!</h3>"
    //         };

    //         request.onerror = () => {
    //             message.innerHTML = "<hr> <h3>An error occurred uploading your file. Please try a different file or try again later. If this error persists please contact the site administrators at hcdp@hawaii.edu.</h3>"
    //         };
    //         let formData = new FormData(form);
    //         request.send(formData);
    //         form.reset();
    //     });
    // });
    
}








form.addEventListener("submit", formSubmit);