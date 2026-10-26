/**
 * Strategic Analysis Manager
 *
 * One-click situation assessment for disaster areas, built on SpatialAnalysisEngine:
 *   - hospitals inside the hazard zones (at risk) and the nearest hospitals outside them
 *   - estimated affected population (WorldPop grid from the API)
 *   - priority zones ranked by population (damage assessments, or the disaster areas)
 *   - emergency-service coverage gap (area farther than 5 km from any hospital, fire or police station)
 *   - plain-language resource recommendations
 * Adds a "Strategic Analysis" section to the map sidebar and draws the results on the map.
 */
class StrategicAnalysisManager {
    constructor(map, spatialEngine, dataLayerManager, config) {
        this.map = map;
        this.engine = spatialEngine;
        this.dataLayerManager = dataLayerManager;
        this.config = config;
        this.searchRadiusKm = 25;
        this.coverageKm = 5;
        this.layerGroup = L.layerGroup().addTo(map);
        this.lastResult = null;
        this.running = false;
        this.createPanel();
    }

    get api() { return this.config.api.baseUrl; }

    async getJson(url, options) {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText} (${url})`);
        return res.json();
    }

    createPanel() {
        const anchor = document.getElementById('drawing-panel');
        if (!anchor || document.getElementById('strategic-panel')) return;
        const section = document.createElement('div');
        section.className = 'control-section';
        section.id = 'strategic-panel';
        section.innerHTML = `
            <h3>Strategic Analysis</h3>
            <div class="control-section-content">
                <label for="strategic-scope" style="display:block;margin-bottom:4px">Analyse:</label>
                <select id="strategic-scope" class="disaster-select" style="width:100%;margin-bottom:8px">
                    <option value="all">All disaster areas and damage assessments</option>
                </select>
                <button id="run-strategic-analysis" class="btn btn-primary mb-2" type="button">Run analysis</button>
                <button id="clear-strategic-analysis" class="btn btn-secondary mb-2" type="button">Clear</button>
                <div id="strategic-results" class="disaster-buffer-results" aria-live="polite"></div>
            </div>`;
        anchor.insertAdjacentElement('afterend', section);
        section.querySelector('#run-strategic-analysis').addEventListener('click', () => this.run());
        section.querySelector('#clear-strategic-analysis').addEventListener('click', () => this.clear());
        section.querySelector('#strategic-scope').addEventListener('focus', () => this.refreshScopes());
        this.refreshScopes();
    }

    async refreshScopes() {
        const select = document.getElementById('strategic-scope');
        if (!select) return;
        try {
            const data = await this.getJson(`${this.api}/disasters`);
            const keep = select.value;
            select.innerHTML = '<option value="all">All disaster areas and damage assessments</option>' +
                (data.disasters || []).map((d) => `<option value="${d.id}">#${d.id} ${d.disaster_type} (${d.severity})</option>`).join('');
            if ([...select.options].some((o) => o.value === keep)) select.value = keep;
        } catch (e) { /* keep default option */ }
    }

    async collectZones() {
        const scope = document.getElementById('strategic-scope')?.value || 'all';
        const zones = [];
        const disasters = (await this.getJson(`${this.api}/disasters`)).disasters || [];
        disasters.filter((d) => d.geometry && (scope === 'all' || String(d.id) === scope)).forEach((d) => {
            zones.push({ type: 'Feature', geometry: d.geometry, properties: { source: 'disaster', label: `${d.disaster_type} #${d.id}`, severity: d.severity, damage_level: d.severity } });
        });
        if (scope === 'all') {
            const damage = await this.getJson(`${this.api}/damage`);
            (damage.features || []).forEach((f) => zones.push({ ...f, properties: { ...f.properties, source: 'damage', label: `Damage #${f.properties?.id}` } }));
        }
        return zones;
    }

    expandedBbox(zones) {
        const fc = { type: 'FeatureCollection', features: zones };
        const [w, s, e, n] = turf.bbox(fc);
        const pad = this.searchRadiusKm / 111;
        return [w - pad, s - pad, e + pad, n + pad];
    }

    async loadLayer(layer, bbox, limit = 20000) {
        const data = await this.getJson(`${this.api}/layers/${layer}/features?bbox=${bbox.join(',')}&limit=${limit}`);
        return data.features || [];
    }

    centroidOf(f) {
        return turf.centroid(f).geometry.coordinates;
    }

    mergeOverlapping(zones) {
        const merged = [];
        zones.forEach((z) => {
            let current = z;
            for (let i = merged.length - 1; i >= 0; i--) {
                try {
                    if (turf.booleanIntersects(current, merged[i])) {
                        const u = turf.union(current, merged[i]);
                        if (u) { current = u; merged.splice(i, 1); }
                    }
                } catch (e) { /* keep separate on geometry error */ }
            }
            merged.push(current);
        });
        return merged;
    }

    // zones smaller than one grid cell contain no cell centre: scale the nearest cell's density by the zone area
    estimateSmallZone(zone, population) {
        try {
            const c = turf.centroid(zone);
            let best = null;
            population.forEach((cell) => {
                const d = turf.distance(c, cell, { units: 'kilometers' });
                if (d <= 1 && (!best || d < best.d)) best = { d, cell };
            });
            if (!best) return 0;
            return Math.round((best.cell.properties.population_density || 0) * (turf.area(zone) / 1e6));
        } catch (e) {
            return 0;
        }
    }

    computeCoverageGap(zones, facilities) {
        // area of the hazard zones that is farther than coverageKm from every service point
        let gapKm2 = 0;
        zones.forEach((zone) => {
            try {
                const zoneArea = turf.area(zone) / 1e6;
                const c = turf.centroid(zone);
                const near = facilities
                    .map((f) => ({ f, d: turf.distance(c, f, { units: 'kilometers' }) }))
                    .filter((x) => x.d < this.coverageKm + Math.sqrt(zoneArea))
                    .sort((a, b) => a.d - b.d).slice(0, 40);
                let covered = 0;
                if (near.length) {
                    let union = null;
                    near.forEach(({ f }) => {
                        const buf = turf.buffer(f, this.coverageKm, { units: 'kilometers' });
                        union = union ? (turf.union(union, buf) || union) : buf;
                    });
                    const inter = union ? turf.intersect(zone, union) : null;
                    covered = inter ? turf.area(inter) / 1e6 : 0;
                }
                gapKm2 += Math.max(0, zoneArea - covered);
            } catch (e) { /* skip zone on geometry error */ }
        });
        return gapKm2;
    }

    async run() {
        if (this.running) return null;
        this.running = true;
        const out = document.getElementById('strategic-results');
        if (out) out.textContent = 'Analysing...';
        try {
            const zones = await this.collectZones();
            if (!zones.length) {
                const msg = 'No disaster areas or damage assessments yet. Draw a disaster area first.';
                if (out) out.textContent = msg;
                window.toast?.info(msg);
                return null;
            }
            const bbox = this.expandedBbox(zones);
            const [hospitals, fire, police, population] = await Promise.all([
                this.loadLayer('agency_hospital', bbox), this.loadLayer('agency_fire', bbox),
                this.loadLayer('agency_police', bbox), this.loadLayer('population_density', bbox)
            ]);

            const hospitalsAtRisk = this.engine.identifyHospitalsAtRisk(zones, hospitals);
            const atRiskIds = new Set(hospitalsAtRisk.map((h) => h.properties.osm_id));
            const centre = turf.centroid({ type: 'FeatureCollection', features: zones });
            const nearbyHospitals = hospitals.filter((h) => !atRiskIds.has(h.properties.osm_id))
                .map((h) => ({ feature: h, km: turf.distance(centre, h, { units: 'kilometers' }) }))
                .filter((x) => x.km <= this.searchRadiusKm).sort((a, b) => a.km - b.km).slice(0, 5);

            let totalPopulation = 0;
            const demographics = { children: 0, elderly: 0, disabled: 0 };
            // overlapping zones are merged first so nobody is counted twice
            this.mergeOverlapping(zones).forEach((z) => {
                const p = this.engine.calculateAffectedPopulation(z, population);
                if (p.totalPopulation === 0) p.totalPopulation = this.estimateSmallZone(z, population);
                totalPopulation += p.totalPopulation;
                Object.keys(demographics).forEach((k) => { demographics[k] += p.demographics[k]; });
            });
            const affectedPopulation = { totalPopulation, demographics };
            const priorityZones = this.engine.calculatePriorityZones(zones, population);
            const serviceGapsAreaKm2 = this.computeCoverageGap(zones, [...hospitals, ...fire, ...police]);
            const recommendations = this.engine.generateResourceRecommendations({ hospitalsAtRisk, affectedPopulation, serviceGapsAreaKm2, priorityZones });
            if (nearbyHospitals.length) {
                recommendations.push(`Nearest operating hospital: ${nearbyHospitals[0].feature.properties.name} (${nearbyHospitals[0].km.toFixed(1)} km).`);
            }

            this.lastResult = {
                generatedAt: new Date().toISOString(), zoneCount: zones.length, hospitalsAtRisk,
                nearbyHospitals: nearbyHospitals.map((x) => ({ ...x.feature, distance_km: +x.km.toFixed(1) })),
                affectedPopulation, priorityZones, serviceGapsAreaKm2, recommendations,
                facilityCounts: { hospitals: hospitals.length, fire: fire.length, police: police.length },
                searchRadiusKm: this.searchRadiusKm
            };
            this.render(zones);
            document.dispatchEvent(new CustomEvent('strategic-analysis-complete', { detail: this.lastResult }));
            return this.lastResult;
        } catch (error) {
            console.error('Strategic analysis failed:', error);
            if (out) out.textContent = `Analysis failed: ${error.message}`;
            window.toast?.error('Strategic analysis failed. Check the server connection.');
            return null;
        } finally {
            this.running = false;
        }
    }

    render(zones) {
        const r = this.lastResult;
        this.layerGroup.clearLayers();
        zones.forEach((z) => L.geoJSON(z, { style: { color: '#ff4757', weight: 2, fillOpacity: 0.12, dashArray: '6 4' } }).addTo(this.layerGroup));
        r.hospitalsAtRisk.forEach((h) => {
            const [lon, lat] = h.geometry.coordinates;
            L.circleMarker([lat, lon], { radius: 9, color: '#ff4757', weight: 3, fillColor: '#ff4757', fillOpacity: 0.35 })
                .bindPopup(`<strong>${h.properties.name}</strong><br>Inside hazard zone`).addTo(this.layerGroup);
        });
        r.priorityZones.slice(0, 3).forEach((z, i) => {
            try {
                const [lon, lat] = this.centroidOf({ type: 'Feature', geometry: z.geometry, properties: {} });
                L.marker([lat, lon], { icon: L.divIcon({ className: '', html: `<div style="background:#f59e0b;color:#111;border-radius:50%;width:22px;height:22px;line-height:22px;text-align:center;font-weight:700;border:2px solid #fff">${i + 1}</div>` }) })
                    .bindPopup(`Priority ${i + 1}: ~${z.estimated_population.toLocaleString()} people (${z.damage_level})`).addTo(this.layerGroup);
            } catch (e) { /* skip marker */ }
        });
        const out = document.getElementById('strategic-results');
        if (!out) return;
        const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        out.innerHTML = `
            <strong>${r.zoneCount} zone(s) analysed</strong><br>
            Affected population: <strong>${r.affectedPopulation.totalPopulation.toLocaleString()}</strong><br>
            Hospitals at risk: <strong>${r.hospitalsAtRisk.length}</strong>${r.hospitalsAtRisk.length ? ' (' + r.hospitalsAtRisk.slice(0, 3).map((h) => esc(h.properties.name)).join(', ') + ')' : ''}<br>
            Service coverage gap: ${r.serviceGapsAreaKm2.toFixed(1)} km&sup2;<br>
            <em>Nearest hospitals:</em> ${r.nearbyHospitals.slice(0, 3).map((h) => `${esc(h.properties.name)} ${h.distance_km} km`).join('; ') || 'none within ' + r.searchRadiusKm + ' km'}<br>
            <em>Recommendations:</em><ul style="margin:4px 0 0 16px;padding:0">${r.recommendations.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    }

    getLastResult() { return this.lastResult; }

    clear() {
        this.layerGroup.clearLayers();
        this.lastResult = null;
        const out = document.getElementById('strategic-results');
        if (out) out.innerHTML = '';
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StrategicAnalysisManager;
}
