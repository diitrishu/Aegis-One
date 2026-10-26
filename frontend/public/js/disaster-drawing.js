/**
 * Disaster Drawing System
 * Professional Web GIS drawing interface for user-submitted disaster areas
 */

class DisasterDrawingManager {
    constructor(map, config) {
        this.map = map;
        this.config = config;
        this.drawingLayer = null;
        this.drawControl = null;
        this.isDrawingMode = false;
        this.currentMode = 'disaster';
        
        this.initializeDrawingTools();
        this.initializeEventListeners();
    }

    /**
     * Initialize Leaflet.Draw tools
     */
    initializeDrawingTools() {
        // Check if Leaflet.Draw is available
        if (typeof L === 'undefined' || typeof L.Control === 'undefined' || typeof L.Control.Draw === 'undefined') {
            console.error('❌ Leaflet.Draw is not loaded. Drawing functionality will be disabled.');
            this.showMessage('Drawing tools not available. Please refresh the page.', 'error');
            this.hideDrawingUI();
            return;
        }

        try {
            // Create feature group for drawn items
            this.drawingLayer = new L.FeatureGroup();
            this.map.addLayer(this.drawingLayer);

            // Configure drawing options
            const drawOptions = {
                position: 'topright',
                draw: {
                    polygon: {
                        allowIntersection: false,
                        drawError: {
                            color: '#e1e100',
                            message: '<strong>Error:</strong> Shape edges cannot cross!'
                        },
                        shapeOptions: {
                            color: '#ff0000',
                            weight: 2,
                            opacity: 0.8,
                            fillOpacity: 0.3
                        }
                    },
                    rectangle: {
                        shapeOptions: {
                            color: '#ff0000',
                            weight: 2,
                            opacity: 0.8,
                            fillOpacity: 0.3
                        }
                    },
                    circle: {
                        shapeOptions: {
                            color: '#ff0000',
                            weight: 2,
                            opacity: 0.8,
                            fillOpacity: 0.3
                        }
                    },
                    marker: {
                        icon: new L.Icon({
                            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                            shadowSize: [41, 41]
                        })
                    },
                    polyline: false, // Disable polyline for disaster areas
                    circlemarker: false // Disable circle marker
                },
                edit: {
                    featureGroup: this.drawingLayer,
                    remove: true
                }
            };

            // Add draw control to map
            this.drawControl = new L.Control.Draw(drawOptions);
            this.map.addControl(this.drawControl);

            // Initially hide the drawing control
            this.toggleDrawingMode(false);
            
            console.log('✅ Drawing tools initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize drawing tools:', error);
            this.showMessage('Failed to initialize drawing tools. Please refresh the page.', 'error');
            this.hideDrawingUI();
        }
    }

