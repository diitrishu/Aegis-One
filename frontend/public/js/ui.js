class UIController {
    constructor() {
        this.disasterSelect = document.getElementById('disaster-select');
        this.agencyToggles = document.querySelectorAll('.toggle-item input');
        this.legendContainer = document.getElementById('dynamic-legend');
        this.statusDot = document.querySelector('.status-indicator .dot');
        this.onChangeCallback = null;
    }

    init(onChangeCallback) {
        this.onChangeCallback = onChangeCallback;

        // Disaster Select Event
        this.disasterSelect.addEventListener('change', () => {
            this.handleStateChange();
            this.updateLegend();
        });

        // Agency Toggle Events
        this.agencyToggles.forEach(toggle => {
            toggle.addEventListener('change', () => {
                this.handleStateChange();
            });
        });

        // Initial trigger
        // setTimeout(() => this.handleStateChange(), 500); // Small delay to let map init
    }

    handleStateChange() {
        if (!this.onChangeCallback) return;

        const disasterLayer = this.disasterSelect.value;
        const activeAgencies = Array.from(this.agencyToggles)
            .filter(input => input.checked)
            .map(input => input.value);

        this.onChangeCallback(disasterLayer, activeAgencies);
    }

    updateLegend() {
        const disasterLayer = this.disasterSelect.value;
        this.legendContainer.innerHTML = ''; // Clear current

        if (!disasterLayer) {
            this.legendContainer.innerHTML = '<p class="placeholder-text">Select a scenario to view legend</p>';
            return;
        }

        // Construct GetLegendGraphic URL
        // Request: GetLegendGraphic, Format: image/png, Layer: [LayerName]
        const legendUrl = `${AppConfig.wmsUrl}?SERVICE=WMS&REQUEST=GetLegendGraphic&FORMAT=image/png&WIDTH=20&HEIGHT=20&LAYER=${disasterLayer}&TRANSPARENT=true`;

        const img = document.createElement('img');
        img.src = legendUrl;
        img.alt = `Legend for ${disasterLayer}`;
        img.onerror = () => {
            this.legendContainer.innerHTML = '<p class="placeholder-text" style="color:var(--danger-color)">Unable to load legend from server.</p>';
            this.statusDot.classList.remove('connected');
            this.statusDot.style.backgroundColor = 'var(--danger-color)';
        };
        img.onload = () => {
            this.statusDot.classList.add('connected');
            this.statusDot.style.backgroundColor = 'var(--success-color)';
        };

        this.legendContainer.appendChild(img);
    }
}
