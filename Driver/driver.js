


import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";


// ===============================
// FIREBASE
// ===============================

const firebaseConfig = {
    apiKey: "AIzaSyB2c9YvF7vdRglr7KJKnbcmMb8ce06al4c",
    authDomain: "ful-bus-tracker.firebaseapp.com",
    projectId: "ful-bus-tracker",
    storageBucket: "ful-bus-tracker.firebasestorage.app",
    messagingSenderId: "770210508038",
    appId: "1:770210508038:web:1a38889aeb4d7f56018287"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);


// ===============================
// GET BUS FROM URL
// ===============================

const params = new URLSearchParams(window.location.search);
const BUS_ID = params.get("bus");


// ===============================
// HTML ELEMENTS
// ===============================

const driverSelection = document.getElementById("driverSelection");
const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");
const assignedBus = document.getElementById("assignedBus");


// ===============================
// DRIVER PASSWORDS
// ===============================

const DRIVER_PASSWORDS = {
    "FUL-001": "FulDriver001!",
    "FUL-002": "FulDriver002!",
    "FUL-003": "FulDriver003!"
};

const DRIVER_PASSWORD = DRIVER_PASSWORDS[BUS_ID];


// ===============================
// SHOW CORRECT SCREEN
// ===============================

if (BUS_ID && DRIVER_PASSWORD) {

    // Hide bus selection
    driverSelection.classList.add("hidden");

    // Show login
    loginSection.classList.remove("hidden");

    // Show assigned bus
    if (assignedBus) {
        assignedBus.textContent = BUS_ID;
    }

} else {

    // No bus selected
    driverSelection.classList.remove("hidden");
    loginSection.classList.add("hidden");
    dashboardSection.classList.add("hidden");

}


// ===============================
// FIREBASE BUS REFERENCE
// ===============================

const busRef = BUS_ID
    ? ref(database, `buses/${BUS_ID}`)
    : null;


// ===============================
// PASSWORD REQUIREMENTS
// ===============================

function checkPasswordRequirements() {

    const passwordInput = document.getElementById("password");

    if (!passwordInput) return;

    const password = passwordInput.value;

    const requirements = {

        length: password.length >= 8,

        uppercase: /[A-Z]/.test(password),

        lowercase: /[a-z]/.test(password),

        number: /[0-9]/.test(password),

        special: /[^A-Za-z0-9]/.test(password)

    };

    updateRequirement("length", requirements.length);
    updateRequirement("uppercase", requirements.uppercase);
    updateRequirement("lowercase", requirements.lowercase);
    updateRequirement("number", requirements.number);
    updateRequirement("special", requirements.special);
}


function updateRequirement(id, passed) {

    const element = document.getElementById(id);

    if (!element) return;

    if (passed) {

        element.textContent =
            "✓ " + getRequirementText(id);

        element.classList.add("valid");

    } else {

        element.textContent =
            "✕ " + getRequirementText(id);

        element.classList.remove("valid");

    }

}


function getRequirementText(id) {

    const texts = {

        length: "At least 8 characters",

        uppercase: "One uppercase letter",

        lowercase: "One lowercase letter",

        number: "One number",

        special: "One special character"

    };

    return texts[id];

}


// Make available to HTML
window.checkPasswordRequirements = checkPasswordRequirements;


// ===============================
// SHOW / HIDE PASSWORD
// ===============================

