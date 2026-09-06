

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getDatabase,
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";


// =====================================================
// FIREBASE
// =====================================================

const firebaseConfig = {
    apiKey: "AIzaSyB2c9YvF7vdRgl7rKJKnbcmMb8ce06al4c",
    authDomain: "ful-bus-tracker.firebaseapp.com",
    projectId: "ful-bus-tracker",
    storageBucket: "ful-bus-tracker.firebasestorage.app",
    messagingSenderId: "770210508038",
    appId: "1:770210508038:web:1a38889aeb4d7f56018287"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);


// =====================================================
// SETTINGS
// =====================================================

// Driver heartbeat is expected every 5 seconds.
// If we don't receive one for 15 seconds,
// the driver is considered offline.
const HEARTBEAT_TIMEOUT = 15000;

// GPS freshness is tracked separately.
// GPS can be stale without making the bus offline.
const GPS_FRESH_TIMEOUT = 30000;


// =====================================================
// LOCATIONS
// =====================================================

const adankolo = [
    7.7925993,
    6.7323953
];

const routePoint = [
    7.8199372,
    6.6957385
];

const felele = [
    7.8639932,
    6.6828039
];


// =====================================================
// MAP
// =====================================================

const map = L.map("map", {
    minZoom: 13,
    maxZoom: 18,

    maxBounds: [
        [7.77, 6.65],
        [7.89, 6.75]
    ],

    maxBoundsViscosity: 1.0,
    zoomControl: true
}).setView(
    [7.828, 6.706],
    13
);


// =====================================================
// MAP TILES
// =====================================================

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19
    }
).addTo(map);


// =====================================================
// MAP SCALE
// =====================================================

L.control.scale({
    imperial: false
}).addTo(map);


// =====================================================
// ZOOM CONTROL
// =====================================================

map.zoomControl.setPosition("topleft");


// =====================================================
// LOCATION ICON
// =====================================================

const locationIcon = L.divIcon({

    className: "location-marker",

    html: `
        <div style="
            background:#087b80;
            color:white;
            width:34px;
            height:34px;
            border-radius:50%;
            display:flex;
            align-items:center;
            justify-content:center;
            border:3px solid white;
            box-shadow:0 4px 12px rgba(0,0,0,.3);
            font-size:16px;
        ">
            📍
        </div>
    `,

    iconSize: [34, 34],
    iconAnchor: [17, 17]
});


// =====================================================
// ROUTE POINT ICON
// =====================================================

const routePointIcon = L.divIcon({

    className: "route-point-marker",

    html: `
        <div style="
            width:18px;
            height:18px;
            background:#ffffff;
            border:4px solid #087b80;
            border-radius:50%;
            box-shadow:0 3px 10px rgba(0,0,0,.3);
        "></div>
    `,

    iconSize: [18, 18],
    iconAnchor: [9, 9]
});


// =====================================================
// IMPORTANT PLACES
// =====================================================

// ADANKOLO

L.marker(
    adankolo,
    {
        icon: locationIcon
    }
)
.addTo(map)
.bindPopup(`
    <div style="min-width:190px;">

        <strong style="font-size:16px;">
            College of Health Sciences
        </strong>

        <br>

        Adankolo

        <br><br>

        <span style="color:#087b80;font-weight:700;">
            🚌 FUL Bus Route Start
        </span>

    </div>
`);


// ROUTE CHECKPOINT

L.marker(
    routePoint,
    {
        icon: routePointIcon
    }
)
.addTo(map)
.bindPopup(`
    <div style="min-width:180px;">

        <strong style="font-size:15px;">
            FUL Bus Route
        </strong>

        <br><br>

        📍 Route checkpoint

    </div>
`);


// FELELE CAMPUS

L.marker(
    felele,
    {
        icon: locationIcon
    }
)
.addTo(map)
.bindPopup(`
    <div style="min-width:190px;">

        <strong style="font-size:16px;">
            Federal University Lokoja
        </strong>

        <br>

        Felele Campus

        <br><br>

        <span style="color:#087b80;font-weight:700;">
            🚌 FUL Bus Destination
        </span>

    </div>
`);


// =====================================================
// ROAD ROUTE
// =====================================================

let routeCoordinates = [];

