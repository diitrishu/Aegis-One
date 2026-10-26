"""Read access to the map layers stored in the GeoPackage (and the road graph).

Shared by the REST API (layers / damage / population endpoints), the lightweight WMS
server and the routing API, so every service sees the same data.

Layer names are the ones the frontend uses (see frontend/public/js/dynamic-config.js).
"""
import json
import math
import os
import re
import threading
from datetime import datetime
from pathlib import Path

import numpy as np
from shapely.geometry import box, mapping, shape

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("AEGIS_DATA_DIR", BACKEND_DIR / "data"))
GPKG_PATH = Path(os.environ.get("GPKG_PATH", DATA_DIR / "up_india_complete.gpkg"))
BOUNDARY_PATH = DATA_DIR / "boundaries" / "North_India_Boundary_wgs84.shp"
RUNTIME_DIR = DATA_DIR / "runtime"
DAMAGE_PATH = RUNTIME_DIR / "damage_assessment.json"
POPULATION_TIF = BACKEND_DIR.parent / "dataa" / "datasets" / "population" / "processed" / "north_india_population_2020.tif"

# frontend layer name -> GeoPackage table
GPKG_LAYERS = {
    "agency_hospital": "hospitals",
    "agency_fire": "fire_stations",
    "agency_police": "police_stations",
    "flood_zones": "flood_zones",
    "fire_risk": "fire_risk",
    "earthquake_zones": "earthquake_zones",
    "landslide_zones": "landslide_zones",
}
FACILITY_LAYERS = {
    "hospital": ("agency_hospital", "Hospital"),
    "fire_station": ("agency_fire", "Fire Station"),
    "police_station": ("agency_police", "Police Station"),
}
KNOWN_LAYERS = list(GPKG_LAYERS) + ["highways", "north_india_boundary", "user_disaster_areas", "damage_assessment",
                                    "population_density"]
VALID_DAMAGE_LEVELS = ["none", "light", "moderate", "severe", "destroyed"]

_HSTORE = re.compile(r'"((?:[^"\\]|\\.)*)"=>"((?:[^"\\]|\\.)*)"')
_cache = {}
_lock = threading.Lock()
_road_graph = None


def road_graph():
    global _road_graph
    with _lock:
        if _road_graph is None:
            from road_graph import RoadGraph
            _road_graph = RoadGraph()
        return _road_graph


def _clean(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return None if math.isnan(v) else float(v)
    if isinstance(v, (datetime,)):
        return v.isoformat()
    return v


def _parse_other_tags(text):
    if not isinstance(text, str) or not text:
        return {}
    return {k: v for k, v in _HSTORE.findall(text)}


def _load_gdf(layer):
    import geopandas as gpd
    with _lock:
        gdf = _cache.get(layer)
        if gdf is not None:
            return gdf
    if layer == "north_india_boundary":
        gdf = gpd.read_file(BOUNDARY_PATH)
    else:
        gdf = gpd.read_file(GPKG_PATH, layer=GPKG_LAYERS[layer], engine="pyogrio")
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].reset_index(drop=True)
    if layer in ("agency_hospital", "agency_fire", "agency_police"):
        # some facilities are mapped as building outlines in OSM; use one point per facility everywhere
        gdf["geometry"] = gdf.geometry.apply(lambda g: g if g.geom_type == "Point" else g.representative_point())
    if gdf.crs is not None and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)
    gdf.sindex  # build the spatial index now
    with _lock:
        _cache[layer] = gdf
    return gdf


def _facility_props(row, layer):
    tags = _parse_other_tags(row.get("other_tags"))
    ftype = {"agency_hospital": "hospital", "agency_fire": "fire_station", "agency_police": "police_station"}[layer]
    label = {"hospital": "Hospital", "fire_station": "Fire Station", "police_station": "Police Station"}[ftype]
    name = _clean(row.get("name")) or tags.get("name:en") or f"Unnamed {label}"
    props = {"osm_id": _clean(row.get("osm_id")), "name": name, "facility_type": ftype,
             "address": _clean(row.get("address")) or tags.get("addr:full") or tags.get("addr:city") or "",
             "operator": tags.get("operator", ""), "phone": tags.get("phone") or tags.get("contact:phone") or "",
             "capacity": tags.get("beds") or tags.get("capacity") or "", "status": "operational"}
    return props


