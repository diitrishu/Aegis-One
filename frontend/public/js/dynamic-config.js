/**
 * Dynamic Disaster Response Dashboard Configuration
 * Production-grade configuration for on-demand layer loading
 */

const DynamicConfig = {
    // QGIS Server Configuration
    server: {
        baseUrl: "http://localhost:8081/ows/",
        projectFile: "dynamic_project.qgs",
        timeout: 30000,
        retryAttempts: 3
    },

    // Disaster API Configuration
    api: {
        baseUrl: "http://localhost:5050/api",
        timeout: 15000
    },

    // OSRM Routing Configuration
    routing: {
        osrmUrl: 'http://localhost:5000',
        apiUrl: 'http://localhost:8082',
        timeout: 15000,
        cacheEnabled: true,
        cacheTTL: 300000, // 5 minutes
        profiles: {
            car: 'driving',
            ambulance: 'driving',
            fire_truck: 'driving',
            police: 'driving'
        },
        emergencyProfiles: {
            hospital: 'ambulance',
            fire_station: 'fire_truck',
            police_station: 'police'
        }
    },

    // Emergency facilities configuration
    facilities: {
        apiUrl: 'http://localhost:8082/facilities',
        maxDistance: 50000, // 50km
        maxResults: 10,
        types: {
            hospital: {
                icon: '🏥',
                color: '#ff4757',
                priority: 1
            },
            fire_station: {
                icon: '🚒',
                color: '#ff6b6b',
                priority: 1
            },
            police_station: {
                icon: '🚔',
                color: '#3742fa',
                priority: 1
            }
        }
    },

    // Map Configuration - Uttar Pradesh Focus
    map: {
        center: [26.8467, 80.9462], // Lucknow, UP
        zoom: 7,
        minZoom: 6,
        maxZoom: 18
        // CRS will be set to default EPSG:3857 (Web Mercator)
    },

    // Base Layer Configuration (Frontend Only)
    baseLayers: {
        default: {
            name: "CartoDB Dark",
            url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19
        },
        satellite: {
            name: "Satellite",
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 18
        },
        osm: {
            name: "OpenStreetMap",
            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }
    },

    // Dynamic Layer Definitions
    layers: {
        // Emergency Services
        agency_hospital: {
            name: "agency_hospital",
            displayName: "Hospitals",
            type: "wms",
            category: "emergency",
            style: "default",
            queryable: true,
            searchable: true,
            icon: "🏥"
        },
        agency_fire: {
            name: "agency_fire", 
            displayName: "Fire Stations",
            type: "wms",
            category: "emergency",
            style: "default",
            queryable: true,
            searchable: true,
            icon: "🚒"
        },
        agency_police: {
            name: "agency_police",
            displayName: "Police Stations", 
            type: "wms",
            category: "emergency",
            style: "default",
            queryable: true,
            searchable: true,
            icon: "🚔"
        },

        // Infrastructure
        highways: {
            name: "highways",
            displayName: "Major Highways",
            type: "wms", 
            category: "infrastructure",
            style: "default",
            queryable: true,
            searchable: false,
            icon: "🛣️",
            // Performance optimizations
            minZoom: 8,  // Only show at zoom level 8 and above
            maxFeatures: 10000,
            tileSize: 512,  // Larger tiles for better performance
            format: "image/png",
            transparent: true,
            cacheEnabled: true
        },
        // Administrative Boundaries
        north_india_boundary: {
            name: "north_india_boundary",
            displayName: "North India Boundary",
            type: "wms",
            category: "reference",
            style: "",
            queryable: true,
            searchable: false,
            icon: "📍"
        },

        // User-Generated Disaster Areas
        user_disaster_areas: {
            name: "user_disaster_areas",
            displayName: "User Disaster Areas",
            type: "wms",
            category: "disaster",
            style: "default",
            queryable: true,
            searchable: true,
            icon: "⚠️"
        },

        // Future Disaster Scenarios (Placeholder)
        flood_zones: {
            name: "flood_zones",
            displayName: "Flood Risk Areas",
            type: "wms",
            category: "disaster",
            style: "",
            queryable: true,
            searchable: false,
            icon: "🌊"
        },
        fire_risk: {
            name: "fire_risk",
            displayName: "Fire Risk Zones", 
            type: "wms",
            category: "disaster",
            style: "",
            queryable: true,
            searchable: false,
            icon: "🔥"
        },
        earthquake_zones: {
            name: "earthquake_zones",
            displayName: "Earthquake Zones",
            type: "wms",
            category: "disaster",
            style: "",
            queryable: true,
            searchable: false,
            icon: "🧭"
        },
        landslide_zones: {
            name: "landslide_zones",
            displayName: "Landslide Zones",
            type: "wms",
            category: "disaster",
            style: "",
            queryable: true,
            searchable: false,
            icon: "⛰️"
        }
    },

    // WMS Request Parameters
    wms: {
        version: "1.3.0",
        format: "image/png",
        transparent: true,
        crs: "EPSG:3857", // Match Leaflet map CRS for correct WMS tile BBOX
        styles: "",
        exceptions: "XML"
    },

    // Performance Settings
    performance: {
        tileSize: 256,
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 2,
        maxRequestsPerTile: 4
    },

    // UI Configuration
    ui: {
        showLoadingIndicator: true,
        showPerformanceStats: true,
        autoHideInfoPanel: 5000, // ms
        animationDuration: 300 // ms
    },

    // Debug Settings
    debug: {
        enabled: false,
        logWMSRequests: true,
        logPerformance: true,
        showBoundingBoxes: false
    },

    // Spatial Analysis Configuration
    analysis: {
        defaultBufferDistances: [1000, 5000, 10000], // meters
        maxAnalysisFeatures: 1000,
        analysisTimeout: 30000, // ms
        coordinatePrecision: 6, // decimal places
        enablePropertyTesting: true,
        propertyTestIterations: 100
    },

    // Route optimization configuration
    routeOptimization: {
        defaultRouteType: 'fastest',
        defaultVehicleType: 'car',
        maxWaypoints: 25,
        maxAlternatives: 3,
        routeColors: {
            fastest: '#00ff88',
            shortest: '#ff6b6b',
            emergency: '#ff4757',
            alternative: '#ffa500'
        },
        routeStyles: {
            weight: 4,
            opacity: 0.8,
            dashArray: {
                primary: null,
                alternative: '10, 5',
                emergency: '5, 10'
            }
        },
        emergencyResponse: {
            maxFacilities: 5,
            maxDistance: 50000,
            priorityWeighting: true,
            responseTimeThreshold: 15 // minutes
        }
    }
    ,
    // Real-time data configuration
    realtime: {
        enabled: true,
        refreshMs: 60000,
        endpoints: {
            weather: '',
            traffic: '',
            emergency: ''
        }
    },
    elevation: {
        apiUrl: ''
    }
};