async function loadRoute() {

    try {

        const url =
            "https://router.project-osrm.org/route/v1/driving/" +
            `${adankolo[1]},${adankolo[0]};` +
            `${routePoint[1]},${routePoint[0]};` +
            `${felele[1]},${felele[0]}` +
            "?overview=full&geometries=geojson";

        const response =
            await fetch(url);

        if (!response.ok) {
            throw new Error("OSRM request failed");
        }

        const data =
            await response.json();

        if (
            !data.routes ||
            !data.routes.length
        ) {
            throw new Error("No route returned");
        }

        const coordinates =
            data.routes[0]
                .geometry
                .coordinates;

        routeCoordinates =
            coordinates.map(
                ([lng, lat]) => [lat, lng]
            );


        // ROUTE OUTLINE

        L.polyline(
            routeCoordinates,
            {
                color: "#ffffff",
                weight: 10,
                opacity: 0.65
            }
        ).addTo(map);


        // MAIN ROUTE

        L.polyline(
            routeCoordinates,
            {
                color: "#087b80",
                weight: 6,
                opacity: 0.95
            }
        ).addTo(map);


        console.log(
            "✅ FUL road route loaded:",
            routeCoordinates.length,
            "points"
        );

    } catch (error) {

        console.error(
            "❌ Route error:",
            error
        );
    }
}

loadRoute();


// =====================================================
// BUS ICON SIZE
// =====================================================

function getBusSize() {

    const zoom =
        map.getZoom();

    const size =
        42 - ((zoom - 13) * 3);

    return Math.max(
        25,
        Math.min(42, size)
    );
}


// =====================================================
// BUS ICON
// =====================================================

function createBusIcon(
    size,
    rotation = 0
) {

    return L.divIcon({

        className: "bus-marker",

        html: `
            <img
                src="images/bus-2.png"
                alt="FUL Bus"
                style="
                    width:${size}px;
                    height:${size}px;
                    object-fit:contain;
                    display:block;
                    transform:rotate(${rotation}deg);
                    transform-origin:center center;
                    filter:drop-shadow(
                        0 3px 5px rgba(0,0,0,.4)
                    );
                "
            >
        `,

        iconSize: [
            size,
            size
        ],

        iconAnchor: [
            size / 2,
            size / 2
        ]
    });
}


// =====================================================
// BUS DATA
// =====================================================

const busMarkers = {};

const busBearings = {};

let currentBusData = {};

let selectedBusId = "FUL-001";


// =====================================================
// BUS INFORMATION
// =====================================================

const busInfo = {

    "FUL-001": {
        route: "Main Campus"
    },

    "FUL-002": {
        route: "Lokoja"
    },

    "FUL-003": {
        route: "Main Campus"
    },

    "FUL-004": {
        route: "Main Campus"
    }
};


// =====================================================
// TIMESTAMP HELPER
// =====================================================

function getTimestamp(value) {

    const timestamp =
        Number(value);

    if (!Number.isFinite(timestamp)) {
        return null;
    }

    return timestamp;
}


// =====================================================
// HEARTBEAT CHECK
// =====================================================

function isHeartbeatAlive(bus) {

    if (!bus) {
        return false;
    }

    const heartbeat =
        getTimestamp(
            bus.lastHeartbeat
        );

    if (heartbeat === null) {
        return false;
    }

    const age =
        Date.now() - heartbeat;

    return (
        age >= 0 &&
        age <= HEARTBEAT_TIMEOUT
    );
}


// =====================================================
// GPS FRESHNESS
// =====================================================

function getGpsAge(bus) {

    if (!bus) {
        return null;
    }

    const gpsTimestamp =
        getTimestamp(
            bus.lastGpsUpdate
        );

    if (gpsTimestamp === null) {
        return null;
    }

    const age =
        Date.now() - gpsTimestamp;

    if (age < 0) {
        return 0;
    }

    return age;
}


function getGpsState(bus) {

    const gpsAge =
        getGpsAge(bus);

    if (gpsAge === null) {
        return "NO GPS";
    }

    if (
        gpsAge <= GPS_FRESH_TIMEOUT
    ) {
        return "GPS FRESH";
    }

    return "GPS STALE";
}


