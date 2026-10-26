#!/usr/bin/env python3
"""Lightweight OGC WMS 1.1.1 / 1.3.0 server (port 8081, path /ows/).

Stand-in for QGIS Server: renders the AEGIS-1 map layers straight from the GeoPackage and
the road graph, so the map works with nothing but Python.  Supports GetCapabilities,
GetMap (EPSG:3857, EPSG:4326, CRS:84; PNG/JPEG) and GetFeatureInfo (GeoJSON / text).

Road data (c) OpenStreetMap contributors, ODbL.
"""
import io
import logging
import math
import os
import sys
from pathlib import Path

import numpy as np
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from PIL import Image, ImageDraw
from shapely.geometry import Point, shape

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geo_layers  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("wms_server")
app = Flask(__name__)
CORS(app)

R = 6378137.0
TITLES = {
    "agency_hospital": "Hospitals", "agency_fire": "Fire Stations", "agency_police": "Police Stations",
    "highways": "Major Highways", "north_india_boundary": "North India Boundary",
    "user_disaster_areas": "User Disaster Areas", "damage_assessment": "Damage Assessment",
    "flood_zones": "Flood Risk Areas", "fire_risk": "Fire Risk Zones", "earthquake_zones": "Earthquake Zones",
    "landslide_zones": "Landslide Zones", "population_density": "Population Density",
}
POINT_STYLE = {"agency_hospital": (255, 71, 87), "agency_fire": (255, 140, 0), "agency_police": (55, 66, 250),
               "population_density": (255, 165, 2)}
POLY_STYLE = {"flood_zones": (30, 144, 255), "fire_risk": (255, 99, 72), "earthquake_zones": (155, 89, 182),
              "landslide_zones": (160, 110, 60), "user_disaster_areas": (255, 71, 87), "damage_assessment": (255, 165, 2),
              "north_india_boundary": (0, 206, 209)}
ROAD_STYLE = {0: ((232, 65, 24), 3), 1: ((243, 156, 18), 3), 2: ((253, 203, 110), 2), 3: ((223, 228, 234), 1),
              4: ((178, 190, 195), 1)}
DAMAGE_COLORS = {"none": (46, 213, 115), "light": (255, 165, 2), "moderate": (255, 99, 72), "severe": (255, 71, 87),
                 "destroyed": (30, 39, 46)}
SEVERITY_COLORS = {"Low": (46, 213, 115), "Medium": (255, 165, 2), "High": (255, 99, 72), "Critical": (255, 71, 87)}
RISK_COLORS = {"low": (46, 213, 115), "medium": (255, 165, 2), "high": (255, 99, 72), "very high": (192, 57, 43)}


def _xml_error(code, message, status=400):
    xml = ('<?xml version="1.0" encoding="UTF-8"?><ServiceExceptionReport version="1.3.0" '
           'xmlns="http://www.opengis.net/ogc"><ServiceException code="%s">%s</ServiceException>'
           '</ServiceExceptionReport>' % (code, message))
    return Response(xml, status=status, mimetype="text/xml")


def _param(name, default=None):
    for k, v in request.args.items():
        if k.upper() == name:
            return v
    return default


