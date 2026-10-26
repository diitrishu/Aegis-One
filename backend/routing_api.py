#!/usr/bin/env python3
"""AEGIS-1 routing API (port 8082).

OSRM-compatible JSON for the frontend, served from the bundled OpenStreetMap road graph
(backend/data/routing/road_graph_up.npz).  No routing engine or database to install.

    POST /route            {start:[lon,lat], end:[lon,lat], profile, alternatives, route_type}
    POST /route-multi      {waypoints:[[lon,lat], ...], profile, route_type}
    POST /emergency-route  {incident:[lon,lat], facility_type, max_facilities, max_distance, vehicle_profile}
    POST /facilities       {location:[lon,lat], facility_type, radius, limit}
    GET  /health

Road data (c) OpenStreetMap contributors, ODbL.
"""
import logging
import os
import sys
import time
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geo_layers  # noqa: E402
from road_graph import NoRoute  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("routing_api")
app = Flask(__name__)
CORS(app)

ROUTE_TYPES = {"fastest", "shortest", "safest", "emergency"}
FACILITY_PRIORITY = {"hospital": 1, "fire_station": 1, "police_station": 1}
FACILITY_VEHICLE = {"hospital": "ambulance", "fire_station": "fire_truck", "police_station": "police"}


def _point(value, name):
    """Accept [lon, lat] or {lat, lon|lng}."""
    try:
        if isinstance(value, dict):
            lon = value.get("lon", value.get("lng", value.get("longitude")))
            lat = value.get("lat", value.get("latitude"))
        else:
            lon, lat = value[0], value[1]
        lon, lat = float(lon), float(lat)
    except (TypeError, ValueError, IndexError, KeyError):
        raise ValueError(f"{name} must be [lon, lat]")
    if not (-180 <= lon <= 180 and -90 <= lat <= 90):
        raise ValueError(f"{name} is outside valid coordinates")
    return [lon, lat]


def _public(route):
    return {k: route[k] for k in ("geometry", "distance", "duration", "instructions")}


def _overlap(a, b):
    sa, sb = set(a), set(b)
    return len(sa & sb) / max(1, min(len(sa), len(sb)))


def _compute(graph, start, end, route_type, vehicle, alternatives):
    best = graph.route(start, end, route_type, vehicle)
    routes = [best]
    if alternatives and len(best["edges"]) > 3:
        pen = {e: 3.0 for e in best["edges"]}
        try:
            alt = graph.route(start, end, route_type, vehicle, penalties=pen)
            if alt["edges"] != best["edges"] and _overlap(best["edges"], alt["edges"]) < 0.85 \
                    and alt["duration"] <= best["duration"] * 1.8:
                routes.append(alt)
        except NoRoute:
            pass
    return routes


def _error(code, message, status):
    return jsonify({"code": code, "message": message, "routes": [], "waypoints": []}), status


@app.route("/health")
def health():
    g = geo_layers.road_graph()
    return jsonify({"status": "healthy", "service": "routing-api", "engine": "osm-graph",
                    "nodes": g.n_nodes, "edges": g.n_edges, "timestamp": time.time()})


@app.route("/route", methods=["POST"])
def route():
    body = request.get_json(silent=True) or {}
    try:
        start, end = _point(body.get("start"), "start"), _point(body.get("end"), "end")
    except ValueError as exc:
        return _error("InvalidInput", str(exc), 400)
    route_type = body.get("route_type") if body.get("route_type") in ROUTE_TYPES else "fastest"
    vehicle = body.get("profile", "driving")
    g = geo_layers.road_graph()
    try:
        routes = _compute(g, start, end, route_type, vehicle, bool(body.get("alternatives")))
    except NoRoute as exc:
        return _error("NoRoute", str(exc), 200)
    first = routes[0]
    return jsonify({
        "code": "Ok", "routes": [_public(r) for r in routes],
        "waypoints": [{"location": first["snapped"]["start"]["location"], "name": first["snapped"]["start"]["name"],
                       "distance": first["snapped"]["start"]["distance"]},
                      {"location": first["snapped"]["end"]["location"], "name": first["snapped"]["end"]["name"],
                       "distance": first["snapped"]["end"]["distance"]}],
        "route_type": route_type,
        "attribution": "Road data (c) OpenStreetMap contributors"})