// =====================================================
// GET BUS STATE
// =====================================================
//
// IMPORTANT:
//
// ONLINE/OFFLINE is controlled by:
//     tripStarted + heartbeat
//
// GPS freshness is completely separate.
//
// GPS being stale WILL NOT make the bus PAUSED.
// =====================================================

function getBusState(bus) {

    if (!bus) {
        return "OFFLINE";
    }

    // Trip is not active.
    if (bus.tripStarted !== true) {
        return "OFFLINE";
    }

    // Driver heartbeat is dead.
    if (!isHeartbeatAlive(bus)) {
        return "OFFLINE";
    }

    // Driver is alive and trip is active.
    return "ONLINE";
}


// =====================================================
// CHECK ONLINE BUS
// =====================================================

function isBusOnline(bus) {

    return getBusState(bus) === "ONLINE";
}


// =====================================================
// UPDATE BUS CARD
// =====================================================

function updateBusCard(
    busId,
    bus
) {

    const statusElement =
        document.getElementById(
            `busStatus-${busId}`
        );

    if (!statusElement) {
        return;
    }

    const state =
        getBusState(bus);


    if (state === "ONLINE") {

        statusElement.className =
            "bus-status online";

        statusElement.innerHTML =
            "<span></span>ONLINE";

        return;
    }


    statusElement.className =
        "bus-status offline";

    statusElement.innerHTML =
        "<span></span>OFFLINE";
}


// =====================================================
// REMOVE BUS MARKER
// =====================================================

function removeBusMarker(busId) {

    if (!busMarkers[busId]) {
        return;
    }

    map.removeLayer(
        busMarkers[busId]
    );

    delete busMarkers[busId];

    delete busBearings[busId];

    console.log(
        `🗑️ ${busId} removed from map`
    );
}


// =====================================================
// BUS LOCATION NAME
// =====================================================

let lastGeocodeTime = 0;

async function getPlaceName(
    latitude,
    longitude
) {

    const now =
        Date.now();

    if (
        now - lastGeocodeTime < 15000
    ) {
        return null;
    }

    lastGeocodeTime =
        now;

    try {

        const url =
            "https://nominatim.openstreetmap.org/reverse" +
            `?format=json` +
            `&lat=${latitude}` +
            `&lon=${longitude}` +
            `&zoom=18` +
            `&addressdetails=1`;

        const response =
            await fetch(url);

        if (!response.ok) {
            throw new Error(
                "Geocoding failed"
            );
        }

        const data =
            await response.json();

        const address =
            data.address || {};

        return (
            address.neighbourhood ||
            address.suburb ||
            address.quarter ||
            address.village ||
            address.town ||
            address.city_district ||
            address.city ||
            address.road ||
            "Unknown location"
        );

    } catch (error) {

        console.error(
            "Location name error:",
            error
        );

        return null;
    }
}


// =====================================================
// UPDATE LOCATION NAME
// =====================================================

async function updateLocationName(
    busId,
    latitude,
    longitude
) {

    const place =
        await getPlaceName(
            latitude,
            longitude
        );

    if (!place) {
        return;
    }

    const element =
        document.getElementById(
            `busLocationName-${busId}`
        );

    if (element) {

        element.textContent =
            `Near ${place}`;
    }
}


// =====================================================
// BUS DIRECTION
// =====================================================

function getBearing(
    from,
    to
) {

    const lat1 =
        from[0] * Math.PI / 180;

    const lat2 =
        to[0] * Math.PI / 180;

    const lon1 =
        from[1] * Math.PI / 180;

    const lon2 =
        to[1] * Math.PI / 180;

    const y =
        Math.sin(lon2 - lon1) *
        Math.cos(lat2);

    const x =
        Math.cos(lat1) *
        Math.sin(lat2)
        -
        Math.sin(lat1) *
        Math.cos(lat2) *
        Math.cos(lon2 - lon1);

    const bearing =
        Math.atan2(y, x) *
        180 / Math.PI;

    return (
        bearing + 360
    ) % 360;
}


// =====================================================
// CREATE BUS POPUP
// =====================================================

