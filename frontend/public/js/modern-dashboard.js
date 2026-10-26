/**
 * Modern Dashboard JavaScript
 */

let facilityChart = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadSystemStatus();
    initFacilityChart();
});

// Load system status
async function loadSystemStatus() {
    try {
        const response = await fetch(`${AppConfig.apiUrl}/status`);
        const data = await response.json();
        
        // Update hero stats
        document.getElementById('system-status-text').textContent = 
            data.system_ready ? 'Operational' : 'Offline';
        document.getElementById('active-disasters').textContent = 
            data.active_disasters || 0;
        document.getElementById('total-facilities').textContent = 
            data.total_facilities || 0;
        document.getElementById('districts-covered').textContent = 
            data.districts_covered || 0;
        
        // Update info list
        document.getElementById('hospitals-count').textContent = 
            data.hospitals || 0;
        document.getElementById('fire-stations-count').textContent = 
            data.fire_stations || 0;
        document.getElementById('police-stations-count').textContent = 
            data.police_stations || 0;
        document.getElementById('historical-disasters').textContent = 
            data.historical_disasters || 0;
        document.getElementById('operational-facilities').textContent = 
            data.operational_facilities || 0;
        
        // Update last updated time
        const lastUpdated = new Date(data.last_updated);
        document.getElementById('last-updated').textContent = 
            lastUpdated.toLocaleTimeString();
        
        // Update chart
        updateFacilityChart(data);
        
        showToast('System status updated', 'success');
    } catch (error) {
        console.error('Error loading system status:', error);
        showToast('Failed to load system status', 'error');
    }
}

// Initialize facility chart
function initFacilityChart() {
    const ctx = document.getElementById('facilityChart');
    if (!ctx) return;
    
    facilityChart = new Chart(ctx, {
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
}

// Update facility chart
function updateFacilityChart(data) {
    if (!facilityChart) return;
    
    facilityChart.data.datasets[0].data = [
        data.hospitals || 0,
        data.fire_stations || 0,
        data.police_stations || 0
    ];
    facilityChart.update();
}

// Test location
function testLocation(lat, lon, name) {
    localStorage.setItem('testLocation', JSON.stringify({ lat, lon, name }));
    showToast(`Selected ${name} (${lat}, ${lon})`, 'info');
    setTimeout(() => {
        window.location.href = 'disasters.html';
    }, 1000);
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Toggle theme (placeholder for future dark mode)
function toggleTheme() {
    showToast('Dark mode coming soon!', 'info');
}
