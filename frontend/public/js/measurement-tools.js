/**
 * Measurement Tools
 */
class MeasurementTools {
    constructor(map, config) {
        this.map = map;
        this.config = config;
        this.measureLayer = new L.FeatureGroup();
        this.map.addLayer(this.measureLayer);
        this.activeTool = null;
        this.initControls();
    }

    initControls() {
        const distBtn = document.getElementById('measure-distance');
        const areaBtn = document.getElementById('measure-area');
        const clearBtn = document.getElementById('clear-measurements');

        if (distBtn) {
            distBtn.addEventListener('click', () => this.activateDistance());
        }
        if (areaBtn) {
            areaBtn.addEventListener('click', () => this.activateArea());
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clear());
        }

        this.map.on(L.Draw.Event.CREATED, (e) => {
            if (!this.activeTool) return;
            const layer = e.layer;
            this.measureLayer.addLayer(layer);
            const geo = layer.toGeoJSON();
            if (this.activeTool === 'distance') {
                const lengthKm = turf.length(geo, { units: 'kilometers' });
                const lines = [`Distance: ${this.formatDistance(lengthKm)}`];
                this.showResult(lines);
                this.computeRoadDistance(geo, lines);
                this.computeElevationProfile(geo, lines);
            }
            if (this.activeTool === 'area') {
                const areaKm2 = turf.area(geo) / 1000000;
                const lines = [`Area: ${this.formatArea(areaKm2)}`];
                this.showResult(lines);
                this.computePopulationEstimate(geo, lines);
            }
            this.deactivate();
        });
    }

    getUnits() {
        return document.getElementById('measurement-units')?.value || 'metric';
    }

    formatDistance(km) {
        if (this.getUnits() === 'imperial') {
            const mi = km * 0.621371;
            return `${mi.toFixed(2)} mi`;
        }
        return `${km.toFixed(2)} km`;
    }

    formatArea(km2) {
        if (this.getUnits() === 'imperial') {
            const mi2 = km2 * 0.386102;
            return `${mi2.toFixed(2)} mi^2`;
        }
        return `${km2.toFixed(2)} km^2`;
    }

    activateDistance() {
        this.deactivate();
        this.activeTool = 'distance';
        this.handler = new L.Draw.Polyline(this.map, { shapeOptions: { color: '#00ff88' } });
        this.handler.enable();
        this.showResult('Click to draw a line for distance measurement.');
    }

    activateArea() {
        this.deactivate();
        this.activeTool = 'area';
        this.handler = new L.Draw.Polygon(this.map, { shapeOptions: { color: '#ffa502' } });
        this.handler.enable();
        this.showResult('Click to draw a polygon for area measurement.');
    }

    deactivate() {
        if (this.handler) {
            this.handler.disable();
            this.handler = null;
        }
        this.activeTool = null;
    }

    clear() {
        this.measureLayer.clearLayers();
        this.showResult('Measurements cleared.');
    }

    showResult(text) {
        const el = document.getElementById('measurement-results');
        if (el) {
            if (Array.isArray(text)) {
                el.innerHTML = text.map((line) => `<div>${line}</div>`).join('');
            } else {
                el.textContent = text;
            }
        }
    }

    async computeRoadDistance(geo, lines) {
        try {
            const coords = geo.geometry?.coordinates;
            if (!coords || coords.length < 2) return;
            const start = coords[0];
            const end = coords[coords.length - 1];
            if (!window.routeOptimizationEngine) return;
            const route = await window.routeOptimizationEngine.calculateOptimalRoute(start, end, { routeType: 'fastest' });
            if (route?.distance) {
                lines.push(`Road distance: ${this.formatDistance(route.distance / 1000)}`);
                lines.push(`Estimated travel time: ${Math.round(route.duration / 60)} min`);
                this.showResult(lines);
            }
        } catch (e) {
            // Ignore road distance failures
        }
    }

    async computeElevationProfile(geo, lines) {
        try {
            const apiUrl = this.config.elevation?.apiUrl;
            if (!apiUrl) return;
            const coords = geo.geometry?.coordinates;
            if (!coords || coords.length < 2) return;
            const step = Math.max(1, Math.floor(coords.length / 50));
            const sampled = coords.filter((_, i) => i % step === 0);
            const locations = sampled.map((c) => `${c[1]},${c[0]}`).join('|');
            const url = apiUrl.replace('{locations}', encodeURIComponent(locations));
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            const elevations = (data.results || []).map((r) => r.elevation).filter((v) => typeof v === 'number');
            if (!elevations.length) return;
            const min = Math.min(...elevations);
            const max = Math.max(...elevations);
            lines.push(`Elevation: ${Math.round(min)} m - ${Math.round(max)} m`);
            this.showResult(lines);
        } catch (e) {
            // Ignore elevation failures
        }
    }

    computePopulationEstimate(geo, lines) {
        try {
            const populationFeatures = window.dataLayerManager?.getLayerFeatures('population_density') || [];
            if (!populationFeatures.length || !window.spatialAnalysisEngine) return;
            const stats = window.spatialAnalysisEngine.calculateAffectedPopulation(geo, populationFeatures);
            if (stats?.totalPopulation !== undefined) {
                lines.push(`Estimated population: ${stats.totalPopulation}`);
                this.showResult(lines);
            }
        } catch (e) {
            // Ignore population estimate failures
        }
    }
}
