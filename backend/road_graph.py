"""Road network used by the routing API and the highways map layer.

The graph is built from OpenStreetMap by scripts/build_road_graph.py and stored in
data/routing/road_graph_up.npz.  Everything here is plain numpy + scipy + heapq, so
no routing engine (OSRM, pgRouting) has to be installed.

Data (c) OpenStreetMap contributors, ODbL.
"""
import heapq
import math
import os
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

CLASS_NAMES = ["motorway", "trunk", "primary", "secondary", "tertiary"]
# multiplier applied to travel time when the "safest" profile prefers major roads
SAFETY_PENALTY = [1.0, 1.0, 1.05, 1.25, 1.5]
EMERGENCY_SPEED_FACTOR = 1.25  # sirens: faster than normal traffic, capped below
VEHICLE_SPEED_FACTOR = {"driving": 1.0, "car": 1.0, "ambulance": 1.15, "fire_truck": 1.0, "police": 1.2}
EARTH_R = 6371008.8
DEFAULT_GRAPH = Path(__file__).resolve().parent / "data" / "routing" / "road_graph_up.npz"


def haversine_m(lon1, lat1, lon2, lat2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * EARTH_R * math.asin(min(1.0, math.sqrt(a)))


def bearing(lon1, lat1, lon2, lat2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def compass(b):
    return ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"][int((b + 22.5) // 45) % 8]


def turn_instruction(prev_bearing, new_bearing):
    """Return (type, modifier) for a change of heading."""
    d = (new_bearing - prev_bearing + 540) % 360 - 180  # -180..180, + = right
    a = abs(d)
    if a < 20:
        return "continue", "straight"
    side = "right" if d > 0 else "left"
    if a < 60:
        return "turn", f"slight {side}"
    if a < 120:
        return "turn", side
    if a < 160:
        return "turn", f"sharp {side}"
    return "turn", "uturn"


class NoRoute(Exception):
    pass


class RoadGraph:
    def __init__(self, path=None):
        path = Path(path or os.environ.get("ROAD_GRAPH_PATH") or DEFAULT_GRAPH)
        if not path.exists():
            raise FileNotFoundError(
                f"Road graph not found at {path}. Build it with backend/scripts/build_road_graph.py "
                "(see README) or restore backend/data/routing/road_graph_up.npz")
        d = np.load(path, allow_pickle=False)
        self.nodes = d["nodes"]
        self.eu = d["edge_u"].astype(np.int64)
        self.ev = d["edge_v"].astype(np.int64)
        self.oneway = d["oneway"].astype(bool)
        self.length = d["length_m"].astype(np.float64)
        self.speed = d["speed_kph"].astype(np.float64)
        self.cls = d["cls"].astype(np.int64)
        self.name_idx = d["name_idx"]
        self.names = d["names"]
        self.geom_off = d["geom_off"].astype(np.int64)
        self.geom_xy = d["geom_xy"].astype(np.float64) / 1e5
        self.n_nodes, self.n_edges = len(self.nodes), len(self.eu)
        self.lat0 = float(np.mean(self.nodes[:, 1]))
        self.kx = math.cos(math.radians(self.lat0))
        self._build_adjacency()
        vert_edge = np.repeat(np.arange(self.n_edges), np.diff(self.geom_off))
        self._vert_edge = vert_edge
        # Points are only snapped onto the largest strongly connected part of the network (every road
        # in it can reach every other, respecting one-ways), so a start or end point can never land on
        # an isolated fragment or a one-way spur you can enter but not leave.
        from scipy.sparse import coo_matrix
        from scipy.sparse.csgraph import connected_components
        _, comp = connected_components(coo_matrix((np.ones(len(self.arc_from)), (self.arc_from, self.arc_to)),
                                                  shape=(self.n_nodes, self.n_nodes)),
                                       directed=True, connection="strong")
        big = np.bincount(comp).argmax()
        self.main_edge = (comp[self.eu] == big) & (comp[self.ev] == big)
        keep = self.main_edge[vert_edge]
        self._snap_edge = vert_edge[keep]
        self._tree = cKDTree(np.column_stack([self.geom_xy[keep, 0] * self.kx, self.geom_xy[keep, 1]]))
        self._costs = {}
        self.bounds = (float(self.nodes[:, 0].min()), float(self.nodes[:, 1].min()),
                       float(self.nodes[:, 0].max()), float(self.nodes[:, 1].max()))
        self.max_speed_ms = max(float(self.speed.max()) * 1.4, 110.0) / 3.6

    # ------------------------------------------------------------------ graph
    def _build_adjacency(self):
        fwd = np.arange(self.n_edges)
        bwd = fwd[~self.oneway]
        a_from = np.concatenate([self.eu[fwd], self.ev[bwd]])
        a_to = np.concatenate([self.ev[fwd], self.eu[bwd]])
        a_edge = np.concatenate([fwd, bwd])
        a_rev = np.concatenate([np.zeros(len(fwd), bool), np.ones(len(bwd), bool)])
        order = np.argsort(a_from, kind="stable")
        self.arc_from, self.arc_to = a_from[order], a_to[order]
        self.arc_edge, self.arc_rev = a_edge[order], a_rev[order]
        counts = np.bincount(self.arc_from, minlength=self.n_nodes)
        self.indptr = np.concatenate([[0], np.cumsum(counts)]).tolist()
        self.arc_to_l = self.arc_to.tolist()
        self.arc_edge_l = self.arc_edge.tolist()

    def edge_cost_array(self, route_type, vehicle="driving"):
        """Seconds (or metres for 'shortest') per edge for the given routing preference."""
        key = (route_type, vehicle)
        if key in self._costs:
            return self._costs[key]
        speed = self.speed.copy()
        vf = VEHICLE_SPEED_FACTOR.get(vehicle, 1.0)
        if route_type == "emergency":
            vf = max(vf, EMERGENCY_SPEED_FACTOR)
        speed = np.minimum(speed * vf, 110.0)
        secs = self.length / (speed / 3.6)
        if route_type == "shortest":
            cost = self.length.copy()
        elif route_type == "safest":
            cost = secs * np.array(SAFETY_PENALTY)[self.cls]
        else:
            cost = secs
        out = (cost.tolist(), secs.tolist())
        self._costs[key] = out
        return out

    # --------------------------------------------------------------- geometry
    def edge_coords(self, e, reverse=False):
        c = self.geom_xy[self.geom_off[e]:self.geom_off[e + 1]]
        return c[::-1] if reverse else c

    def edge_name(self, e):
        return str(self.names[self.name_idx[e]])

    def snap(self, lon, lat, max_m=5000.0, k=16):
        """Nearest point on the road network: dict(edge, pos_m, point, dist_m)."""
        dist_deg, idx = self._tree.query([lon * self.kx, lat], k=k)
        best = None
        for i in np.atleast_1d(idx):
            if i >= len(self._snap_edge):
                continue
            e = int(self._snap_edge[i])
            if best is not None and best["edge"] == e:
                continue
            cand = self._project(e, lon, lat)
            if best is None or cand["dist_m"] < best["dist_m"]:
                best = cand
        if best is None or best["dist_m"] > max_m:
            raise NoRoute(f"No road within {max_m / 1000:.0f} km of ({lat:.4f}, {lon:.4f})")
        return best

    def _project(self, e, lon, lat):
        c = self.geom_xy[self.geom_off[e]:self.geom_off[e + 1]]
        px, py = lon * self.kx, lat
        x, y = c[:, 0] * self.kx, c[:, 1]
        dx, dy = np.diff(x), np.diff(y)
        seg2 = dx * dx + dy * dy
        t = np.where(seg2 > 0, ((px - x[:-1]) * dx + (py - y[:-1]) * dy) / np.where(seg2 > 0, seg2, 1), 0)
        t = np.clip(t, 0, 1)
        qx, qy = x[:-1] + t * dx, y[:-1] + t * dy
        d2 = (qx - px) ** 2 + (qy - py) ** 2
        s = int(np.argmin(d2))
        point = (float(qx[s] / self.kx), float(qy[s]))
        seg_len = np.array([haversine_m(c[i, 0], c[i, 1], c[i + 1, 0], c[i + 1, 1]) for i in range(len(c) - 1)])
        poly_len = float(seg_len.sum())
        along = float(seg_len[:s].sum() + seg_len[s] * t[s])
        scale = self.length[e] / poly_len if poly_len > 0 else 1.0  # keep consistent with edge length
        return {"edge": e, "pos_m": along * scale, "point": point, "seg": s, "t": float(t[s]),
                "dist_m": haversine_m(lon, lat, point[0], point[1])}

    def _partial(self, snap, towards_v):
        """Coordinates from the snapped point to node v (towards_v) or back to node u."""
        c = self.edge_coords(snap["edge"])
        s = snap["seg"]
        p = np.array([snap["point"]])
        if towards_v:
            return np.vstack([p, c[s + 1:]])
        return np.vstack([p, c[:s + 1][::-1]])

    # ---------------------------------------------------------------- routing
    def route(self, start, end, route_type="fastest", vehicle="driving", penalties=None, max_snap_m=5000.0):
        """Shortest path between two [lon, lat] points. Returns a result dict."""
        s = self.snap(start[0], start[1], max_snap_m)
        t = self.snap(end[0], end[1], max_snap_m)
        cost, secs = self.edge_cost_array(route_type, vehicle)
        hscale = 1.0 if route_type == "shortest" else 1.0 / self.max_speed_ms
        result = self._search(s, t, cost, penalties, hscale)
        if result is None:
            raise NoRoute("No connected route between the two points")
        return self._assemble(s, t, result, secs, start, end, route_type, vehicle)

    def _search(self, s, t, cost, penalties, hscale):
        pen = penalties or {}

        def ecost(e):
            return cost[e] * pen.get(e, 1.0)

        # source frontier: reach u backwards (if two-way) or v forwards
        sources = {}  # node -> (cost, edge_via_virtual, direction)
        se = s["edge"]
        su, sv, sc = int(self.eu[se]), int(self.ev[se]), ecost(se)
        slen = self.length[se]
        frac = s["pos_m"] / slen if slen > 0 else 0.0
        sources[sv] = (sc * (1 - frac), "to_v")
        if not self.oneway[se]:
            sources[su] = (sc * frac, "to_u")
        te = t["edge"]
        tu, tv, tc = int(self.eu[te]), int(self.ev[te]), ecost(te)
        tlen = self.length[te]
        tfrac = t["pos_m"] / tlen if tlen > 0 else 0.0
        targets = {tu: (tc * tfrac, "from_u")}  # arrive at u, then drive up to the point
        if not self.oneway[te]:
            targets[tv] = (tc * (1 - tfrac), "from_v")

        best_direct = None
        if se == te:
            if t["pos_m"] >= s["pos_m"]:
                best_direct = sc * (tfrac - frac)
            elif not self.oneway[se]:
                best_direct = sc * (frac - tfrac)

        lon_t, lat_t = t["point"]
        nodes = self.nodes
        # heuristic: straight-line metres (shortest) or metres / top speed (time based costs)

        def h(n):
            return haversine_m(nodes[n, 0], nodes[n, 1], lon_t, lat_t) * hscale

        g = {}
        parent = {}  # node -> (prev_node or None, arc_edge, reverse)
        heap = []
        for n, (c, how) in sources.items():
            g[n] = c
            parent[n] = (None, None, how)
            heapq.heappush(heap, (c + h(n), c, n))
        best_total = best_direct if best_direct is not None else math.inf
        best_end = None
        indptr, arc_to, arc_edge = self.indptr, self.arc_to_l, self.arc_edge_l
        arc_rev = self.arc_rev
        closed = set()
        while heap:
            f, gc, n = heapq.heappop(heap)
            if f >= best_total:
                break
            if n in closed:
                continue
            closed.add(n)
            if n in targets:
                total = gc + targets[n][0]
                if total < best_total:
                    best_total, best_end = total, n
            for a in range(indptr[n], indptr[n + 1]):
                m = arc_to[a]
                if m in closed:
                    continue
                e = arc_edge[a]
                ng = gc + cost[e] * pen.get(e, 1.0)
                if ng < g.get(m, math.inf):
                    g[m] = ng
                    parent[m] = (n, e, bool(arc_rev[a]))
                    heapq.heappush(heap, (ng + h(m), ng, m))
        if best_end is None:
            return {"direct": True, "total": best_direct} if best_direct is not None else None
        # rebuild arc list
        arcs = []
        n = best_end
        while True:
            prev, e, rev = parent[n]
            if prev is None:
                start_node, start_how = n, rev
                break
            arcs.append((e, rev))
            n = prev
        arcs.reverse()
        return {"direct": False, "total": best_total, "start_node": start_node, "start_how": start_how,
                "arcs": arcs, "end_node": best_end, "end_how": targets[best_end][1]}

    def _assemble(self, s, t, res, secs, start, end, route_type, vehicle):
        coords = [np.array([[start[0], start[1]]]), np.array([s["point"]])]
        steps = []  # (edge, reverse, coords, length_m, secs)

        def add(e, rev, c, frac):
            steps.append({"edge": e, "rev": rev, "coords": c, "length": float(self.length[e]) * frac,
                          "secs": secs[e] * frac})

        se, te = s["edge"], t["edge"]
        if res["direct"]:
            forward = t["pos_m"] >= s["pos_m"]
            part = self._between(s, t) if forward else self._between(t, s)[::-1]
            add(se, not forward, part, abs(t["pos_m"] - s["pos_m"]) / max(self.length[se], 1e-9))
        else:
            if res["start_how"] == "to_v":
                add(se, False, self._partial(s, True), (self.length[se] - s["pos_m"]) / max(self.length[se], 1e-9))
            else:
                add(se, True, self._partial(s, False), s["pos_m"] / max(self.length[se], 1e-9))
            for e, rev in res["arcs"]:
                add(e, rev, self.edge_coords(e, rev), 1.0)
            if res["end_how"] == "from_u":
                part = self._partial(t, False)[::-1]
                add(te, False, part, t["pos_m"] / max(self.length[te], 1e-9))
            else:
                part = self._partial(t, True)[::-1]
                add(te, True, part, (self.length[te] - t["pos_m"]) / max(self.length[te], 1e-9))
        line = np.vstack([np.array([[start[0], start[1]]])] + [x["coords"] for x in steps] + [np.array([[end[0], end[1]]])])
        # drop consecutive duplicates
        keep = np.ones(len(line), bool)
        keep[1:] = np.any(np.abs(np.diff(line, axis=0)) > 1e-9, axis=1)
        line = line[keep]
        dist = sum(x["length"] for x in steps)
        dur = sum(x["secs"] for x in steps)
        return {
            "geometry": {"type": "LineString", "coordinates": [[round(float(x), 6), round(float(y), 6)] for x, y in line]},
            "distance": round(dist, 1),
            "duration": round(dur, 1),
            "instructions": self._instructions(steps),
            "edges": [x["edge"] for x in steps],
            "snapped": {"start": {"location": list(s["point"]), "distance": round(s["dist_m"], 1), "name": self.edge_name(se)},
                        "end": {"location": list(t["point"]), "distance": round(t["dist_m"], 1), "name": self.edge_name(te)}},
        }

    def _between(self, a, b):
        """Coordinates along one edge from snap a to snap b (a before b)."""
        c = self.edge_coords(a["edge"])
        mid = c[a["seg"] + 1:b["seg"] + 1] if b["seg"] >= a["seg"] + 1 else np.empty((0, 2))
        return np.vstack([np.array([a["point"]]), mid, np.array([b["point"]])])

    def _instructions(self, steps):
        out = []
        cur = None
        prev_bearing = None
        for st in steps:
            c = st["coords"]
            if len(c) < 2:
                continue
            name = self.edge_name(st["edge"]) or ""
            b_in = bearing(c[0, 0], c[0, 1], c[1, 0], c[1, 1])
            b_out = bearing(c[-2, 0], c[-2, 1], c[-1, 0], c[-1, 1])
            if cur is None:
                cur = {"name": name, "distance": 0.0, "duration": 0.0, "loc": [float(c[0, 0]), float(c[0, 1])],
                       "type": "depart", "modifier": compass(b_in)}
            elif name != cur["name"]:
                turn_type, mod = turn_instruction(prev_bearing, b_in)
                if turn_type == "continue" and name == "":
                    pass  # unnamed straight-on pieces are merged
                else:
                    out.append(cur)
                    cur = {"name": name, "distance": 0.0, "duration": 0.0, "loc": [float(c[0, 0]), float(c[0, 1])],
                           "type": turn_type, "modifier": mod}
            cur["distance"] += st["length"]
            cur["duration"] += st["secs"]
            prev_bearing = b_out
        if cur:
            out.append(cur)
        steps_out = []
        for i, s in enumerate(out):
            road = s["name"] or "the road"
            if s["type"] == "depart":
                text = f"Head {s['modifier']} on {road}"
            elif s["type"] == "continue":
                text = f"Continue onto {road}"
            elif s["modifier"] == "uturn":
                text = f"Make a U-turn onto {road}"
            else:
                text = f"Turn {s['modifier']} onto {road}"
            steps_out.append({"instruction": text, "name": s["name"], "distance": round(s["distance"], 1),
                              "duration": round(s["duration"], 1),
                              "maneuver": {"type": s["type"], "modifier": s["modifier"], "location": s["loc"]}})
        steps_out.append({"instruction": "Arrive at destination", "name": "", "distance": 0, "duration": 0,
                          "maneuver": {"type": "arrive", "modifier": "", "location": None}})
        return steps_out

    # ------------------------------------------------------- map layer access
    def edges_in_bbox(self, west, south, east, north, classes=None, limit=5000):
        """Edge ids whose first/last node or any vertex falls inside the bbox."""
        v = self.geom_xy
        inside = (v[:, 0] >= west) & (v[:, 0] <= east) & (v[:, 1] >= south) & (v[:, 1] <= north)
        edge_ids = np.unique(self._vert_edge[inside])
        if classes is not None:
            edge_ids = edge_ids[np.isin(self.cls[edge_ids], classes)]
        if len(edge_ids) > limit:  # keep the most important roads first
            order = np.argsort(self.cls[edge_ids], kind="stable")
            edge_ids = edge_ids[order][:limit]
        return edge_ids

    def edge_feature(self, e):
        return {"type": "Feature",
                "geometry": {"type": "LineString",
                             "coordinates": [[round(float(x), 5), round(float(y), 5)] for x, y in self.edge_coords(e)]},
                "properties": {"name": self.edge_name(e), "highway": CLASS_NAMES[int(self.cls[e])],
                               "oneway": bool(self.oneway[e]), "length_m": round(float(self.length[e]), 1),
                               "speed_kph": round(float(self.speed[e]), 1)}}