window.togglePassword = function () {

    const password =
        document.getElementById("password");

    const toggle =
        document.querySelector(".toggle-password");

    if (!password || !toggle) return;


    if (password.type === "password") {

        password.type = "text";

        // Eye with slash
        toggle.innerHTML = `
            <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M3 3l18 18"></path>
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path>
                <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 10 8-0.6 1.6-1.6 3.1-3 4.4"></path>
                <path d="M6.6 6.6C4.8 7.8 3.5 9.6 2 12c1.5 4 5 8 10 8 1.5 0 2.8-.3 4-.9"></path>
            </svg>
        `;

        toggle.setAttribute(
            "aria-label",
            "Hide password"
        );

    } else {

        password.type = "password";

        // Normal eye
        toggle.innerHTML = `
            <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;

        toggle.setAttribute(
            "aria-label",
            "Show password"
        );

    }

};


// ===============================
// LOGIN
// ===============================

window.login = function () {

    const passwordInput =
        document.getElementById("password");

    const message =
        document.getElementById("loginMessage");

    if (!passwordInput || !message) return;

    const password = passwordInput.value;


    if (!DRIVER_PASSWORD) {

        message.className = "error-message";

        message.textContent =
            "⚠ Invalid driver account.";

        return;

    }


    if (password === DRIVER_PASSWORD) {

        message.className = "success-message";

        message.textContent =
            "✓ Login successful";


        setTimeout(() => {

            loginSection.classList.add("hidden");

            dashboardSection.classList.remove("hidden");

            restoreTripState();

        }, 500);


    } else {

        message.className = "error-message";

        message.textContent =
            "⚠ Incorrect password. Please try again.";

    }

};


// ===============================
// GPS
// ===============================

let watchID = null;


function startGPS() {

    if (!navigator.geolocation) {

        alert(
            "Your browser does not support GPS."
        );

        return;

    }


    if (watchID !== null) return;


    document.getElementById("status").textContent =
        "LOCATING...";

    document.getElementById("latitude").textContent =
        "Getting location...";

    document.getElementById("longitude").textContent =
        "Getting location...";


    watchID = navigator.geolocation.watchPosition(

        async (position) => {

            const latitude =
                position.coords.latitude;

            const longitude =
                position.coords.longitude;


            document.getElementById("status").textContent =
                "ONLINE";

            document.getElementById("latitude").textContent =
                latitude.toFixed(6);

            document.getElementById("longitude").textContent =
                longitude.toFixed(6);


            document
                .getElementById("startButton")
                .classList.add("hidden");

            document
                .getElementById("stopButton")
                .classList.remove("hidden");


            try {

                await set(busRef, {

                    busId: BUS_ID,

                    status: "ONLINE",

                    tripStarted: true,

                    latitude: latitude,

                    longitude: longitude,

                    timestamp: Date.now()

                });

            } catch (error) {

                console.error(
                    "Firebase error:",
                    error
                );

            }

        },


        (error) => {

            console.log(
                "GPS Error:",
                error
            );

            document.getElementById("status").textContent =
                "GPS ERROR";


            if (error.code === 1) {

                alert(
                    "Location permission was denied. Please allow location access."
                );

            } else if (error.code === 2) {

                alert(
                    "Your location could not be determined."
                );

            } else if (error.code === 3) {

                alert(
                    "GPS request timed out. Please try again."
                );

            }

        },


        {
            enableHighAccuracy: false,
            maximumAge: 10000,
            timeout: 60000
        }

    );

}


// ===============================
// START TRIP
// ===============================

window.startTrip = async function () {

    if (!busRef) return;


    try {

        await set(busRef, {

            busId: BUS_ID,

            status: "ONLINE",

            tripStarted: true,

            latitude: null,

            longitude: null,

            timestamp: Date.now()

        });


        console.log(
            `${BUS_ID} trip started.`
        );

        startGPS();


    } catch (error) {

        console.error(
            "Could not start trip:",
            error
        );

        alert(
            "Could not start trip. Please try again."
        );

    }

};


// ===============================
// RESTORE TRIP
// ===============================

function restoreTripState() {

    if (!busRef) return;


    onValue(

        busRef,

        (snapshot) => {

            const bus = snapshot.val();

            if (!bus) return;


            if (
                bus.tripStarted === true &&
                bus.status === "ONLINE"
            ) {

                document.getElementById("status").textContent =
                    "ONLINE";


                document
                    .getElementById("startButton")
                    .classList.add("hidden");


                document
                    .getElementById("stopButton")
                    .classList.remove("hidden");


                if (
                    bus.latitude !== null &&
                    bus.longitude !== null
                ) {

                    document.getElementById("latitude").textContent =
                        Number(bus.latitude).toFixed(6);

                    document.getElementById("longitude").textContent =
                        Number(bus.longitude).toFixed(6);

                }


                startGPS();

            }

        }

    );

}


// ===============================
// STOP TRIP
// ===============================

window.stopTrip = async function () {

    if (!busRef) return;


    if (watchID !== null) {

        navigator.geolocation.clearWatch(
            watchID
        );

        watchID = null;

    }


    document.getElementById("status").textContent =
        "OFFLINE";

    document.getElementById("latitude").textContent =
        "--";

    document.getElementById("longitude").textContent =
        "--";


    document
        .getElementById("startButton")
        .classList.remove("hidden");


    document
        .getElementById("stopButton")
        .classList.add("hidden");


    try {

        await set(busRef, {

            busId: BUS_ID,

            status: "OFFLINE",

            tripStarted: false,

            latitude: null,

            longitude: null,

            timestamp: Date.now()

        });


        console.log(
            `${BUS_ID} trip ended.`
        );


    } catch (error) {

        console.error(
            "Firebase error:",
            error
        );

    }

};