@app.route("/route-multi", methods=["POST"])
def route_multi():
    body = request.get_json(silent=True) or {}
    wps = body.get("waypoints")
    if not isinstance(wps, list) or len(wps) < 2 or len(wps) > 25:
        return _error("InvalidInput", "waypoints must contain 2-25 points", 400)
    try:
        pts = [_point(p, f"waypoints[{i}]") for i, p in enumerate(wps)]
    except ValueError as exc:
        return _error("InvalidInput", str(exc), 400)
    route_type = body.get("route_type") if body.get("route_type") in ROUTE_TYPES else "fastest"
    vehicle = body.get("profile", "driving")
    g = geo_layers.road_graph()
    coords, steps, dist, dur, legs, snapped = [], [], 0.0, 0.0, [], []
    try:
        for a, b in zip(pts[:-1], pts[1:]):
            leg = g.route(a, b, route_type, vehicle)
            seg = leg["geometry"]["coordinates"]
            coords.extend(seg if not coords else seg[1:])
            if steps:
                steps.pop()  # drop the intermediate "arrive" step
            steps.extend(leg["instructions"])
            dist += leg["distance"]
            dur += leg["duration"]
            legs.append({"distance": leg["distance"], "duration": leg["duration"]})
            snapped.append(leg["snapped"]["start"])
        snapped.append(leg["snapped"]["end"])
    except NoRoute as exc:
        return _error("NoRoute", str(exc), 200)
    return jsonify({
        "code": "Ok",
        "routes": [{"geometry": {"type": "LineString", "coordinates": coords}, "distance": round(dist, 1),
                    "duration": round(dur, 1), "instructions": steps, "legs": legs}],
        "waypoints": [{"location": s["location"], "name": s["name"], "distance": s["distance"]} for s in snapped]})


def _facility_payload(f, ftype):
    return {"id": f.get("osm_id") or f"{ftype}-{f['coordinates'][0]:.4f}-{f['coordinates'][1]:.4f}",
            "name": f["name"], "coordinates": f["coordinates"], "priority": FACILITY_PRIORITY[ftype], "type": ftype,
            "capacity": f.get("capacity") or "", "contact_info": f.get("phone") or "", "address": f.get("address") or "",
            "distance_m": f["distance_m"]}


@app.route("/facilities", methods=["POST"])
def facilities():
    body = request.get_json(silent=True) or {}
    ftype = body.get("facility_type", "hospital")
    if ftype not in geo_layers.FACILITY_LAYERS:
        return jsonify({"success": False, "error": f"facility_type must be one of {list(geo_layers.FACILITY_LAYERS)}",
                        "facilities": []}), 400
    try:
        lon, lat = _point(body.get("location"), "location")
        radius = float(body.get("radius", 50000))
        limit = max(1, min(int(body.get("limit", 5)), 50))
    except (ValueError, TypeError) as exc:
        return jsonify({"success": False, "error": str(exc), "facilities": []}), 400
    found = geo_layers.nearby_facilities(lon, lat, ftype, radius, limit)
    return jsonify({"success": True, "count": len(found), "facilities": [_facility_payload(f, ftype) for f in found]})


@app.route("/emergency-route", methods=["POST"])
def emergency_route():
    body = request.get_json(silent=True) or {}
    ftype = body.get("facility_type", "hospital")
    if ftype not in geo_layers.FACILITY_LAYERS:
        return _error("InvalidInput", f"facility_type must be one of {list(geo_layers.FACILITY_LAYERS)}", 400)
    try:
        lon, lat = _point(body.get("incident"), "incident")
        max_f = max(1, min(int(body.get("max_facilities", 3)), 10))
        max_d = float(body.get("max_distance", 50000))
    except (ValueError, TypeError) as exc:
        return _error("InvalidInput", str(exc), 400)
    vehicle = body.get("vehicle_profile") or FACILITY_VEHICLE[ftype]
    if vehicle == "driving":
        vehicle = FACILITY_VEHICLE[ftype]
    g = geo_layers.road_graph()
    if body.get("facility_coordinates"):  # caller picked one specific facility
        try:
            fx, fy = _point(body["facility_coordinates"], "facility_coordinates")
        except ValueError as exc:
            return _error("InvalidInput", str(exc), 400)
        from road_graph import haversine_m
        candidates = [f for f in geo_layers.nearby_facilities(fx, fy, ftype, 150, 5)] or [
            {"name": "Selected facility", "coordinates": [fx, fy], "distance_m": round(haversine_m(lon, lat, fx, fy), 1)}]
        for f in candidates:
            f["distance_m"] = round(haversine_m(lon, lat, f["coordinates"][0], f["coordinates"][1]), 1)
        candidates = candidates[:1]
    else:
        candidates = geo_layers.nearby_facilities(lon, lat, ftype, max_d, max_f * 3)
    results = []
    for f in candidates:
        try:
            r = g.route([lon, lat], f["coordinates"], "emergency", vehicle)
        except NoRoute:
            continue
        results.append({"route": _public(r), "facility": _facility_payload(f, ftype),
                        "response_time_minutes": round(r["duration"] / 60.0, 1), "priority": FACILITY_PRIORITY[ftype],
                        "vehicle_type": vehicle})
    results.sort(key=lambda x: x["response_time_minutes"])
    results = results[:max_f]
    if not results:
        return _error("NoRoute", f"No reachable {ftype.replace('_', ' ')} within {max_d / 1000:.0f} km", 200)
    return jsonify({"code": "Ok", "routes": results})


if __name__ == "__main__":
    port = int(os.environ.get("ROUTING_PORT", 8082))
    print(f"AEGIS-1 routing API on http://0.0.0.0:{port}")
    geo_layers.road_graph()  # fail fast if the graph file is missing
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