def _row_props(row, layer, cols):
    if layer in ("agency_hospital", "agency_fire", "agency_police"):
        return _facility_props(row, layer)
    return {c: _clean(row.get(c)) for c in cols if c != "geometry"}


def _frame_to_features(gdf, layer, limit):
    cols = [c for c in gdf.columns if c != gdf.geometry.name]
    feats = []
    for _, row in gdf.head(limit).iterrows():
        feats.append({"type": "Feature", "geometry": mapping(row.geometry), "properties": _row_props(row, layer, cols)})
    return feats


def _collection(features, layer, total=None):
    return {"type": "FeatureCollection", "layer": layer, "features": features,
            "count": len(features), "total_matched": total if total is not None else len(features)}


def _dynamic_features(layer):
    """Layers whose rows are written at runtime (disaster areas, damage)."""
    if layer == "user_disaster_areas":
        import sqlite3
        feats = []
        try:
            with sqlite3.connect(GPKG_PATH, timeout=30) as conn:
                rows = conn.execute("SELECT fid, disaster_type, severity, description, created_at, created_by, "
                                    "geometry_json FROM user_disaster_areas ORDER BY created_at DESC").fetchall()
        except sqlite3.Error:
            rows = []
        for fid, dtype, sev, desc, created, by, geom in rows:
            if not geom:
                continue
            feats.append({"type": "Feature", "geometry": json.loads(geom),
                          "properties": {"id": fid, "disaster_type": dtype, "severity": sev, "description": desc,
                                         "created_at": created, "created_by": by}})
        return feats
    if layer == "damage_assessment":
        return read_damage()["features"]
    return []


def _feature_bounds_hit(feature, bounds):
    try:
        return shape(feature["geometry"]).intersects(bounds)
    except Exception:
        return False


def layer_features(layer, bbox=None, limit=5000):
    """FeatureCollection of a layer, optionally limited to bbox=(west, south, east, north)."""
    if layer not in KNOWN_LAYERS:
        raise KeyError(layer)
    limit = max(1, min(int(limit), 20000))
    window = box(*bbox) if bbox else None
    if layer == "highways":
        g = road_graph()
        if bbox:
            ids = g.edges_in_bbox(*bbox, limit=limit)
        else:
            ids = np.arange(min(limit, g.n_edges))
        return _collection([g.edge_feature(int(e)) for e in ids], layer)
    if layer == "population_density":
        return population_features(bbox, limit)
    if layer in ("user_disaster_areas", "damage_assessment"):
        feats = _dynamic_features(layer)
        if window is not None:
            feats = [f for f in feats if _feature_bounds_hit(f, window)]
        return _collection(feats[:limit], layer, len(feats))
    gdf = _load_gdf(layer)
    if window is not None:
        idx = gdf.sindex.query(window, predicate="intersects")
        gdf = gdf.iloc[np.sort(idx)]
    return _collection(_frame_to_features(gdf, layer, limit), layer, len(gdf))


def layer_within(layer, geometry, limit=2000):
    """Features of a layer that intersect an arbitrary GeoJSON geometry."""
    if layer not in KNOWN_LAYERS:
        raise KeyError(layer)
    limit = max(1, min(int(limit), 20000))
    area = shape(geometry)
    if layer in ("highways", "population_density", "user_disaster_areas", "damage_assessment"):
        feats = layer_features(layer, area.bounds, limit * 4)["features"]
        feats = [f for f in feats if _feature_bounds_hit(f, area)]
        return _collection(feats[:limit], layer, len(feats))
    gdf = _load_gdf(layer)
    idx = gdf.sindex.query(area, predicate="intersects")
    sub = gdf.iloc[np.sort(idx)]
    return _collection(_frame_to_features(sub, layer, limit), layer, len(sub))