# ------------------------------------------------------------------ projection
class View:
    def __init__(self, crs, version, bbox, width, height):
        self.crs, self.w, self.h = crs, width, height
        a, b, c, d = bbox
        if crs == "EPSG:4326" and version == "1.3.0":  # axis order lat,lon
            a, b, c, d = b, a, d, c
        self.minx, self.miny, self.maxx, self.maxy = a, b, c, d
        if crs == "EPSG:3857":
            self.west, self.south = self._inv(a, b)
            self.east, self.north = self._inv(c, d)
        else:
            self.west, self.south, self.east, self.north = a, b, c, d

    @staticmethod
    def _inv(x, y):
        return math.degrees(x / R), math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2)

    def px(self, lon, lat):
        lon, lat = np.asarray(lon, float), np.asarray(lat, float)
        if self.crs == "EPSG:3857":
            X = np.radians(lon) * R
            Y = np.log(np.tan(np.pi / 4 + np.radians(np.clip(lat, -85, 85)) / 2)) * R
        else:
            X, Y = lon, lat
        return (X - self.minx) / (self.maxx - self.minx) * self.w, (self.maxy - Y) / (self.maxy - self.miny) * self.h

    def lonlat(self, x, y):
        X = self.minx + x / self.w * (self.maxx - self.minx)
        Y = self.maxy - y / self.h * (self.maxy - self.miny)
        return self._inv(X, Y) if self.crs == "EPSG:3857" else (X, Y)

    @property
    def bbox_ll(self):
        return (self.west, self.south, self.east, self.north)

    @property
    def width_deg(self):
        return self.east - self.west


# ------------------------------------------------------------------- rendering
def _poly_color(layer, props):
    base = POLY_STYLE.get(layer, (255, 255, 255))
    if layer == "damage_assessment":
        return DAMAGE_COLORS.get(props.get("damage_level"), base)
    if layer == "user_disaster_areas":
        return SEVERITY_COLORS.get(props.get("severity"), base)
    risk = str(props.get("risk_level", "")).lower()
    return RISK_COLORS.get(risk, base) if layer.endswith(("_zones", "_risk")) and risk else base


def _draw_geometry(draw, geom, view, layer, props, scale):
    t = geom["type"]
    if t == "Point":
        x, y = view.px(geom["coordinates"][0], geom["coordinates"][1])
        col = POINT_STYLE.get(layer, (255, 255, 255))
        r = 5 * scale if layer != "population_density" else 4 * scale
        draw.ellipse([x - r, y - r, x + r, y + r], fill=col + (235,), outline=(255, 255, 255, 255), width=max(1, int(scale)))
    elif t == "MultiPoint":
        for c in geom["coordinates"]:
            _draw_geometry(draw, {"type": "Point", "coordinates": c}, view, layer, props, scale)
    elif t in ("LineString", "MultiLineString"):
        lines = [geom["coordinates"]] if t == "LineString" else geom["coordinates"]
        col = _poly_color(layer, props) if layer in POLY_STYLE else (255, 255, 255)
        for ln in lines:
            a = np.array(ln)
            xs, ys = view.px(a[:, 0], a[:, 1])
            draw.line(list(zip(xs, ys)), fill=col + (230,), width=max(1, int(2 * scale)))
    elif t in ("Polygon", "MultiPolygon"):
        polys = [geom["coordinates"]] if t == "Polygon" else geom["coordinates"]
        col = _poly_color(layer, props)
        outline_only = layer == "north_india_boundary"
        for poly in polys:
            for ring_i, ring in enumerate(poly):
                a = np.array(ring)
                xs, ys = view.px(a[:, 0], a[:, 1])
                pts = list(zip(xs, ys))
                if ring_i == 0 and not outline_only:
                    draw.polygon(pts, fill=col + (90,), outline=col + (235,))
                    draw.line(pts, fill=col + (235,), width=max(1, int(2 * scale)))
                else:
                    draw.line(pts, fill=col + (235,), width=max(1, int(2 * scale)))
    elif t == "GeometryCollection":
        for g in geom["geometries"]:
            _draw_geometry(draw, g, view, layer, props, scale)


