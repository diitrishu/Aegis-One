/**
 * Risk Zone Layers for Disaster Response Map
 * Displays earthquake, flood, landslide, and fire risk zones
 */

class RiskLayerManager {
    constructor(map) {
        this.map = map;
        this.layers = {};
        this.loaded = {};
        this.visible = {};
        
        // Risk zone configurations
        this.riskZones = {
            earthquake: {
                name: 'Earthquake Risk',
                url: 'data/risk_zones/earthquake_zones.geojson',
                color: '#ff6b6b',
                fillColor: '#ff6b6b',
                fillOpacity: 0.25,
                weight: 2,
                icon: '🏚️'
            },
            flood: {
                name: 'Flood Risk',
                url: 'data/risk_zones/flood_zones.geojson',
                color: '#4dabf7',
                fillColor: '#4dabf7',
                fillOpacity: 0.25,
                weight: 2,
                icon: '🌊'
            },
            landslide: {
                name: 'Landslide Risk',
                url: 'data/risk_zones/landslide_zones.geojson',
                color: '#fab005',
                fillColor: '#fab005',
                fillOpacity: 0.25,
                weight: 2,
                icon: '⛰️'
            },
            fire: {
                name: 'Fire Risk',
                url: 'data/risk_zones/fire_risk_zones.geojson',
                color: '#ff8787',
                fillColor: '#ff8787',
                fillOpacity: 0.25,
                weight: 2,
                icon: '🔥'
            }
        };
    }

    async loadLayer(type) {
        if (this.loaded[type]) {
            return this.layers[type];
        }

        const config = this.riskZones[type];
        if (!config) {
            console.error(`Unknown risk zone type: ${type}`);
            return null;
        }

        try {
            console.log(`Loading ${config.name} zones...`);
            
            const response = await fetch(config.url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            const layer = L.geoJSON(data, {
                style: (feature) => ({
                    color: config.color,
                    fillColor: config.fillColor,
                    fillOpacity: config.fillOpacity,
                    weight: config.weight,
                    opacity: 0.8
                }),
                onEachFeature: (feature, layer) => {
                    let popupContent = `<div class="risk-popup">
                        <h4>${config.icon} ${config.name}</h4>`;
                    
                    if (feature.properties) {
                        for (const [key, value] of Object.entries(feature.properties)) {
                            if (value && key !== 'geometry') {
                                popupContent += `<p><strong>${key}:</strong> ${value}</p>`;
                            }
                        }
                    }
                    
                    popupContent += `</div>`;
                    layer.bindPopup(popupContent);
                    
                    layer.on('mouseover', function() {
                        this.setStyle({
                            fillOpacity: 0.5,
                            weight: 3
                        });
                    });
                    
                    layer.on('mouseout', function() {
                        this.setStyle({
                            fillOpacity: config.fillOpacity,
                            weight: config.weight
                        });
                    });
                }
            });
            
            this.layers[type] = layer;
            this.loaded[type] = true;
            this.visible[type] = false;
            
            console.log(`✅ Loaded ${config.name}: ${data.features.length} zones`);
            return layer;
            
        } catch (error) {
            console.error(`Error loading ${config.name}:`, error);
            return null;
        }
    }

    async toggleLayer(type) {
        if (!this.loaded[type]) {
            await this.loadLayer(type);
        }

        const layer = this.layers[type];
        if (!layer) return;

        if (this.visible[type]) {
            this.map.removeLayer(layer);
            this.visible[type] = false;
        } else {
            this.map.addLayer(layer);
            this.visible[type] = true;
        }

        return this.visible[type];
    }

    async showLayer(type) {
        if (!this.loaded[type]) {
            await this.loadLayer(type);
        }

        const layer = this.layers[type];
        if (layer && !this.visible[type]) {
            this.map.addLayer(layer);
            this.visible[type] = true;
        }
    }

    hideLayer(type) {
        const layer = this.layers[type];
        if (layer && this.visible[type]) {
            this.map.removeLayer(layer);
            this.visible[type] = false;
        }
    }

    isVisible(type) {
        return this.visible[type] || false;
    }

    getAvailableTypes() {
        return Object.keys(this.riskZones);
    }

    getConfig(type) {
        return this.riskZones[type];
    }

    async loadAll() {
        const types = this.getAvailableTypes();
        const promises = types.map(type => this.loadLayer(type));
        await Promise.all(promises);
        console.log('✅ All risk zones loaded');
    }

    hideAll() {
        const types = this.getAvailableTypes();
        types.forEach(type => this.hideLayer(type));
    }

    async showAll() {
        const types = this.getAvailableTypes();
        for (const type of types) {
            await this.showLayer(type);
        }
    }
}
