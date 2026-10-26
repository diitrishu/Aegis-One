/**
 * Data Layer UI
 */
class DataLayerUI {
    constructor(dataLayerManager) {
        this.manager = dataLayerManager;
        this.bind();
    }

    bind() {
        const popToggle = document.getElementById('population-toggle');
        const damageToggle = document.getElementById('damage-toggle');
        const uploadInput = document.getElementById('upload-geojson');
        const extName = document.getElementById('external-layer-name');
        const extType = document.getElementById('external-layer-type');
        const extUrl = document.getElementById('external-layer-url');
        const extBtn = document.getElementById('add-external-layer');
        const orderSelect = document.getElementById('layer-order-select');
        const bringFront = document.getElementById('layer-bring-front');
        const sendBack = document.getElementById('layer-send-back');

        popToggle?.addEventListener('change', async (e) => {
            if (e.target.checked) {
                await this.manager.loadPopulationLayer();
            } else {
                this.manager.removeLayer('population_density');
            }
            this.refreshLayerOrderSelect(orderSelect);
        });

        damageToggle?.addEventListener('change', async (e) => {
            if (e.target.checked) {
                await this.manager.loadDamageLayer();
            } else {
                this.manager.removeLayer('damage_assessment');
            }
            this.refreshLayerOrderSelect(orderSelect);
        });

        uploadInput?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const name = file.name.replace(/\.[^/.]+$/, '');
            await this.manager.uploadGeoJsonLayer(file, name, { displayName: name });
            e.target.value = '';
            this.refreshLayerOrderSelect(orderSelect);
        });

        extBtn?.addEventListener('click', async () => {
            const name = extName?.value?.trim();
            const type = extType?.value;
            const url = extUrl?.value?.trim();
            if (!name || !url) return;
            if (type === 'geojson') {
                await this.manager.loadGeoJsonFromUrl(url, name);
            } else if (type === 'wfs') {
                await this.manager.loadWfsLayer(url, name);
            } else if (type === 'wms') {
                this.manager.addWmsLayer(name, url);
            }
            if (extName) extName.value = '';
            if (extUrl) extUrl.value = '';
            this.refreshLayerOrderSelect(orderSelect);
        });

        bringFront?.addEventListener('click', () => {
            const name = orderSelect?.value;
            if (!name) return;
            this.manager.reorderLayer(name, 'front');
            window.dynamicLayerManager?.reorderLayer?.(name, 'front');
        });

        sendBack?.addEventListener('click', () => {
            const name = orderSelect?.value;
            if (!name) return;
            this.manager.reorderLayer(name, 'back');
            window.dynamicLayerManager?.reorderLayer?.(name, 'back');
        });

        this.refreshLayerOrderSelect(orderSelect);
    }

    refreshLayerOrderSelect(selectEl) {
        if (!selectEl) return;
        const names = new Set(this.manager.getLayerNames());
        if (window.dynamicLayerManager?.getLayerNames) {
            window.dynamicLayerManager.getLayerNames().forEach((n) => names.add(n));
        }
        const options = Array.from(names.values()).sort();
        selectEl.innerHTML = options.map((n) => `<option value="${n}">${n}</option>`).join('');
    }
}
