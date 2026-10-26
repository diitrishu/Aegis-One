/**
 * Coordinate Tools
 */
class CoordinateTools {
    constructor(map, config) {
        this.map = map;
        this.config = config;
        this.marker = null;
        this.init();
    }

    init() {
        document.getElementById('coord-plot')?.addEventListener('click', () => this.plot());
        this.map.on('click', (e) => this.updateDisplay([e.latlng.lng, e.latlng.lat]));
    }

    plot() {
        const input = document.getElementById('coord-input');
        if (!input) return;
        const value = input.value.trim();
        const coords = this.parseInput(value);
        if (!coords) {
            alert('Invalid coordinate input');
            return;
        }
        this.addMarker(coords);
        this.map.setView([coords[1], coords[0]], Math.max(this.map.getZoom(), 12));
        this.updateDisplay(coords);
    }

    parseInput(value) {
        if (!value) return null;
        // Try MGRS
        if (/[A-Za-z]/.test(value)) {
            try {
                const pt = mgrs.toPoint(value);
                return [pt[0], pt[1]];
            } catch (e) {}
        }
        // Try lat,lng
        const parts = value.split(',').map(p => parseFloat(p.trim())).filter(v => !isNaN(v));
        if (parts.length === 2) {
            const [a, b] = parts;
            if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
                return [b, a];
            }
            if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
                return [a, b];
            }
        }
        // Try UTM format: "zoneN easting northing"
        const utm = value.match(/(\d{1,2})([NS])\s+(\d+\.?\d*)\s+(\d+\.?\d*)/i);
        if (utm && typeof proj4 !== 'undefined') {
            const zone = parseInt(utm[1], 10);
            const hemi = utm[2].toUpperCase();
            const easting = parseFloat(utm[3]);
            const northing = parseFloat(utm[4]);
            const proj = `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs${hemi === 'S' ? ' +south' : ''}`;
            const [lon, lat] = proj4(proj, 'WGS84', [easting, northing]);
            return [lon, lat];
        }
        return null;
    }

    addMarker(coords) {
        if (this.marker) {
            this.map.removeLayer(this.marker);
        }
        this.marker = L.marker([coords[1], coords[0]]).addTo(this.map);
    }

    updateDisplay(coords) {
        const el = document.getElementById('coord-display');
        if (!el || !coords) return;
        const [lng, lat] = coords;
        const mgrsVal = typeof mgrs !== 'undefined' ? mgrs.forward([lng, lat]) : 'N/A';
        el.innerHTML = `Lat/Lon: ${lat.toFixed(5)}, ${lng.toFixed(5)}<br>MGRS: ${mgrsVal}`;
    }
}
