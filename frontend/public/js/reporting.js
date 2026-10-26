/**
 * Reporting Manager
 *
 * Wires the "Export PNG" and "Generate PDF" buttons of the map page:
 *   PNG  - screenshot of the current map view (html2canvas)
 *   PDF  - A4 landscape situation report (jsPDF): map image, view details, active layers,
 *          layer feature counts, the latest strategic analysis (if one was run) and attribution.
 * Also offers GeoJSON / KML downloads of any loaded data layer.
 */
class ReportingManager {
    constructor(map, config, dataLayerManager) {
        this.map = map;
        this.config = config;
        this.dataLayerManager = dataLayerManager;
        this.busy = false;
        this.bind('export-png', () => this.exportPNG());
        this.bind('export-pdf', () => this.exportPDF());
    }

    bind(id, handler) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', async () => {
            if (this.busy) return;
            this.busy = true;
            const label = el.textContent;
            el.disabled = true;
            el.textContent = 'Working...';
            try {
                await handler();
            } catch (error) {
                console.error('Export failed:', error);
                window.toast?.error(`Export failed: ${error.message}`);
            } finally {
                el.disabled = false;
                el.textContent = label;
                this.busy = false;
            }
        });
    }

    timestamp() {
        return new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    }

    async captureMap() {
        if (typeof html2canvas === 'undefined') throw new Error('html2canvas is not loaded');
        const el = this.map.getContainer();
        return html2canvas(el, {
            useCORS: true, allowTaint: false, backgroundColor: '#0f172a', logging: false, scale: Math.min(2, window.devicePixelRatio || 1),
            ignoreElements: (node) => node.classList?.contains('leaflet-control-container')
        });
    }

    download(blobOrUrl, filename) {
        const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    async exportPNG() {
        const canvas = await this.captureMap();
        const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/png'));
        const name = `aegis-map-${this.timestamp()}.png`;
        this.download(blob, name);
        window.toast?.success(`Map exported as ${name}`);
        return name;
    }

    activeLayerSummary() {
        const rows = [];
        const lm = window.dynamicLayerManager;
        if (lm?.getActiveLayerInfo) {
            lm.getActiveLayerInfo().forEach((l) => rows.push([l.displayName || l.name, l.category || 'map layer', 'WMS']));
        }
        const dm = this.dataLayerManager;
        if (dm?.geoJsonLayers) {
            dm.geoJsonLayers.forEach((_layer, name) => {
                const count = dm.getLayerFeatures(name).length;
                rows.push([dm.getLayerMetadata(name)?.displayName || name, 'data layer', `${count} features`]);
            });
        }
        return rows;
    }

    async exportPDF() {
        const jsPDFCtor = window.jspdf?.jsPDF || window.jsPDF;
        if (!jsPDFCtor) throw new Error('jsPDF is not loaded');
        const canvas = await this.captureMap();
        const doc = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const W = doc.internal.pageSize.getWidth();
        const H = doc.internal.pageSize.getHeight();
        const margin = 12;

        doc.setFillColor(17, 63, 87);
        doc.rect(0, 0, W, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.text('AEGIS-1  Situation Report', margin, 12);
        doc.setFontSize(9);
        doc.text(new Date().toLocaleString(), W - margin, 12, { align: 'right' });

        const mapW = W - margin * 2;
        const mapH = Math.min(H - 40 - 20, mapW * (canvas.height / canvas.width));
        const imgW = mapH * (canvas.width / canvas.height);
        doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', margin, 24, imgW, mapH);

        const b = this.map.getBounds();
        const c = this.map.getCenter();
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(9);
        let x = margin + imgW + 6;
        let y = 28;
        const lineH = 5;
        const textW = W - margin - x;
        const write = (text, bold = false) => {
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            doc.splitTextToSize(String(text), Math.max(textW, 30)).forEach((ln) => {
                if (y > H - 14) return;
                doc.text(ln, x, y);
                y += lineH;
            });
        };
        if (textW > 30) {
            write('Map view', true);
            write(`Centre: ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
            write(`Zoom: ${this.map.getZoom()}`);
            write(`Extent: ${b.getSouth().toFixed(3)}, ${b.getWest().toFixed(3)} to ${b.getNorth().toFixed(3)}, ${b.getEast().toFixed(3)}`);
            y += 2;
            write('Active layers', true);
            const layers = this.activeLayerSummary();
            if (!layers.length) write('None');
            layers.slice(0, 12).forEach(([n, , d]) => write(`${n} (${d})`));
        }

        const analysis = window.strategicAnalysisManager?.getLastResult?.();
        if (analysis) {
            doc.addPage();
            doc.setFillColor(17, 63, 87);
            doc.rect(0, 0, W, 14, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(13);
            doc.text('Strategic analysis', margin, 10);
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(10);
            const lines = [
                `Hazard zones analysed: ${analysis.zoneCount}`,
                `Affected population (estimate): ${analysis.affectedPopulation.totalPopulation.toLocaleString()}`,
                `Hospitals at risk: ${analysis.hospitalsAtRisk.length}`,
                `Hospitals nearby (within ${analysis.searchRadiusKm} km): ${analysis.nearbyHospitals.length}`,
                `Service coverage gap: ${analysis.serviceGapsAreaKm2.toFixed(1)} km2`,
                '', 'Recommendations'
            ];
            analysis.recommendations.forEach((r) => lines.push(`- ${r}`));
            let yy = 26;
            lines.forEach((ln) => doc.splitTextToSize(ln, W - margin * 2).forEach((s) => { doc.text(s, margin, yy); yy += 6; }));
        }

        const pages = doc.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text('Map data (c) OpenStreetMap contributors; population WorldPop (CC BY 4.0); elevation NASA SRTM. Generated by AEGIS-1.', margin, H - 6);
            doc.text(`Page ${i} / ${pages}`, W - margin, H - 6, { align: 'right' });
        }
        const name = `aegis-report-${this.timestamp()}.pdf`;
        doc.save(name);
        window.toast?.success(`Report saved as ${name}`);
        return name;
    }

    exportLayerGeoJSON(layerName) {
        const features = this.dataLayerManager?.getLayerFeatures(layerName) || [];
        if (!features.length) {
            window.toast?.warning(`Layer "${layerName}" has no loaded features to export`);
            return null;
        }
        const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features })], { type: 'application/geo+json' });
        this.download(blob, `${layerName}-${this.timestamp()}.geojson`);
        return features.length;
    }

    exportLayerKML(layerName) {
        const features = this.dataLayerManager?.getLayerFeatures(layerName) || [];
        if (!features.length || typeof tokml === 'undefined') {
            window.toast?.warning('Nothing to export or KML library not loaded');
            return null;
        }
        const kml = tokml({ type: 'FeatureCollection', features }, { name: 'name', description: 'description' });
        this.download(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }), `${layerName}-${this.timestamp()}.kml`);
        return features.length;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportingManager;
}
