/**
 * Real-Time Data Manager
 *
 * Polls live sources and publishes the result in `latestData`, which the route planner
 * reads (window.realTimeDataManager.latestData).
 *
 *   weather    current conditions at the map centre (Open-Meteo, free, no key)
 *   emergency  active disaster areas reported to the AEGIS API
 *   traffic    road closures / incidents - only when a feed is configured in
 *              DynamicConfig.realtime.trafficUrl (JSON: { closures: [{ geometry, ... }] });
 *              otherwise left out rather than invented.
 *
 * Fires a `realtime-data` event on `document` after each refresh.
 */
class RealTimeDataManager {
    constructor(config) {
        this.config = config;
        const rt = config.realtime || {};
        this.intervalMs = rt.refreshMs || 60000;
        this.trafficUrl = rt.trafficUrl || null;
        this.weatherUrl = rt.weatherUrl || 'https://api.open-meteo.com/v1/forecast';
        this.latestData = {};
        this.status = { weather: 'pending', emergency: 'pending', traffic: this.trafficUrl ? 'pending' : 'not-configured' };
        this.center = config.map?.center || [26.8467, 80.9462];
        this.timer = null;
        this.listeners = [];
        this.panel = null;
        document.addEventListener('mapMoveEnd', (e) => {
            const c = e.detail?.center;
            if (c) this.center = [c.lat, c.lng];
            clearTimeout(this.moveTimer);
            this.moveTimer = setTimeout(() => this.refreshWeather().then(() => this.publish()), 1500);
        });
        this.createPanel();
        this.start();
    }

    start() {
        this.stop();
        this.refresh();
        this.timer = setInterval(() => this.refresh(), this.intervalMs);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    onUpdate(cb) {
        this.listeners.push(cb);
        return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
    }

    async refresh() {
        await Promise.allSettled([this.refreshWeather(), this.refreshEmergency(), this.refreshTraffic()]);
        this.publish();
    }

    publish() {
        this.latestData.updatedAt = new Date().toISOString();
        this.renderPanel();
        this.listeners.forEach((cb) => { try { cb(this.latestData); } catch (e) { /* listener error */ } });
        document.dispatchEvent(new CustomEvent('realtime-data', { detail: this.latestData }));
    }

    async fetchJson(url, timeout = 8000) {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
    }

    async refreshWeather() {
        try {
            const [lat, lon] = this.center;
            const url = `${this.weatherUrl}?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
                '&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&timezone=auto';
            const data = await this.fetchJson(url);
            const c = data.current || {};
            this.latestData.weather = {
                temperatureC: c.temperature_2m, humidityPct: c.relative_humidity_2m, precipitationMm: c.precipitation,
                windKph: c.wind_speed_10m, condition: RealTimeDataManager.describeWeather(c.weather_code),
                location: { lat, lon }, source: 'Open-Meteo', observedAt: c.time
            };
            this.status.weather = 'ok';
        } catch (e) {
            this.status.weather = 'unavailable';
            delete this.latestData.weather;
        }
    }

    async refreshEmergency() {
        try {
            const data = await this.fetchJson(`${this.config.api.baseUrl}/disasters`);
            const list = data.disasters || [];
            const bySeverity = {};
            const byType = {};
            list.forEach((d) => {
                bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
                byType[d.disaster_type] = (byType[d.disaster_type] || 0) + 1;
            });
            this.latestData.emergency = { activeDisasters: list.length, bySeverity, byType, latest: list[0] || null, source: 'AEGIS API' };
            this.status.emergency = 'ok';
        } catch (e) {
            this.status.emergency = 'unavailable';
            delete this.latestData.emergency;
        }
    }

    async refreshTraffic() {
        if (!this.trafficUrl) return;
        try {
            const data = await this.fetchJson(this.trafficUrl);
            this.latestData.traffic = { closures: Array.isArray(data.closures) ? data.closures : [], incidents: data.incidents || [], source: this.trafficUrl };
            this.status.traffic = 'ok';
        } catch (e) {
            this.status.traffic = 'unavailable';
            delete this.latestData.traffic;
        }
    }

    static describeWeather(code) {
        const map = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle',
            53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow',
            75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail',
            99: 'Thunderstorm with hail' };
        return map[code] || 'Unknown';
    }

    createPanel() {
        if (document.getElementById('realtime-panel')) return;
        const host = document.getElementById('map');
        if (!host) return;
        const p = document.createElement('div');
        p.id = 'realtime-panel';
        p.style.cssText = 'position:absolute;bottom:28px;right:10px;z-index:900;background:rgba(15,23,42,.88);color:#e2e8f0;' +
            'padding:8px 12px;border-radius:8px;font:12px/1.5 system-ui,sans-serif;min-width:170px;box-shadow:0 2px 8px rgba(0,0,0,.4);pointer-events:none';
        host.appendChild(p);
        this.panel = p;
        this.renderPanel();
    }

    renderPanel() {
        if (!this.panel) return;
        const w = this.latestData.weather;
        const e = this.latestData.emergency;
        const lines = ['<strong>Live conditions</strong>'];
        if (w) {
            lines.push(`${w.condition}, ${Math.round(w.temperatureC)}&deg;C, wind ${Math.round(w.windKph)} km/h`);
            if (w.precipitationMm > 0) lines.push(`Rain ${w.precipitationMm} mm`);
        } else {
            lines.push(`Weather: ${this.status.weather === 'pending' ? 'loading...' : 'unavailable'}`);
        }
        if (e) lines.push(`Active disasters: <strong>${e.activeDisasters}</strong>`);
        if (this.trafficUrl) {
            const t = this.latestData.traffic;
            lines.push(t ? `Road closures: ${t.closures.length}` : 'Traffic: unavailable');
        }
        this.panel.innerHTML = lines.join('<br>');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealTimeDataManager;
}
