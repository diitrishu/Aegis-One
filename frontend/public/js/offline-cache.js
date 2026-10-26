/**
 * Offline Cache Manager
 *
 * Keeps a copy of the map data the dashboard reads from the API (facilities, highways,
 * population grid, disaster areas, damage assessments) in IndexedDB so the operator can keep
 * working when the connection to the server drops.
 *
 *  - GET requests to the API are "network first": a good response is stored, and if the request
 *    fails the newest cached data covering the requested area is returned instead.
 *  - "Cache this area" pre-loads everything for the current map view (plus a margin).
 *  - A small status badge shows Online / Offline (cached data).
 *
 * Map background tiles are not cached; only the emergency data layers are.
 */
class OfflineCacheManager {
    constructor(map, config) {
        this.map = map;
        this.config = config;
        this.dbName = 'aegis-offline-cache';
        this.storeName = 'api';
        this.db = null;
        this.memory = new Map(); // fallback when IndexedDB is unavailable
        this.offline = !navigator.onLine;
        this.serverReachable = true;
        this.stats = { hits: 0, stores: 0, misses: 0 };
        this.layers = ['agency_hospital', 'agency_fire', 'agency_police', 'highways', 'population_density',
            'user_disaster_areas', 'damage_assessment'];
        this.originalFetch = window.fetch.bind(window);
        this.openDb().finally(() => {
            this.installFetchWrapper();
            this.createControls();
            this.updateBadge();
        });
        window.addEventListener('online', () => this.setOffline(false));
        window.addEventListener('offline', () => this.setOffline(true));
    }

    // ------------------------------------------------------------------ storage
    openDb() {
        return new Promise((resolve) => {
            try {
                const req = indexedDB.open(this.dbName, 1);
                req.onupgradeneeded = () => {
                    const store = req.result.createObjectStore(this.storeName, { keyPath: 'key' });
                    store.createIndex('layer', 'layer');
                };
                req.onsuccess = () => { this.db = req.result; resolve(); };
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
            } catch (e) {
                resolve();
            }
        });
    }

