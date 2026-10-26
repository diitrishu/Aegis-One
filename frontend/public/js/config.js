const AppConfig = {
    // API endpoint for our disaster response system
    apiUrl: "http://localhost:5000/api",
    // Direct backend API (GeoPackage + V2 enhanced endpoints)
    backendApiUrl: "http://localhost:5000/api",

    // QGIS Server WMS endpoint (for Docker mode)
    wmsUrl: "http://localhost:8081/ows/",

    // Optional V2 API candidates used by report generator.
    // Keep localhost:5001 disabled by default to avoid connection-refused errors
    // when enhanced_data_api is not running.
    v2ApiCandidates: [
        "http://localhost:5000/api/v2"
    ],

    // Map Defaults - Uttar Pradesh, India
    mapCenter: [26.8467, 80.9462], // Lucknow, UP center
    zoomLevel: 7,

    // Base Tile Layer (OpenStreetMap)
    baseLayerUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    baseLayerAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',

    // Facility types
    facilityTypes: {
        hospital: {
            name: 'Hospitals',
            icon: 'H',
            color: '#dc3545',
            markerColor: 'red'
        },
        fire_station: {
            name: 'Fire Stations',
            icon: 'F',
            color: '#fd7e14',
            markerColor: 'orange'
        },
        police_station: {
            name: 'Police Stations',
            icon: 'P',
            color: '#007bff',
            markerColor: 'blue'
        }
    },

    // Disaster types
    disasterTypes: {
        flood: { name: 'Flood', icon: 'F', color: '#0dcaf0' },
        fire: { name: 'Fire', icon: 'R', color: '#fd7e14' },
        earthquake: { name: 'Earthquake', icon: 'E', color: '#6c757d' },
        landslide: { name: 'Landslide', icon: 'L', color: '#795548' },
        cyclone: { name: 'Cyclone', icon: 'C', color: '#6610f2' },
        drought: { name: 'Drought', icon: 'D', color: '#eab308' },
        industrial_accident: { name: 'Industrial Accident', icon: 'I', color: '#64748b' }
    }
};
