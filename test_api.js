

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

function formSubmit(event) {
    message.innerHTML = "<hr> <h3>Your file is uploading...</h3>"
    form.reset();
    let url = "http://149.165.154.247/upload";
    let request = new XMLHttpRequest();
    request.open("POST", url, true);
    request.onload = () => { // request successful
        message.innerHTML = "<hr> <h3>Your file was successfully submitted. Thank you for your contribution!</h3>"
    };

    request.onerror = () => {
        message.innerHTML = "<hr> <h3>An error occurred uploading your file. Please try a different file or try again later. If this error persists please contact the site administrators at hcdp@hawaii.edu.</h3>"
    };

    let formData = new FormData(event.target);
    formData.append("test", "test");
    for(let [key, value] of formData.entries()) { 
        console.log(key, value);
    }
    console.log(formData.entries(), event.target);
    request.send(new FormData(event.target));
    event.preventDefault();
}