    tx(mode, fn) {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve(fn(null));
                return;
            }
            try {
                const store = this.db.transaction(this.storeName, mode).objectStore(this.storeName);
                const out = fn(store);
                if (out && typeof out.onsuccess !== 'undefined') {
                    out.onsuccess = () => resolve(out.result);
                    out.onerror = () => resolve(undefined);
                } else {
                    resolve(out);
                }
            } catch (e) {
                resolve(undefined);
            }
        });
    }

    async put(entry) {
        this.stats.stores++;
        if (!this.db) {
            this.memory.set(entry.key, entry);
            return;
        }
        await this.tx('readwrite', (s) => s.put(entry));
    }

    async getAll() {
        if (!this.db) return Array.from(this.memory.values());
        return (await this.tx('readonly', (s) => s.getAll())) || [];
    }

    async get(key) {
        if (!this.db) return this.memory.get(key);
        return this.tx('readonly', (s) => s.get(key));
    }

    async clear() {
        this.memory.clear();
        if (this.db) await this.tx('readwrite', (s) => s.clear());
        this.updateBadge();
        window.toast?.info('Offline cache cleared');
    }

    // ------------------------------------------------------------- request logic
    isCacheable(url) {
        const base = this.config?.api?.baseUrl;
        if (!base || !url.startsWith(base)) return false;
        const path = url.slice(base.length).split('?')[0];
        return /^\/(layers\/[^/]+\/features|population|damage|disasters|facilities)\/?$/.test(path);
    }

    parseUrl(url) {
        const base = this.config.api.baseUrl;
        const u = new URL(url);
        const path = u.pathname.replace(new URL(base).pathname, '');
        const m = path.match(/^\/layers\/([^/]+)\/features/);
        const layer = m ? m[1] : path.replace(/^\//, '');
        const bboxRaw = u.searchParams.get('bbox');
        const bbox = bboxRaw ? bboxRaw.split(',').map(Number) : null;
        return { layer, bbox, key: u.pathname + u.search };
    }

    installFetchWrapper() {
        const self = this;
        window.fetch = async function (input, init) {
            const url = typeof input === 'string' ? input : input?.url;
            const method = (init?.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();
            if (!url || method !== 'GET' || !self.isCacheable(url)) {
                return self.originalFetch(input, init);
            }
            const meta = self.parseUrl(url);
            try {
                if (self.offline) throw new Error('offline');
                const response = await self.originalFetch(input, init);
                if (response.ok) {
                    self.markReachable(true);
                    response.clone().json().then((data) => {
                        self.put({ key: meta.key, layer: meta.layer, bbox: meta.bbox, data, storedAt: Date.now() });
                    }).catch(() => {});
                }
                return response;
            } catch (error) {
                if (error?.name === 'AbortError') throw error;
                if (!self.offline) self.markReachable(false);
                const cached = await self.lookup(meta);
                if (cached) {
                    self.stats.hits++;
                    return new Response(JSON.stringify(cached), {
                        status: 200, headers: { 'Content-Type': 'application/json', 'X-Aegis-Cache': 'hit' }
                    });
                }
                self.stats.misses++;
                throw error;
            }
        };
    }

    async lookup(meta) {
        const exact = await this.get(meta.key);
        if (exact) return exact.data;
        const entries = (await this.getAll()).filter((e) => e.layer === meta.layer && e.data);
        if (!entries.length) return null;
        if (!meta.bbox) return entries.sort((a, b) => b.storedAt - a.storedAt)[0].data;
        const [w, s, e, n] = meta.bbox;
        const covering = entries.filter((c) => c.bbox && c.bbox[0] <= w && c.bbox[1] <= s && c.bbox[2] >= e && c.bbox[3] >= n)
            .sort((a, b) => b.storedAt - a.storedAt)[0];
        const source = covering || entries.filter((c) => c.bbox).sort((a, b) => b.storedAt - a.storedAt)[0];
        if (!source) return null;
        const inView = (f) => {
            const g = f.geometry;
            if (!g) return false;
            const pts = [];
            const walk = (c) => { if (typeof c[0] === 'number') pts.push(c); else c.forEach(walk); };
            walk(g.coordinates);
            return pts.some(([x, y]) => x >= w && x <= e && y >= s && y <= n);
        };
        const features = (source.data.features || []).filter(inView);
        return { ...source.data, features, count: features.length, cached: true, cached_at: new Date(source.storedAt).toISOString() };
    }

    // --------------------------------------------------------------- prefetching
    async cacheCurrentView() {
        const b = this.map.getBounds().pad(0.5);
        const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => +v.toFixed(5));
        const base = this.config.api.baseUrl;
        let ok = 0;
        window.toast?.info('Caching data for this area...');
        for (const layer of this.layers) {
            try {
                const url = `${base}/layers/${layer}/features?bbox=${bbox.join(',')}&limit=20000`;
                const res = await this.originalFetch(url);
                if (!res.ok) continue;
                const data = await res.json();
                await this.put({ key: this.parseUrl(url).key, layer, bbox, data, storedAt: Date.now() });
                ok++;
            } catch (e) { /* skip layer */ }
        }
        for (const path of ['damage', 'disasters']) {
            try {
                const res = await this.originalFetch(`${base}/${path}`);
                if (res.ok) {
                    await this.put({ key: `${new URL(base).pathname}/${path}`, layer: path, bbox: null, data: await res.json(), storedAt: Date.now() });
                    ok++;
                }
            } catch (e) { /* skip */ }
        }
        this.updateBadge();
        if (ok) window.toast?.success(`Cached ${ok} data sets for offline use`);
        else window.toast?.error('Could not cache this area (server not reachable)');
        return ok;
    }

    async getStats() {
        const all = await this.getAll();
        return { entries: all.length, layers: [...new Set(all.map((e) => e.layer))], ...this.stats, offline: this.offline };
    }

    // ------------------------------------------------------------------------ UI
    setOffline(value) {
        this.offline = value;
        this.updateBadge();
        if (value) window.toast?.warning('You are offline. Showing cached data where available.');
        else window.toast?.success('Back online');
    }

    markReachable(value) {
        if (this.serverReachable !== value) {
            this.serverReachable = value;
            this.updateBadge();
        }
    }

    createControls() {
        if (!this.map || document.getElementById('offline-status')) return;
        const self = this;
        const Control = L.Control.extend({
            options: { position: 'bottomleft' },
            onAdd() {
                const div = L.DomUtil.create('div', 'offline-control');
                div.style.cssText = 'background:rgba(15,23,42,.88);color:#e2e8f0;padding:6px 10px;border-radius:8px;font:12px/1.3 system-ui,sans-serif;display:flex;gap:8px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.4)';
                div.innerHTML = '<span id="offline-status">...</span>' +
                    '<button id="cache-area-btn" type="button" title="Download data for this map area for offline use" style="background:#0ea5e9;color:#fff;border:0;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:12px">Cache area</button>';
                L.DomEvent.disableClickPropagation(div);
                div.querySelector('#cache-area-btn').addEventListener('click', () => self.cacheCurrentView());
                return div;
            }
        });
        this.control = new Control();
        this.control.addTo(this.map);
    }

    updateBadge() {
        const el = document.getElementById('offline-status');
        if (!el) return;
        const down = this.offline || !this.serverReachable;
        el.textContent = down ? 'Offline - cached data' : 'Online';
        el.style.color = down ? '#fbbf24' : '#4ade80';
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineCacheManager;
}
