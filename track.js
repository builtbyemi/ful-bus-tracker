

import { inject } from "@vercel/analytics";

inject();

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
    apiKey: "AIzaSyB2c9YvF7vdRglr7KJKnbcmMb8ce06al4c",
    authDomain: "ful-bus-tracker.firebaseapp.com",
    projectId: "ful-bus-tracker",
    storageBucket: "ful-bus-tracker.firebasestorage.app",
    messagingSenderId: "770210508038",
    appId: "1:770210508038:web:1a38889aeb4d7f56018287"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);


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
        attribution:
            "&copy; OpenStreetMap contributors",

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
// LOCATION ICON
// =====================================================

const locationIcon = L.divIcon({

    className:
        "location-marker",

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

    iconSize: [
        34,
        34
    ],

    iconAnchor: [
        17,
        17
    ]
});


// =====================================================
// ROUTE POINT ICON
// =====================================================

const routePointIcon = L.divIcon({

    className:
        "route-point-marker",

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

    iconSize: [
        18,
        18
    ],

    iconAnchor: [
        9,
        9
    ]
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
// ROUTE
// =====================================================

let routeCoordinates = [];

async function loadRoute() {

    try {

        const url =
            `https://router.project-osrm.org/route/v1/driving/` +
            `${adankolo[1]},${adankolo[0]};` +
            `${routePoint[1]},${routePoint[0]};` +
            `${felele[1]},${felele[0]}` +
            `?overview=full&geometries=geojson`;


        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                "OSRM request failed"
            );
        }


        const data =
            await response.json();


        if (
            !data.routes ||
            !data.routes.length
        ) {

            throw new Error(
                "No route returned"
            );
        }


        const coordinates =
            data.routes[0]
                .geometry
                .coordinates;


        routeCoordinates =
            coordinates.map(
                ([lng, lat]) => [
                    lat,
                    lng
                ]
            );


        // =================================================
        // ROUTE OUTLINE
        // =================================================

        L.polyline(
            routeCoordinates,
            {
                color: "#ffffff",
                weight: 10,
                opacity: 0.65
            }
        ).addTo(map);


        // =================================================
        // MAIN ROUTE
        // =================================================

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
        42 -
        ((zoom - 13) * 3);


    return Math.max(
        25,
        Math.min(
            42,
            size
        )
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

        className:
            "bus-marker",

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

let currentBusData = {};

let selectedBusId =
    "FUL-001";


// Stores the latest direction of each bus

const busBearings = {};


// =====================================================
// BUS ROUTES / NAMES
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
// BUS STATUS
// =====================================================

function isBusOnline(bus) {

    return (
        bus &&
        bus.status === "ONLINE" &&
        bus.latitude !== null &&
        bus.longitude !== null
    );
}


// =====================================================
// UPDATE BUS CARD STATUS
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


    if (
        isBusOnline(bus)
    ) {

        statusElement.className =
            "bus-status online";

        statusElement.innerHTML =
            "<span></span>ONLINE";

    } else {

        statusElement.className =
            "bus-status offline";

        statusElement.innerHTML =
            "<span></span>OFFLINE";
    }
}


// =====================================================
// REMOVE BUS MARKER
// =====================================================

function removeBusMarker(
    busId
) {

    if (
        busMarkers[busId]
    ) {

        map.removeLayer(
            busMarkers[busId]
        );

        delete busMarkers[
            busId
        ];

        delete busBearings[
            busId
        ];

        console.log(
            `🗑️ ${busId} removed from map`
        );
    }
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
            `https://nominatim.openstreetmap.org/reverse` +
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
// UPDATE POPUP LOCATION
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
        from[0] *
        Math.PI / 180;

    const lat2 =
        to[0] *
        Math.PI / 180;

    const lon1 =
        from[1] *
        Math.PI / 180;

    const lon2 =
        to[1] *
        Math.PI / 180;


    const y =
        Math.sin(
            lon2 - lon1
        ) *
        Math.cos(lat2);


    const x =
        Math.cos(lat1) *
        Math.sin(lat2)
        -
        Math.sin(lat1) *
        Math.cos(lat2) *
        Math.cos(
            lon2 - lon1
        );


    const bearing =
        Math.atan2(
            y,
            x
        ) *
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
        <div style="min-width:200px;">

            <strong style="font-size:16px;">
                🚌 ${busId}
            </strong>

            <br><br>

            <span
                id="busLiveStatus-${busId}"
                style="color:#20a866;font-weight:700;"
           >
              ● LIVE
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

function isBusStale(bus) {

    if (!bus) {
        return true;
    }

    // Use lastGpsUpdate if available.
    // Fall back to timestamp for compatibility.
    const gpsTime =
        bus.lastGpsUpdate ??
        bus.timestamp;

    if (!gpsTime) {
        return true;
    }

    const age =
        Date.now() -
        Number(gpsTime);

    // Bus is considered stale after 15 seconds
    return age > 15000;
}


// =====================================================
// UPDATE / CREATE BUS
// =====================================================
function updateBusMarker(
    busId,
    bus
) {

    if (
    !bus ||
    bus.status !== "ONLINE" ||
    bus.latitude === null ||
    bus.longitude === null
) {
    removeBusMarker(busId);
    return;
}

const stale = isBusStale(bus);


    const position = [

        Number(
            bus.latitude
        ),

        Number(
            bus.longitude
        )

    ];


    // =================================================
    // CREATE MARKER
    // =================================================

    if (
        !busMarkers[busId]
    ) {

        const marker =
            L.marker(
                position,
                {
                    icon:
                        createBusIcon(
                            getBusSize()
                        ),

                    zIndexOffset:
                        1000
                }
            ).addTo(map);


        marker.bindPopup(
            createBusPopup(
                busId
            )
        );


        busMarkers[
            busId
        ] = marker;


        busBearings[
            busId
        ] = 0;


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
        busMarkers[
            busId
        ];


    const currentPosition =
        marker.getLatLng();


    const previous = [

        currentPosition.lat,

        currentPosition.lng

    ];


    // Only calculate direction if
    // the bus actually moved

    if (
        previous[0] !== position[0] ||
        previous[1] !== position[1]
    ) {

        const bearing =
            getBearing(
                previous,
                position
            );


        busBearings[
            busId
        ] = bearing;
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


    console.log(
        `📍 ${busId} moved:`,
        position
    );


    updateLocationName(
        busId,
        position[0],
        position[1]
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


    // =====================================================
// CHECK FOR STALE BUSES
// =====================================================

setInterval(() => {

    Object.keys(currentBusData).forEach((busId) => {

        const bus = currentBusData[busId];

        updateBusCard(busId, bus);

    });

}, 5000);


        // =============================================
        // UPDATE EVERY BUS
        // =============================================

        Object.keys(
            buses
        ).forEach(
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
            }
        );


        // =============================================
        // REMOVE MARKERS THAT NO LONGER EXIST
        // =============================================

        Object.keys(
            busMarkers
        ).forEach(
            (busId) => {

                if (
                    !isBusOnline(
                        buses[busId]
                    )
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
                    busMarkers[
                        busId
                    ];


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
// UPDATE SELECTED BUS PANEL
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


    selectedStatus.textContent =
        isBusOnline(bus)
            ? "LIVE"
            : "OFFLINE";


    selectedRoute.textContent =
        busInfo[
            selectedBusId
        ]?.route ||
        "FUL Bus Route";
}

setInterval(() => {

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

}, 10000);


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

function updateBusPopupStatus(
    busId,
    bus
) {

    const element =
        document.getElementById(
            `busLiveStatus-${busId}`
        );


    if (!element) {
        return;
    }


    if (
        isBusOnline(bus)
    ) {

        element.style.color =
            "#20a866";

        element.textContent =
            "● LIVE";


    } else if (
        isBusStale(bus)
    ) {

        element.style.color =
            "#f59e0b";

        element.textContent =
            "● GPS STALE";


    } else {

        element.style.color =
            "#ef4444";

        element.textContent =
            "● OFFLINE";
    }
}