function createBusPopup(
    busId
) {

    const route =
        busInfo[busId]?.route ||
        "FUL Bus Route";

    return `
        <div style="min-width:210px;">

            <strong style="font-size:16px;">
                🚌 ${busId}
            </strong>

            <br><br>

            <span
                id="busLiveStatus-${busId}"
                style="
                    color:#20a866;
                    font-weight:700;
                "
            >
                ● ONLINE
            </span>

            <br>

            <span
                id="busGpsStatus-${busId}"
                style="
                    color:#087b80;
                    font-size:13px;
                    font-weight:600;
                "
            >
                📡 GPS: Checking...
            </span>

            <br><br>

            📍
            <span id="busLocationName-${busId}">
                Finding location...
            </span>

            <br><br>

            🛣️ ${route}

        </div>
    `;
}


// =====================================================
// UPDATE BUS POPUP STATUS
// =====================================================

function updateBusPopupStatus(
    busId,
    bus
) {

    const liveElement =
        document.getElementById(
            `busLiveStatus-${busId}`
        );

    const gpsElement =
        document.getElementById(
            `busGpsStatus-${busId}`
        );


    // -----------------------------
    // DRIVER / TRIP STATUS
    // -----------------------------

    if (liveElement) {

        const state =
            getBusState(bus);

        if (state === "ONLINE") {

            liveElement.style.color =
                "#20a866";

            liveElement.textContent =
                "● ONLINE";

        } else {

            liveElement.style.color =
                "#ef4444";

            liveElement.textContent =
                "● OFFLINE";
        }
    }


    // -----------------------------
    // GPS STATUS
    // -----------------------------

    if (gpsElement) {

        const gpsState =
            getGpsState(bus);

        if (gpsState === "GPS FRESH") {

            gpsElement.style.color =
                "#087b80";

            gpsElement.textContent =
                "📡 GPS: FRESH";

        } else if (
            gpsState === "GPS STALE"
        ) {

            gpsElement.style.color =
                "#f59e0b";

            gpsElement.textContent =
                "📡 GPS: STALE";

        } else {

            gpsElement.style.color =
                "#888";

            gpsElement.textContent =
                "📡 GPS: NO DATA";
        }
    }
}


// =====================================================
// UPDATE / CREATE BUS MARKER
// =====================================================

function updateBusMarker(
    busId,
    bus
) {

    // Only remove marker when the trip is
    // actually inactive/offline or there
    // is no usable location at all.

    if (
        !bus ||
        bus.status !== "ONLINE" ||
        bus.tripStarted !== true ||
        bus.latitude === null ||
        bus.longitude === null ||
        bus.latitude === undefined ||
        bus.longitude === undefined
    ) {

        removeBusMarker(busId);

        return;
    }


    const latitude =
        Number(bus.latitude);

    const longitude =
        Number(bus.longitude);


    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {

        removeBusMarker(busId);

        return;
    }


    const position = [
        latitude,
        longitude
    ];


    // =================================================
    // CREATE MARKER
    // =================================================

    if (!busMarkers[busId]) {

        const marker =
            L.marker(
                position,
                {
                    icon:
                        createBusIcon(
                            getBusSize()
                        ),

                    zIndexOffset: 1000
                }
            )
            .addTo(map);


        marker.bindPopup(
            createBusPopup(
                busId
            )
        );


        // Refresh popup whenever it opens.
        marker.on(
            "popupopen",
            () => {

                updateBusPopupStatus(
                    busId,
                    currentBusData[busId]
                );
            }
        );


        busMarkers[busId] =
            marker;

        busBearings[busId] =
            0;


        console.log(
            `🚌 ${busId} marker created`,
            position
        );


        updateLocationName(
            busId,
            position[0],
            position[1]
        );

        return;
    }


    // =================================================
    // MOVE EXISTING MARKER
    // =================================================

    const marker =
        busMarkers[busId];

    const currentPosition =
        marker.getLatLng();

    const previous = [

        currentPosition.lat,

        currentPosition.lng
    ];


    // Calculate direction only
    // when bus actually moves.

    if (
        previous[0] !== position[0] ||
        previous[1] !== position[1]
    ) {

        const bearing =
            getBearing(
                previous,
                position
            );

        busBearings[busId] =
            bearing;
    }


    marker.setLatLng(
        position
    );


    marker.setIcon(
        createBusIcon(
            getBusSize(),
            busBearings[busId] || 0
        )
    );


    updateLocationName(
        busId,
        position[0],
        position[1]
    );


    updateBusPopupStatus(
        busId,
        bus
    );


    console.log(
        `📍 ${busId} updated:`,
        position
    );
}


