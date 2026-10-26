"""Build the compact road graph used by routing_api.py from an OpenStreetMap extract.

Reads ways tagged highway=motorway/trunk/primary/secondary/tertiary (+ links),
splits them at junctions (OSM nodes shared by two or more ways, and way ends),
and stores directed-edge data in a single compressed .npz file:

    nodes      (N, 2)  float64  lon, lat of junction nodes
    edge_u     (E,)    int32    start node index
    edge_v     (E,)    int32    end node index
    oneway     (E,)    int8     1 = only u->v, 0 = both directions
    length_m   (E,)    float32
    speed_kph  (E,)    float32
    cls        (E,)    uint8    road class (see CLASSES)
    name_idx   (E,)    int32    index into `names`
    geom_off   (E+1,)  int32    offsets into geom_xy
    geom_xy    (M, 2)  int32    lon/lat * 1e5 (about 1 m precision)
    names      (K,)    str

Usage:
    pip install osmium shapely numpy
    python build_road_graph.py INPUT.osm.pbf OUTPUT.npz

Data (c) OpenStreetMap contributors, ODbL.
"""
import sys
import time
from collections import Counter

import numpy as np
import osmium
from shapely.geometry import LineString

CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary"]
MAIN = {c: i for i, c in enumerate(CLASSES)}
# default speeds for Indian roads (km/h) when maxspeed is missing
DEFAULT_SPEED = {0: 70.0, 1: 55.0, 2: 45.0, 3: 40.0, 4: 35.0}
LINK_FACTOR = 0.7
SIMPLIFY_DEG = 0.00003  # ~3 m


def haversine_m(lon1, lat1, lon2, lat2):
    r = 6371008.8
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi, dl = p2 - p1, np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(a))


def parse_speed(v):
    if not v:
        return None
    try:
        s = v.split(";")[0].strip().lower()
        if s.endswith("mph"):
            return float(s[:-3]) * 1.609
        return float(s.split()[0])
    except ValueError:
        return None


def main(src, dst):
    t0 = time.time()
    ways = []  # (cls, link, oneway, speed, name, [(node_id, lon, lat), ...])
    node_use = Counter()
    survey = Counter()

    fp = osmium.FileProcessor(src, osmium.osm.NODE | osmium.osm.WAY).with_locations().with_filter(osmium.filter.KeyFilter("highway"))
    for w in fp:
        if not isinstance(w, osmium.osm.Way):
            continue  # nodes are only read to resolve way coordinates
        hw = w.tags.get("highway")
        base = hw[:-5] if hw and hw.endswith("_link") else hw
        if base not in MAIN:
            continue
        if w.tags.get("access") in ("no", "private") or w.tags.get("area") == "yes":
            continue
        pts = []
        for n in w.nodes:
            if n.location.valid():
                pts.append((n.ref, n.lon, n.lat))
        if len(pts) < 2:
            continue
        ow = w.tags.get("oneway", "")
        junction = w.tags.get("junction", "")
        if ow in ("yes", "true", "1") or junction in ("roundabout", "circular"):
            oneway = 1
        elif ow == "-1":
            oneway = 1
            pts.reverse()
        else:
            oneway = 0
        spd = parse_speed(w.tags.get("maxspeed"))
        name = w.tags.get("name") or w.tags.get("ref") or ""
        ways.append((MAIN[base], hw.endswith("_link"), oneway, spd, name, pts))
        for ref, _, _ in pts:
            node_use[ref] += 1
        node_use[pts[0][0]] += 1
        node_use[pts[-1][0]] += 1
        survey[int(pts[0][1])] += 1
    print(f"read {len(ways)} ways in {time.time() - t0:.0f}s; longitude histogram (deg: ways): "
          f"{dict(sorted(survey.items()))}")

    junction_ids = {ref for ref, c in node_use.items() if c >= 2}
    node_index = {}
    nodes = []
    names = [""]
    name_idx_map = {"": 0}
    e_u, e_v, e_ow, e_len, e_spd, e_cls, e_name = [], [], [], [], [], [], []
    geoms = []

    def nid(ref, lon, lat):
        i = node_index.get(ref)
        if i is None:
            i = len(nodes)
            node_index[ref] = i
            nodes.append((lon, lat))
        return i

    for cls, link, oneway, spd, name, pts in ways:
        speed = spd or DEFAULT_SPEED[cls] * (LINK_FACTOR if link else 1.0)
        if name not in name_idx_map:
            name_idx_map[name] = len(names)
            names.append(name)
        start = 0
        for k in range(1, len(pts)):
            if pts[k][0] in junction_ids or k == len(pts) - 1:
                seg = pts[start:k + 1]
                if len(seg) >= 2 and seg[0][0] != seg[-1][0] or len(seg) > 2:
                    xs = np.array([p[1] for p in seg])
                    ys = np.array([p[2] for p in seg])
                    length = float(haversine_m(xs[:-1], ys[:-1], xs[1:], ys[1:]).sum())
                    if length > 0.5:
                        line = LineString(np.column_stack([xs, ys]))
                        simp = line.simplify(SIMPLIFY_DEG, preserve_topology=False) if len(seg) > 2 else line
                        c = np.asarray(simp.coords)
                        e_u.append(nid(*seg[0]))
                        e_v.append(nid(*seg[-1]))
                        e_ow.append(oneway)
                        e_len.append(length)
                        e_spd.append(speed)
                        e_cls.append(cls)
                        e_name.append(name_idx_map[name])
                        geoms.append(np.rint(c * 1e5).astype(np.int32))
                start = k

    off = np.zeros(len(geoms) + 1, dtype=np.int32)
    off[1:] = np.cumsum([len(g) for g in geoms])
    np.savez_compressed(
        dst,
        nodes=np.array(nodes, dtype=np.float64),
        edge_u=np.array(e_u, dtype=np.int32), edge_v=np.array(e_v, dtype=np.int32),
        oneway=np.array(e_ow, dtype=np.int8), length_m=np.array(e_len, dtype=np.float32),
        speed_kph=np.array(e_spd, dtype=np.float32), cls=np.array(e_cls, dtype=np.uint8),
        name_idx=np.array(e_name, dtype=np.int32), geom_off=off, geom_xy=np.concatenate(geoms),
        names=np.array(names, dtype=str),
    )
    print(f"nodes {len(nodes)}, edges {len(e_u)}, total {sum(e_len) / 1000:,.0f} km, wrote {dst} in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