    /**
     * Initialize event listeners for drawing
     */
    initializeEventListeners() {
        // Drawing created event
        this.map.on(L.Draw.Event.CREATED, (e) => {
            this.handleDrawingCreated(e);
        });

        // Drawing edited event
        this.map.on(L.Draw.Event.EDITED, (e) => {
            this.handleDrawingEdited(e);
        });

        // Drawing deleted event
        this.map.on(L.Draw.Event.DELETED, (e) => {
            this.handleDrawingDeleted(e);
        });

        // Toggle drawing mode button
        const drawingToggle = document.getElementById('toggle-drawing');
        if (drawingToggle) {
            if (typeof L === 'undefined' || typeof L.Control === 'undefined' || typeof L.Control.Draw === 'undefined') {
                // Hide drawing button if Leaflet.Draw is not available
                this.hideDrawingUI();
            } else {
                drawingToggle.addEventListener('click', () => {
                    this.setMode('disaster');
                    this.toggleDrawingMode();
                });
            }
        }

        // Damage assessment toggle
        const damageToggle = document.getElementById('toggle-damage');
        if (damageToggle) {
            damageToggle.addEventListener('click', () => {
                this.setMode('damage');
                this.toggleDrawingMode();
            });
        }

        // Submit disaster form
        const submitForm = document.getElementById('disaster-form');
        if (submitForm) {
            submitForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitDisasterArea();
            });
        }

        // Submit damage form
        const damageForm = document.getElementById('damage-form');
        if (damageForm) {
            damageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitDamageAssessment();
            });
        }

        // Cancel drawing
        const cancelDrawing = document.getElementById('cancel-drawing');
        if (cancelDrawing) {
            cancelDrawing.addEventListener('click', () => {
                this.cancelDrawing();
            });
        }

        const cancelDamage = document.getElementById('cancel-damage');
        if (cancelDamage) {
            cancelDamage.addEventListener('click', () => {
                this.cancelDamage();
            });
        }
    }

    /**
     * Handle new drawing created
     */
    handleDrawingCreated(e) {
        const layer = e.layer;
        const type = e.layerType;

        // Add to drawing layer
        this.drawingLayer.addLayer(layer);

        // Store geometry data
        layer.disasterData = {
            type: type,
            geometry: layer.toGeoJSON().geometry,
            created: new Date().toISOString()
        };

        // Show relevant form based on mode
        if (this.currentMode === 'damage') {
            this.showDamageForm(layer);
        } else {
            this.showDisasterForm(layer);
        }

        console.log('Drawing created:', type, layer.disasterData);
    }

    /**
     * Handle drawing edited
     */
    handleDrawingEdited(e) {
        const layers = e.layers;
        layers.eachLayer((layer) => {
            if (layer.disasterData) {
                // Update geometry
                layer.disasterData.geometry = layer.toGeoJSON().geometry;
                layer.disasterData.modified = new Date().toISOString();
                console.log('Drawing edited:', layer.disasterData);
            }
        });
    }

    /**
     * Handle drawing deleted
     */
    handleDrawingDeleted(e) {
        const layers = e.layers;
        layers.eachLayer((layer) => {
            if (layer.disasterData) {
                console.log('Drawing deleted:', layer.disasterData);
            }
        });
    }

    /**
     * Toggle drawing mode on/off
     */
    toggleDrawingMode(enable = null) {
        if (enable === null) {
            this.isDrawingMode = !this.isDrawingMode;
        } else {
            this.isDrawingMode = enable;
        }

        const drawingPanel = document.getElementById('drawing-panel');
        const drawingToggle = document.getElementById('toggle-drawing');
        const drawControl = document.querySelector('.leaflet-draw');

        if (this.isDrawingMode) {
            // Enable drawing mode
            if (drawingPanel) drawingPanel.classList.add('active');
            if (drawingToggle) {
                drawingToggle.textContent = '🚫 Exit Drawing';
                drawingToggle.classList.add('active');
            }
            if (drawControl) drawControl.style.display = 'block';
            
            this.showDrawingInstructions();
        } else {
            // Disable drawing mode
            if (drawingPanel) drawingPanel.classList.remove('active');
            if (drawingToggle) {
                drawingToggle.textContent = '✏️ Draw Disaster Area';
                drawingToggle.classList.remove('active');
            }
            if (drawControl) drawControl.style.display = 'none';
            
            this.hideDisasterForm();
            this.clearDrawings();
        }
    }

    /**
     * Show disaster form for geometry input
     */
    showDisasterForm(layer) {
        const form = document.getElementById('disaster-form');
        const formPanel = document.getElementById('disaster-form-panel');
        
        if (form && formPanel) {
            // Store reference to the layer
            form.currentLayer = layer;
            
            // Show form panel
            formPanel.classList.add('show');
            
            // Focus on disaster type
            const disasterType = document.getElementById('disaster-type');
            if (disasterType) disasterType.focus();
        }
    }

    /**
     * Hide disaster form
     */
    hideDisasterForm() {
        const formPanel = document.getElementById('disaster-form-panel');
        if (formPanel) {
            formPanel.classList.remove('show');
        }
        
        // Reset form
        const form = document.getElementById('disaster-form');
        if (form) {
            form.reset();
            form.currentLayer = null;
        }
    }

    /**
     * Submit disaster area to backend
     */
    async submitDisasterArea() {
        const form = document.getElementById('disaster-form');
        if (!form || !form.currentLayer) {
            this.showMessage('No drawing selected', 'error');
            return;
        }

        try {
            this.showLoadingIndicator(true);

            // Collect form data
            const formData = new FormData(form);
            const disasterData = {
                disaster_type: formData.get('disaster_type'),
                severity: formData.get('severity'),
                description: formData.get('description') || '',
                geometry: form.currentLayer.disasterData.geometry,
                created_by: 'web_user'
            };

            // Validate required fields
            if (!disasterData.disaster_type || !disasterData.severity) {
                this.showMessage('Please fill in all required fields', 'error');
                return;
            }

            // Submit to backend API
            const response = await fetch(`${this.config.api.baseUrl}/disasters`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(disasterData)
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(`✅ Disaster area saved successfully (ID: ${result.disaster_id})`, 'success');
                
                // Clear the drawing
                this.drawingLayer.removeLayer(form.currentLayer);
                this.hideDisasterForm();
                
                // Reload disaster layer in main map
                await this.reloadDisasterLayer();
                await this.analyzeEmergencyServicesNearDisaster(disasterData.geometry);
                
            } else {
                this.showMessage(`❌ Error: ${result.errors.join(', ')}`, 'error');
            }

        } catch (error) {
            console.error('Error submitting disaster area:', error);
            this.showMessage('❌ Failed to save disaster area. Please try again.', 'error');
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    /**
     * Reload disaster layer via WMS
     */
    async reloadDisasterLayer() {
        // Get reference to main layer manager
        if (window.dynamicLayerManager) {
            try {
                // For now, just show a message that the disaster was saved
                // The WMS layer will be added once the QGIS project is properly configured
                this.showMessage('💾 Disaster area saved to database successfully!', 'success');
                
                // Future: Once user_disaster_areas WMS layer is working, uncomment below:
                /*
                // Check if disaster layer is already loaded
                if (window.dynamicLayerManager.activeLayers.has('user_disaster_areas')) {
                    // Reload the layer
                    window.dynamicLayerManager.unloadLayer('user_disaster_areas');
                    await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay
                    await window.dynamicLayerManager.loadLayer('user_disaster_areas');
                } else {
                    // Load the layer for the first time
                    await window.dynamicLayerManager.loadLayer('user_disaster_areas');
                }
                
                this.showMessage('🔄 Disaster layer updated on map', 'info');
                */
            } catch (error) {
                console.error('Error reloading disaster layer:', error);
                this.showMessage('💾 Disaster saved successfully to database', 'success');
            }
        } else {
            this.showMessage('💾 Disaster area saved to database', 'success');
        }
    }


    getBufferDistancesFromUI() {
        const distances = [];
        for (let i = 1; i <= 3; i++) {
            const input = document.getElementById(`buffer-distance-${i}`);
            if (input && input.value) {
                const distance = parseInt(input.value, 10);
                if (distance > 0) {
                    distances.push(distance);
                }
            }
        }
        return distances.length ? distances.sort((a, b) => a - b) : [1000, 5000, 10000];
    }

    async analyzeEmergencyServicesNearDisaster(geometry) {
        const resultsEl = document.getElementById('disaster-buffer-results');
        const spatialEngine = window.spatialAnalysisEngine;
        if (!resultsEl || !spatialEngine || typeof turf === 'undefined') return;

        const feature = { type: 'Feature', geometry, properties: {} };
        const distances = this.getBufferDistancesFromUI();
        const bufferResults = spatialEngine.calculateBufferZones([feature], distances);

        const bbox = turf.bbox(feature);
        const bboxParam = `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`;

        const serviceLayers = [
            { layer: 'agency_hospital', label: 'Hospitals' },
            { layer: 'agency_fire', label: 'Fire Stations' },
            { layer: 'agency_police', label: 'Police Stations' }
        ];

        const layerFeatures = {};
        for (const item of serviceLayers) {
            try {
                const url = `${this.config.api.baseUrl}/layers/${item.layer}/features?bbox=${bboxParam}&limit=5000`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    layerFeatures[item.layer] = data.features || [];
                } else {
                    layerFeatures[item.layer] = [];
                }
            } catch (e) {
                layerFeatures[item.layer] = [];
            }
        }

        let html = '<strong>Services within buffers:</strong><br>';
        bufferResults.buffers.forEach((buffers, distance) => {
            const buffer = buffers[0];
            const counts = serviceLayers.map((item) => {
                const features = layerFeatures[item.layer] || [];
                const within = spatialEngine.findFeaturesWithinBuffer(features, buffer, { includeDistance: false });
                return `${item.label}: ${within.length}`;
            });
            html += `&nbsp;? ${distance}m: ${counts.join(', ')}<br>`;
        });

        resultsEl.innerHTML = html;
    }

    /**
     * Cancel current drawing
     */
    cancelDrawing() {
        this.clearDrawings();
        this.hideDisasterForm();
        this.toggleDrawingMode(false);
    }

    setMode(mode) {
        this.currentMode = mode;
    }

    showDamageForm(layer) {
        const form = document.getElementById('damage-form');
        const panel = document.getElementById('damage-form-panel');
        if (form && panel) {
            form.currentLayer = layer;
            panel.classList.add('show');
        }
    }

    hideDamageForm() {
        const panel = document.getElementById('damage-form-panel');
        const form = document.getElementById('damage-form');
        if (panel) panel.classList.remove('show');
        if (form) {
            form.reset();
            form.currentLayer = null;
        }
    }

    async submitDamageAssessment() {
        const form = document.getElementById('damage-form');
        if (!form || !form.currentLayer) {
            this.showMessage('No damage geometry selected', 'error');
            return;
        }
        try {
            this.showLoadingIndicator(true, 'damage');
            const formData = new FormData(form);
            const payload = {
                damage_level: formData.get('damage_level'),
                description: formData.get('description') || '',
                geometry: form.currentLayer.toGeoJSON().geometry,
                created_by: 'web_user'
            };
            if (!payload.damage_level) {
                this.showMessage('Please select damage level', 'error');
                return;
            }
            const response = await fetch(`${this.config.api.baseUrl}/damage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                this.showMessage('? Damage assessment saved', 'success');
                this.drawingLayer.removeLayer(form.currentLayer);
                this.hideDamageForm();
                if (window.dataLayerManager) {
                    await window.dataLayerManager.loadDamageLayer();
                }
            } else {
                this.showMessage(`? Error: ${result.errors?.join(', ') || 'Unknown'}`, 'error');
            }
        } catch (error) {
            console.error('Error submitting damage assessment:', error);
            this.showMessage('? Failed to save damage assessment', 'error');
        } finally {
            this.showLoadingIndicator(false, 'damage');
        }
    }

    cancelDamage() {
        this.clearDrawings();
        this.hideDamageForm();
        this.toggleDrawingMode(false);
    }

    /**
     * Clear all drawings
     */
    clearDrawings() {
        if (this.drawingLayer) {
            this.drawingLayer.clearLayers();
        }
    }

    /**
     * Show drawing instructions
     */
    showDrawingInstructions() {
        this.showMessage(`
            📍 <strong>Drawing Mode Active</strong><br>
            • Use polygon tool for area disasters (floods, landslides)<br>
            • Use marker tool for point disasters (fires, explosions)<br>
            • Use rectangle/circle for quick area selection<br>
            • Fill in disaster details after drawing
        `, 'info', 8000);
    }

    /**
     * Show message to user
     */
    showMessage(message, type = 'info', duration = 5000) {
        // Try to use main app's message system
        if (window.dynamicLayerManager && window.dynamicLayerManager.showLayerInfo) {
            window.dynamicLayerManager.showLayerInfo(message, type);
        } else {
            // Fallback to console
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * Show/hide loading indicator
     */
    showLoadingIndicator(show, mode = 'disaster') {
        const indicator = document.getElementById(mode === 'damage' ? 'damage-loading' : 'drawing-loading');
        if (indicator) {
            indicator.classList.toggle('show', show);
        }
        
        // Also use main app's loading indicator
        if (window.dynamicLayerManager && window.dynamicLayerManager.showLoadingIndicator) {
            window.dynamicLayerManager.showLoadingIndicator(show);
        }
    }

    /**
     * Hide drawing UI when not available
     */
    hideDrawingUI() {
        const drawingToggle = document.getElementById('toggle-drawing');
        const drawingPanel = document.getElementById('drawing-panel');
        
        if (drawingToggle) {
            drawingToggle.style.display = 'none';
        }
        
        if (drawingPanel) {
            drawingPanel.style.display = 'none';
        }
        
        console.log('🚫 Drawing UI hidden - Leaflet.Draw not available');
    }

    /**
     * Get drawing statistics
     */
    getDrawingStats() {
        const layers = [];
        if (this.drawingLayer) {
            this.drawingLayer.eachLayer((layer) => {
                if (layer.disasterData) {
                    layers.push({
                        type: layer.disasterData.type,
                        created: layer.disasterData.created,
                        hasAttributes: !!(layer.disasterData.disaster_type && layer.disasterData.severity)
                    });
                }
            });
        }
        
        return {
            totalDrawings: layers.length,
            completedDrawings: layers.filter(l => l.hasAttributes).length,
            pendingDrawings: layers.filter(l => !l.hasAttributes).length
        };
    }
}