def nearby_facilities(lon, lat, facility_type, radius_m=50000, limit=5):
    """Facilities of one type sorted by straight-line distance."""
    layer, _label = FACILITY_LAYERS[facility_type]
    gdf = _load_gdf(layer)
    dlat = radius_m / 111320.0
    dlon = dlat / max(math.cos(math.radians(lat)), 0.2)
    idx = gdf.sindex.query(box(lon - dlon, lat - dlat, lon + dlon, lat + dlat), predicate="intersects")
    sub = gdf.iloc[np.sort(idx)]
    cols = [c for c in gdf.columns if c != gdf.geometry.name]
    out = []
    from road_graph import haversine_m
    for _, row in sub.iterrows():
        p = row.geometry.centroid if row.geometry.geom_type != "Point" else row.geometry
        d = haversine_m(lon, lat, p.x, p.y)
        if d <= radius_m:
            props = _row_props(row, layer, cols)
            props.update({"coordinates": [p.x, p.y], "distance_m": round(d, 1)})
            out.append(props)
    # named facilities first (an "Unnamed Hospital" is a poor dispatch target), then by distance
    out.sort(key=lambda f: (f["name"].startswith("Unnamed"), f["distance_m"]))
    return out[:limit]


# ----------------------------------------------------------------- damage layer
def read_damage():
    with _lock:
        try:
            data = json.loads(DAMAGE_PATH.read_text())
        except (OSError, ValueError):
            data = {"type": "FeatureCollection", "features": []}
    data.setdefault("features", [])
    return data


def add_damage(payload):
    """Validate and store a damage assessment. Returns (ok, result)."""
    errors = []
    level = payload.get("damage_level")
    if level not in VALID_DAMAGE_LEVELS:
        errors.append(f"Invalid damage_level. Must be one of: {VALID_DAMAGE_LEVELS}")
    geom = payload.get("geometry")
    try:
        g = shape(geom)
        if g.is_empty:
            errors.append("Empty geometry")
    except Exception:
        errors.append("Invalid geometry")
    if errors:
        return False, {"success": False, "errors": errors}
    with _lock:
        try:
            data = json.loads(DAMAGE_PATH.read_text())
        except (OSError, ValueError):
            data = {"type": "FeatureCollection", "features": []}
        next_id = max([f["properties"].get("id", 0) for f in data["features"]] + [0]) + 1
        data["features"].append({
            "type": "Feature", "geometry": geom,
            "properties": {"id": next_id, "damage_level": level, "description": str(payload.get("description", ""))[:1000],
                           "created_at": datetime.now().isoformat(), "created_by": str(payload.get("created_by", "web_user"))}})
        RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
        tmp = DAMAGE_PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(data))
        os.replace(tmp, DAMAGE_PATH)
    return True, {"success": True, "damage_id": next_id, "message": "Damage assessment saved"}


# ------------------------------------------------------------ population layer
def population_features(bbox, limit=5000, min_people=50):
    """Population grid cells (centre points) inside bbox, densest cells first."""
    import rasterio
    from rasterio.windows import from_bounds
    if not POPULATION_TIF.exists():
        return _collection([], "population_density")
    west, south, east, north = bbox or (77.0, 24.0, 85.0, 31.0)
    with rasterio.open(POPULATION_TIF) as ds:
        win = from_bounds(west, south, east, north, ds.transform).round_offsets().round_lengths()
        win = win.intersection(rasterio.windows.Window(0, 0, ds.width, ds.height))
        if win.width < 1 or win.height < 1:
            return _collection([], "population_density")
        arr = ds.read(1, window=win, masked=True)
        tr = ds.window_transform(win)
        res_m = abs(ds.res[1]) * 111320.0
    valid = ~np.ma.getmaskarray(arr) & (arr.filled(0) >= min_people)
    rows, cols = np.nonzero(valid)
    vals = arr.filled(0)[rows, cols]
    order = np.argsort(-vals)[:limit]
    feats = []
    for i in order:
        r, c = rows[i], cols[i]
        x, y = tr * (c + 0.5, r + 0.5)
        cell_km2 = (res_m / 1000.0) ** 2 * math.cos(math.radians(y))
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(x, 5), round(y, 5)]},
                      "properties": {"population": int(round(float(vals[i]))),
                                     "population_density": round(float(vals[i]) / cell_km2, 1),
                                     "source": "WorldPop 2020", "cell_size_m": round(res_m)}})
    return _collection(feats, "population_density", int(valid.sum()))
