/**
 * Modern Analytics Page JavaScript
 * Uses real backend + V2 intelligence data.
 */

let facilityChart = null;
let disasterChart = null;

document.addEventListener('DOMContentLoaded', function () {
    initCharts();
    loadAnalytics();
});

function initCharts() {
    const facilityCtx = document.getElementById('facilityChart');
    facilityChart = new Chart(facilityCtx, {
        type: 'doughnut',
        data: {
            labels: ['Hospitals', 'Fire Stations', 'Police Stations'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(255, 92, 100, 0.8)',
                    'rgba(244, 183, 64, 0.8)',
                    'rgba(79, 124, 255, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: {
                            size: 14,
                            family: 'Manrope'
                        }
                    }
                }
            }
        }
    });

    const disasterCtx = document.getElementById('disasterChart');
    disasterChart = new Chart(disasterCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Reported Disasters',
                data: [],
                backgroundColor: [
                    'rgba(79, 124, 255, 0.8)',
                    'rgba(71, 85, 105, 0.8)',
                    'rgba(255, 138, 107, 0.8)',
                    'rgba(122, 74, 54, 0.8)',
                    'rgba(37, 194, 166, 0.8)',
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(234, 179, 8, 0.8)'
                ],
                borderWidth: 0,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return response.json();
}

function getDisasterLatLon(disaster) {
    const ring = disaster?.geometry?.coordinates?.[0];
    const point = Array.isArray(ring) && ring.length > 0 ? ring[0] : null;
    if (Array.isArray(point) && point.length >= 2) {
        return { lat: Number(point[1]), lon: Number(point[0]) };
    }
    if (Number.isFinite(disaster?.latitude) && Number.isFinite(disaster?.longitude)) {
        return { lat: Number(disaster.latitude), lon: Number(disaster.longitude) };
    }
    return null;
}

function toTitleCase(value) {
    const text = String(value || '').trim().replace(/_/g, ' ');
    if (!text) return 'Unknown';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function updateDisasterChart(disasters) {
    if (!disasterChart) return;

    const typeCounts = {};
    disasters.forEach((d) => {
        const type = toTitleCase(d.disaster_type || d.type);
        typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const labels = Object.keys(typeCounts);
    const values = labels.map((label) => typeCounts[label]);

    disasterChart.data.labels = labels.length ? labels : ['No Data'];
    disasterChart.data.datasets[0].data = values.length ? values : [0];
    disasterChart.update();
}

async function loadLiveIntelligence(lat, lon, radius = 10) {
    const base = `${AppConfig.backendApiUrl}/v2`;
    const [population, seismic, elevation, floodRisk] = await Promise.all([
        fetchJson(`${base}/population?lat=${lat}&lon=${lon}&radius=${radius}`).catch(() => ({})),
        fetchJson(`${base}/seismic-risk?lat=${lat}&lon=${lon}&radius=${Math.max(20, radius * 4)}`).catch(() => ({})),
        fetchJson(`${base}/elevation?lat=${lat}&lon=${lon}`).catch(() => ({})),
        fetchJson(`${base}/flood-risk?lat=${lat}&lon=${lon}&radius=${Math.max(10, radius * 2)}&elevation_threshold_m=50`).catch(() => ({}))
    ]);

    document.getElementById('pop-live').textContent = population?.success
        ? Number(population.population || 0).toLocaleString()
        : 'Unavailable';
    document.getElementById('pop-accuracy-live').textContent = population?.accuracy || 'N/A';

    document.getElementById('seismic-live').textContent = seismic?.success
        ? (seismic.risk?.risk_level || 'UNKNOWN')
        : 'Unavailable';
    document.getElementById('seismic-count-live').textContent = seismic?.success
        ? Number(seismic.risk?.total_earthquakes || 0).toLocaleString()
        : '0';

    document.getElementById('elevation-live').textContent =
        elevation?.success && elevation?.elevation_m != null
            ? `${Number(elevation.elevation_m).toFixed(1)} m`
            : 'Unavailable';

    document.getElementById('flood-zones-live').textContent = floodRisk?.success
        ? Number(floodRisk.count || 0).toLocaleString()
        : '0';
    document.getElementById('flood-high-live').textContent = floodRisk?.success
        ? Number(floodRisk.high_risk_count || 0).toLocaleString()
        : '0';

    document.getElementById('intelligence-location').textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    document.getElementById('intelligence-updated').textContent = new Date().toLocaleString();
}

async function loadAnalytics() {
    try {
        const [statusRes, disastersRes] = await Promise.all([
            fetchJson(`${AppConfig.apiUrl}/status`).catch(() => ({})),
            fetchJson(`${AppConfig.backendApiUrl}/disasters`).catch(() => ({}))
        ]);

        const disasters = Array.isArray(disastersRes?.disasters) ? disastersRes.disasters : [];

        document.getElementById('total-disasters').textContent =
            disasters.length || ((statusRes.historical_disasters || 0) + (statusRes.active_disasters || 0));
        document.getElementById('total-facilities').textContent = statusRes.total_facilities || 0;
        document.getElementById('districts-covered').textContent = statusRes.districts_covered || 0;

        document.getElementById('hospitals-count').textContent = statusRes.hospitals || 0;
        document.getElementById('fire-stations-count').textContent = statusRes.fire_stations || 0;
        document.getElementById('police-stations-count').textContent = statusRes.police_stations || 0;
        document.getElementById('operational-facilities').textContent = statusRes.operational_facilities || 0;

        if (facilityChart) {
            facilityChart.data.datasets[0].data = [
                statusRes.hospitals || 0,
                statusRes.fire_stations || 0,
                statusRes.police_stations || 0
            ];
            facilityChart.update();
        }

        updateDisasterChart(disasters);

        // Choose latest persisted disaster for live intelligence; fallback to map center.
        const latest = disasters
            .slice()
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
        const location = getDisasterLatLon(latest) || {
            lat: Number(AppConfig.mapCenter?.[0] || 26.8467),
            lon: Number(AppConfig.mapCenter?.[1] || 80.9462)
        };

        await loadLiveIntelligence(location.lat, location.lon, 10);

        showToast('Analytics updated with live data', 'success');
    } catch (error) {
        console.error('Error loading analytics:', error);
        showToast('Failed to load analytics', 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function toggleTheme() {
    showToast('Dark mode coming soon!', 'info');
}