// =====================================================
// FIREBASE — ALL BUSES
// =====================================================

const busesRef =
    ref(
        database,
        "buses"
    );


onValue(
    busesRef,
    (snapshot) => {

        const buses =
            snapshot.val() || {};


        console.log(
            "🔥 All live buses:",
            buses
        );


        currentBusData =
            buses;


        // =============================================
        // UPDATE ALL BUSES
        // =============================================

        Object.keys(buses).forEach(
            (busId) => {

                const bus =
                    buses[busId];


                updateBusCard(
                    busId,
                    bus
                );


                updateBusMarker(
                    busId,
                    bus
                );


                updateBusPopupStatus(
                    busId,
                    bus
                );
            }
        );


        // =============================================
        // REMOVE TRULY INACTIVE BUSES
        // =============================================

        Object.keys(busMarkers).forEach(
            (busId) => {

                const bus =
                    buses[busId];

                if (
                    !bus ||
                    bus.status !== "ONLINE" ||
                    bus.tripStarted !== true ||
                    bus.latitude === null ||
                    bus.longitude === null ||
                    bus.latitude === undefined ||
                    bus.longitude === undefined
                ) {

                    removeBusMarker(
                        busId
                    );
                }
            }
        );


        // =============================================
        // UPDATE SELECTED BUS
        // =============================================

        updateSelectedBus();
    }
);


// =====================================================
// REFRESH STATUS
// =====================================================

setInterval(
    () => {

        Object.keys(
            currentBusData
        ).forEach(
            (busId) => {

                const bus =
                    currentBusData[busId];


                updateBusCard(
                    busId,
                    bus
                );


                updateBusPopupStatus(
                    busId,
                    bus
                );
            }
        );


        updateSelectedBus();

    },
    3000
);


// =====================================================
// BUS ICON RESIZE
// =====================================================

map.on(
    "zoomend",
    () => {

        Object.keys(
            busMarkers
        ).forEach(
            (busId) => {

                const marker =
                    busMarkers[busId];


                marker.setIcon(
                    createBusIcon(
                        getBusSize(),
                        busBearings[busId] || 0
                    )
                );
            }
        );
    }
);


// =====================================================
// SELECT BUS
// =====================================================

window.selectBus =
function(busId) {

    selectedBusId =
        busId;

    updateSelectedBus();
};


// =====================================================
// UPDATE SELECTED BUS
// =====================================================

function updateSelectedBus() {

    const selectedBus =
        document.getElementById(
            "selectedBus"
        );

    const selectedStatus =
        document.getElementById(
            "selectedStatus"
        );

    const selectedRoute =
        document.getElementById(
            "selectedRoute"
        );


    if (
        !selectedBus ||
        !selectedStatus ||
        !selectedRoute
    ) {
        return;
    }


    const bus =
        currentBusData[
            selectedBusId
        ];


    selectedBus.textContent =
        selectedBusId;


    const state =
        getBusState(bus);


    // =============================================
    // ONLINE
    // =============================================

    if (state === "ONLINE") {

        const gpsState =
            getGpsState(bus);

        selectedStatus.textContent =
            gpsState === "GPS STALE"
                ? "ONLINE • GPS STALE"
                : "ONLINE";

        selectedStatus.style.color =
            gpsState === "GPS STALE"
                ? "#f59e0b"
                : "#20a866";

        return;
    }


    // =============================================
    // OFFLINE
    // =============================================

    selectedStatus.textContent =
        "OFFLINE";

    selectedStatus.style.color =
        "#ef4444";
}


// =====================================================
// TOGGLE BUS PANEL
// =====================================================

window.toggleBusPanel =
function() {

    const panel =
        document.querySelector(
            ".bus-panel"
        );

    if (!panel) {
        return;
    }

    panel.classList.toggle(
        "hidden"
    );
};


// =====================================================
// FINISHED
// =====================================================

console.log(
    "🚌 FUL Bus Tracker initialized successfully."
);