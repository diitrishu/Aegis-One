"""REST endpoints for map layers, damage assessments and the population grid.

Registered by simple_disaster_api.py under /api.
"""
import logging

from flask import Blueprint, jsonify, request

import geo_layers

logger = logging.getLogger(__name__)
layers_bp = Blueprint("layers", __name__, url_prefix="/api")


def _bbox_arg():
    raw = request.args.get("bbox")
    if not raw:
        return None
    try:
        w, s, e, n = [float(x) for x in raw.split(",")]
    except ValueError:
        raise ValueError("bbox must be west,south,east,north")
    return (w, s, e, n)


def _limit_arg(default=5000):
    try:
        return max(1, min(int(request.args.get("limit", default)), 20000))
    except ValueError:
        raise ValueError("limit must be an integer")


@layers_bp.route("/layers", methods=["GET"])
def list_layers():
    return jsonify({"success": True, "layers": geo_layers.KNOWN_LAYERS})


@layers_bp.route("/layers/<layer>/features", methods=["GET"])
def layer_features(layer):
    try:
        return jsonify(geo_layers.layer_features(layer, _bbox_arg(), _limit_arg()))
    except KeyError:
        return jsonify({"success": False, "error": f"Unknown layer '{layer}'"}), 404
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:  # pragma: no cover
        logger.exception("layer features failed")
        return jsonify({"success": False, "error": str(exc)}), 500


@layers_bp.route("/layers/<layer>/within", methods=["POST"])
def layer_within(layer):
    body = request.get_json(silent=True) or {}
    geometry = body.get("geometry")
    if not isinstance(geometry, dict):
        return jsonify({"success": False, "error": "geometry (GeoJSON) is required"}), 400
    try:
        return jsonify(geo_layers.layer_within(layer, geometry, body.get("limit", 2000)))
    except KeyError:
        return jsonify({"success": False, "error": f"Unknown layer '{layer}'"}), 404
    except (ValueError, TypeError, AttributeError, KeyError) as exc:
        logger.warning("within query rejected: %s", exc)
        return jsonify({"success": False, "error": f"Invalid geometry: {exc}"}), 400
    except Exception as exc:  # pragma: no cover
        logger.exception("within query failed")
        return jsonify({"success": False, "error": str(exc)}), 500


@layers_bp.route("/damage", methods=["GET"])
def get_damage():
    return jsonify(geo_layers.read_damage())


@layers_bp.route("/damage", methods=["POST"])
def post_damage():
    ok, result = geo_layers.add_damage(request.get_json(silent=True) or {})
    return jsonify(result), (200 if ok else 400)


@layers_bp.route("/population", methods=["GET"])
def population():
    """Population grid cells as GeoJSON points (bbox mode)."""
    try:
        bbox = _bbox_arg()
        if bbox is None and request.args.get("lat") and request.args.get("lon"):
            lat, lon = float(request.args["lat"]), float(request.args["lon"])
            r = float(request.args.get("radius", 5)) / 111.32
            bbox = (lon - r, lat - r, lon + r, lat + r)
        return jsonify(geo_layers.population_features(bbox, _limit_arg()))
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
