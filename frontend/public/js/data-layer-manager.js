/**
 * Data Layer Manager
 * Loads and manages non-WMS data layers (population, damage, uploads)
 */

class DataLayerManager {
    constructor(map, config) {
        this.map = map;
        this.config = config;
        this.geoJsonLayers = new Map();
        this.wmsLayers = new Map();
        this.layerMetadata = new Map();
        this.activeLayerOrder = [];
        this.heatLayer = null;
    }

    async loadPopulationLayer() {
        const bounds = this.map.getBounds();
        const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
        const url = `${this.config.api.baseUrl}/population?bbox=${bbox}&limit=5000`;
        const data = await this.fetchJson(url);
        this.addGeoJsonLayer('population_density', data, {
            style: () => ({ color: '#ffa502', weight: 1, fillOpacity: 0.2 }),
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 4, color: '#ffa502' })
        }, {
            displayName: 'Population Density',
            source: 'GeoPackage',
            type: 'population'
        });

        this.renderPopulationHeatmap(data);
        return data;
    }

    async loadDamageLayer() {
        const url = `${this.config.api.baseUrl}/damage`;
        const data = await this.fetchJson(url);
        this.addGeoJsonLayer('damage_assessment', data, {
            style: (feature) => {
                const level = feature.properties?.damage_level || 'none';
                const colors = {
                    none: '#2ed573',
                    light: '#ffa502',
                    moderate: '#ff6348',
                    severe: '#ff4757',
                    destroyed: '#1e272e'
                };
                return {
                    color: colors[level] || '#ffa502',
                    weight: 2,
                    fillOpacity: 0.3
                };
            }
        }, {
            displayName: 'Damage Assessment',
            source: 'GeoPackage',
            type: 'damage'
        });
        return data;
    }

    async uploadGeoJsonLayer(file, layerName, metadata = {}) {
        const text = await file.text();
        const data = JSON.parse(text);
        this.addGeoJsonLayer(layerName, data, {
            style: () => ({ color: '#7bed9f', weight: 2, fillOpacity: 0.2 })
        }, {
            displayName: metadata.displayName || layerName,
            source: file.name,
            type: metadata.type || 'custom'
        });
        return data;
    }


    async loadGeoJsonFromUrl(url, layerName) {
        const data = await this.fetchJson(url);
        this.addGeoJsonLayer(layerName, data, { style: () => ({ color: '#7bed9f', weight: 2, fillOpacity: 0.2 }) }, { displayName: layerName, source: url, type: 'geojson' });
        return data;
    }

    async loadWfsLayer(url, layerName) {
        let requestUrl = url;
        if (!/service=wfs/i.test(url)) {
            const sep = url.includes('?') ? '&' : '?';
            requestUrl = `${url}${sep}service=WFS&request=GetFeature&typeName=${encodeURIComponent(layerName)}&outputFormat=application/json`;
        }
        const data = await this.fetchJson(requestUrl);
        this.addGeoJsonLayer(layerName, data, { style: () => ({ color: '#1e90ff', weight: 2, fillOpacity: 0.2 }) }, { displayName: layerName, source: url, type: 'wfs' });
        return data;
    }

    addWmsLayer(layerName, url) {
        if (this.wmsLayers.has(layerName)) {
            this.map.removeLayer(this.wmsLayers.get(layerName));
        }
        const layer = L.tileLayer.wms(url, {
            layers: layerName,
            format: 'image/png',
            transparent: true
        });
        layer.addTo(this.map);
        this.wmsLayers.set(layerName, layer);
        this.layerMetadata.set(layerName, { displayName: layerName, source: url, type: 'wms' });
    }

    removeWmsLayer(layerName) {
        if (this.wmsLayers.has(layerName)) {
            this.map.removeLayer(this.wmsLayers.get(layerName));
            this.wmsLayers.delete(layerName);
        }
    }


    validateGeoJson(data) {
        const warnings = [];
        if (!data || data.type !== 'FeatureCollection') {
            warnings.push('Invalid GeoJSON FeatureCollection');
        }
        if (!data.crs) {
            warnings.push('No CRS defined; assuming EPSG:4326');
        }
        const invalid = (data.features || []).some(f => !f.geometry);
        if (invalid) warnings.push('Some features missing geometry');
        return warnings;
    }

    addGeoJsonLayer(layerName, data, options = {}, metadata = {}) {
        if (this.geoJsonLayers.has(layerName)) {
            this.map.removeLayer(this.geoJsonLayers.get(layerName));
            this.geoJsonLayers.delete(layerName);
        }

        const warnings = this.validateGeoJson(data);
        if (warnings.length > 0) {
            console.warn('Layer warnings:', warnings);
        }
        const layer = L.geoJSON(data, options);
        layer.addTo(this.map);
        this.geoJsonLayers.set(layerName, layer);
        this.layerMetadata.set(layerName, {
            ...metadata,
            featureCount: data.features?.length || 0,
            updatedAt: new Date().toISOString()
        });
        this.activeLayerOrder.push(layerName);
    }

    removeLayer(layerName) {
        if (this.geoJsonLayers.has(layerName)) {
            this.map.removeLayer(this.geoJsonLayers.get(layerName));
            this.geoJsonLayers.delete(layerName);
        }
        this.layerMetadata.delete(layerName);
        this.activeLayerOrder = this.activeLayerOrder.filter(n => n !== layerName);
        if (layerName === 'population_density' && this.heatLayer) {
            this.map.removeLayer(this.heatLayer);
            this.heatLayer = null;
        }
    }

    getLayerFeatures(layerName) {
        const layer = this.geoJsonLayers.get(layerName);
        if (!layer) return [];
        const features = [];
        layer.eachLayer((l) => {
            if (l.feature) {
                features.push(l.feature);
            }
        });
        return features;
    }

    renderPopulationHeatmap(data) {
        if (!data || !data.features || typeof L.heatLayer === 'undefined') {
            return;
        }
        if (this.heatLayer) {
            this.map.removeLayer(this.heatLayer);
        }
        const heatPoints = data.features.map((f) => {
            const geom = f.geometry;
            if (!geom) return null;
            let latlng;
            if (geom.type === 'Point') {
                latlng = [geom.coordinates[1], geom.coordinates[0]];
            } else {
                const centroid = turf.centroid(f);
                latlng = [centroid.geometry.coordinates[1], centroid.geometry.coordinates[0]];
            }
            const pop = f.properties?.population_density || f.properties?.population || 1;
            return [...latlng, Math.min(1, pop / 1000)];
        }).filter(Boolean);

        this.heatLayer = L.heatLayer(heatPoints, { radius: 25, blur: 18, maxZoom: 10 });
        this.heatLayer.addTo(this.map);
    }

    getLayerMetadata(layerName) {
        return this.layerMetadata.get(layerName) || null;
    }

    getLayerNames() {
        return [
            ...this.geoJsonLayers.keys(),
            ...this.wmsLayers.keys()
        ];
    }

    reorderLayer(layerName, direction = 'front') {
        const layer = this.geoJsonLayers.get(layerName) || this.wmsLayers.get(layerName);
        if (!layer) return;
        if (direction === 'front' && layer.bringToFront) {
            layer.bringToFront();
        }
        if (direction === 'back' && layer.bringToBack) {
            layer.bringToBack();
        }
    }

    async fetchJson(url, options = {}) {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }
        return response.json();
    }
}