def _render_layer(layer, view):
    img = Image.new("RGBA", (view.w, view.h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    scale = 1 if view.w <= 300 else 1.25 if view.w <= 600 else 1.5
    if layer == "highways":
        g = geo_layers.road_graph()
        wd = view.width_deg * (256.0 / view.w)  # degrees per 256 px tile
        classes = [0, 1] if wd > 2 else [0, 1, 2] if wd > 0.6 else [0, 1, 2, 3] if wd > 0.2 else [0, 1, 2, 3, 4]
        ids = g.edges_in_bbox(*view.bbox_ll, classes=classes, limit=12000)
        for e in sorted(ids.tolist(), key=lambda i: -int(g.cls[i])):  # draw major roads last (on top)
            col, wpx = ROAD_STYLE[int(g.cls[e])]
            c = g.edge_coords(e)
            xs, ys = view.px(c[:, 0], c[:, 1])
            draw.line(list(zip(xs, ys)), fill=col + (235,), width=max(1, int(wpx * scale)))
        return img
    data = geo_layers.layer_features(layer, view.bbox_ll, limit=20000)
    for f in data["features"]:
        _draw_geometry(draw, f["geometry"], view, layer, f["properties"], scale)
    return img


def _parse_view():
    version = _param("VERSION", "1.3.0")
    crs = (_param("CRS") or _param("SRS") or "EPSG:3857").upper()
    if crs in ("CRS:84", "OGC:CRS84"):
        crs, version = "EPSG:4326", "1.1.1"  # lon,lat order
    if crs not in ("EPSG:3857", "EPSG:900913", "EPSG:4326"):
        raise ValueError(f"Unsupported CRS {crs}")
    crs = "EPSG:3857" if crs == "EPSG:900913" else crs
    try:
        bbox = [float(x) for x in _param("BBOX", "").split(",")]
        width, height = int(_param("WIDTH")), int(_param("HEIGHT"))
    except (TypeError, ValueError):
        raise ValueError("BBOX, WIDTH and HEIGHT are required")
    if len(bbox) != 4 or not (1 <= width <= 4096 and 1 <= height <= 4096):
        raise ValueError("Invalid BBOX/WIDTH/HEIGHT")
    return View(crs, version, bbox, width, height)


def _layer_list(param_name="LAYERS"):
    names = [n.strip() for n in (_param(param_name, "") or "").split(",") if n.strip()]
    unknown = [n for n in names if n not in geo_layers.KNOWN_LAYERS]
    return names, unknown


@app.route("/ows/", methods=["GET"])
@app.route("/ows", methods=["GET"])
def ows():
    req = (_param("REQUEST", "") or "").lower()
    if req == "getcapabilities":
        return capabilities()
    if req == "getmap":
        return get_map()
    if req in ("getfeatureinfo",):
        return get_feature_info()
    return _xml_error("OperationNotSupported", f"Unsupported REQUEST '{req}'")


def capabilities():
    version = _param("VERSION", "1.3.0")
    base = request.base_url
    layers = "".join(
        f"<Layer queryable=\"1\"><Name>{n}</Name><Title>{TITLES.get(n, n)}</Title>"
        "<CRS>EPSG:3857</CRS><CRS>EPSG:4326</CRS><CRS>CRS:84</CRS>"
        "<EX_GeographicBoundingBox><westBoundLongitude>72</westBoundLongitude><eastBoundLongitude>88"
        "</eastBoundLongitude><southBoundLatitude>24</southBoundLatitude><northBoundLatitude>32</northBoundLatitude>"
        "</EX_GeographicBoundingBox></Layer>" for n in geo_layers.KNOWN_LAYERS)
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="{version}" xmlns="http://www.opengis.net/wms" xmlns:xlink="http://www.w3.org/1999/xlink">
<Service><Name>WMS</Name><Title>AEGIS-1 Disaster Response Map Service</Title>
<Abstract>Road data (c) OpenStreetMap contributors, ODbL.</Abstract></Service>
<Capability><Request>
<GetCapabilities><Format>text/xml</Format><DCPType><HTTP><Get><OnlineResource xlink:href="{base}"/></Get></HTTP></DCPType></GetCapabilities>
<GetMap><Format>image/png</Format><Format>image/jpeg</Format><DCPType><HTTP><Get><OnlineResource xlink:href="{base}"/></Get></HTTP></DCPType></GetMap>
<GetFeatureInfo><Format>application/json</Format><Format>text/plain</Format><DCPType><HTTP><Get><OnlineResource xlink:href="{base}"/></Get></HTTP></DCPType></GetFeatureInfo>
</Request><Exception><Format>XML</Format></Exception>
<Layer><Title>AEGIS-1</Title><CRS>EPSG:3857</CRS><CRS>EPSG:4326</CRS>{layers}</Layer></Capability></WMS_Capabilities>"""
    return Response(xml, mimetype="text/xml")


def get_map():
    try:
        view = _parse_view()
    except ValueError as exc:
        return _xml_error("InvalidParameterValue", str(exc))
    names, unknown = _layer_list()
    if not names:
        return _xml_error("LayerNotDefined", "LAYERS is required")
    if unknown:
        return _xml_error("LayerNotDefined", f"Layer '{unknown[0]}' is not defined")
    canvas = Image.new("RGBA", (view.w, view.h), (0, 0, 0, 0))
    for n in names:
        try:
            canvas = Image.alpha_composite(canvas, _render_layer(n, view))
        except Exception:
            logger.exception("render failed for %s", n)
    fmt = (_param("FORMAT", "image/png") or "image/png").lower()
    out = io.BytesIO()
    if "jpeg" in fmt or "jpg" in fmt:
        bg = Image.new("RGB", canvas.size, (255, 255, 255))
        bg.paste(canvas, mask=canvas.split()[3])
        bg.save(out, "JPEG", quality=85)
        mime = "image/jpeg"
    else:
        canvas.save(out, "PNG", optimize=False)
        mime = "image/png"
    resp = Response(out.getvalue(), mimetype=mime)
    resp.headers["Cache-Control"] = "public, max-age=30"
    return resp


def get_feature_info():
    try:
        view = _parse_view()
        i = float(_param("I") or _param("X"))
        j = float(_param("J") or _param("Y"))
    except (ValueError, TypeError):
        return _xml_error("InvalidPoint", "BBOX, WIDTH, HEIGHT and I/J (pixel) are required")
    names, unknown = _layer_list("QUERY_LAYERS")
    if not names:
        names, unknown = _layer_list("LAYERS")
    if unknown:
        return _xml_error("LayerNotDefined", f"Layer '{unknown[0]}' is not defined")
    tol_px = 10
    lon, lat = view.lonlat(i, j)
    lon2, lat2 = view.lonlat(i + tol_px, j + tol_px)
    tol_deg = max(abs(lon2 - lon), abs(lat2 - lat))
    click = Point(lon, lat)
    box_ll = (lon - tol_deg, lat - tol_deg, lon + tol_deg, lat + tol_deg)
    feats = []
    for n in names:
        if n == "highways":
            g = geo_layers.road_graph()
            ids = g.edges_in_bbox(*box_ll, limit=500)
            cand = [g.edge_feature(int(e)) for e in ids]
        else:
            cand = geo_layers.layer_features(n, box_ll, limit=2000)["features"]
        hits = []
        for f in cand:
            try:
                d = shape(f["geometry"]).distance(click)
            except Exception:
                continue
            if d <= tol_deg:
                hits.append((d, f))
        for _d, f in sorted(hits, key=lambda x: x[0])[:10]:
            feats.append({"type": "Feature", "layer": n, "geometry": f["geometry"], "properties": f["properties"]})
    fmt = (_param("INFO_FORMAT", "application/json") or "").lower()
    if "json" in fmt:
        return jsonify({"type": "FeatureCollection", "features": feats})
    text = "\n".join(f"[{f['layer']}] " + ", ".join(f"{k}={v}" for k, v in f["properties"].items()) for f in feats)
    return Response(text or "No features", mimetype="text/plain")


@app.route("/health")
def health():
    return jsonify({"status": "healthy", "service": "wms-server", "layers": geo_layers.KNOWN_LAYERS})


if __name__ == "__main__":
    port = int(os.environ.get("WMS_PORT", 8081))
    print(f"AEGIS-1 WMS server on http://0.0.0.0:{port}/ows/")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
