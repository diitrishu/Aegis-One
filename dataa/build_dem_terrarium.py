"""Build a compact North India elevation dataset (~270 m) from public Terrain Tiles.

No account, registration or large download is needed: it fetches ~340 small PNG
tiles (~50 MB) of the open "Terrain Tiles" dataset on AWS (Mapzen/Tilezen;
elevation over India comes from NASA SRTM, which is public domain), mosaics
them, reprojects to EPSG:4326 and writes everything the backend expects into
datasets/elevation/processed/:

    north_india_dem.tif      elevation in metres (int16, nodata -32768)
    slope.tif                slope in degrees (uint8, nodata 255)
    low_lying_areas.geojson  ~2 km blocks below 100 m (used by /api/v2/flood-risk)
    statistics.json

Usage (from the dataa/ folder):
    python build_dem_terrarium.py                      # download tiles and build
    python build_dem_terrarium.py --raw dem.bin.gz     # build from a saved mosaic
    python build_dem_terrarium.py --save-raw dem.bin.gz  # also keep the mosaic

Attribution: Terrain Tiles by Mapzen/Tilezen on AWS Open Data, using NASA SRTM.
Requires: numpy, rasterio, geopandas, shapely, pillow.
"""
import argparse
import gzip
import io
import json
import math
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine, from_origin
from rasterio.warp import Resampling, reproject

BBOX = (72.0, 24.0, 88.0, 32.0)  # west, south, east, north (North India)
NODATA = -32768
ORIGIN = 20037508.342789244  # half the Web Mercator world width, metres
BASE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium"
OUT_RES = 0.0025  # degrees (~275 m)
LOW_LYING_MAX_M = 100  # blocks below this elevation are exported
BLOCK = 8  # pixels per low-lying block -> 0.02 degrees (~2.2 km)


def tile_x(lon, z):
    return int(math.floor((lon + 180.0) / 360.0 * 2 ** z))


def tile_y(lat, z):
    r = math.radians(lat)
    return int(math.floor((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z))


def tile_range(zoom):
    west, south, east, north = BBOX
    return tile_x(west, zoom), tile_x(east - 1e-9, zoom), tile_y(north, zoom), tile_y(south + 1e-9, zoom)


def decode_terrarium(rgb):
    """Terrarium encoding: metres = R*256 + G + B/256 - 32768."""
    rgb = rgb.astype("float64")
    return np.rint(rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768).astype("int16")


def download_mosaic(zoom, base_url=BASE_URL, workers=8):
    from PIL import Image

    x0, x1, y0, y1 = tile_range(zoom)
    width, height = (x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256
    mosaic = np.full((height, width), NODATA, dtype="int16")
    jobs = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
    print(f"Downloading {len(jobs)} tiles (zoom {zoom}) ...")

    def fetch(job):
        x, y = job
        url = f"{base_url}/{zoom}/{x}/{y}.png"
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url, timeout=60) as resp:
                    img = Image.open(io.BytesIO(resp.read())).convert("RGB")
                return job, decode_terrarium(np.asarray(img))
            except Exception as exc:  # retry, then give up loudly
                if attempt == 2:
                    raise RuntimeError(f"failed to fetch {url}: {exc}") from exc

    with ThreadPoolExecutor(workers) as pool:
        for (x, y), tile in pool.map(fetch, jobs):
            r, c = (y - y0) * 256, (x - x0) * 256
            mosaic[r:r + 256, c:c + 256] = tile
    return mosaic


def load_raw(path, zoom):
    x0, x1, y0, y1 = tile_range(zoom)
    shape = ((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256)
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rb") as fh:
        data = np.frombuffer(fh.read(), dtype="<i2")
    if data.size != shape[0] * shape[1]:
        raise SystemExit(f"{path}: expected {shape[1]}x{shape[0]} int16 values for zoom {zoom}, got {data.size}")
    return data.reshape(shape).copy()


def reproject_to_wgs84(mosaic, zoom):
    x0, _, y0, _ = tile_range(zoom)
    tile_m = 2 * ORIGIN / 2 ** zoom
    px = tile_m / 256
    src_transform = Affine(px, 0, -ORIGIN + x0 * tile_m, 0, -px, ORIGIN - y0 * tile_m)
    west, south, east, north = BBOX
    width, height = round((east - west) / OUT_RES), round((north - south) / OUT_RES)
    dst = np.full((height, width), NODATA, dtype="int16")
    reproject(
        mosaic, dst,
        src_transform=src_transform, src_crs=CRS.from_epsg(3857), src_nodata=NODATA,
        dst_transform=from_origin(west, north, OUT_RES, OUT_RES), dst_crs=CRS.from_epsg(4326), dst_nodata=NODATA,
        resampling=Resampling.bilinear,
    )
    return dst, from_origin(west, north, OUT_RES, OUT_RES)


def compute_slope_deg(dem, transform):
    valid = dem != NODATA
    z = np.where(valid, dem, np.nan).astype("float64")
    dy = abs(transform.e) * 111_320.0
    lat = transform.f + (np.arange(dem.shape[0]) + 0.5) * transform.e
    dx = dy * np.cos(np.radians(lat))[:, None]
    gy, gx = np.gradient(z, dy, axis=0), np.gradient(z, axis=1) / dx
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    out = np.full(dem.shape, 255, dtype="uint8")
    ok = np.isfinite(slope)
    out[ok] = np.clip(np.rint(slope[ok]), 0, 90).astype("uint8")
    return out


def write_tif(path, array, transform, nodata, predictor):
    profile = dict(driver="GTiff", dtype=array.dtype, count=1, height=array.shape[0], width=array.shape[1],
                   crs="EPSG:4326", transform=transform, nodata=nodata, tiled=True, blockxsize=256,
                   blockysize=256, compress="deflate", predictor=predictor, zlevel=9)
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(array, 1)


def low_lying_geojson(dem, transform, path):
    import geopandas as gpd
    from shapely.geometry import box

    h, w = (dem.shape[0] // BLOCK) * BLOCK, (dem.shape[1] // BLOCK) * BLOCK
    blocks = dem[:h, :w].reshape(h // BLOCK, BLOCK, w // BLOCK, BLOCK).astype("float64")
    valid = blocks != NODATA
    count = valid.sum(axis=(1, 3))
    mean = np.where(valid, blocks, 0).sum(axis=(1, 3)) / np.maximum(count, 1)
    keep = (count >= BLOCK * BLOCK / 2) & (mean >= 0) & (mean < LOW_LYING_MAX_M)
    step = OUT_RES * BLOCK
    rows, cols = np.nonzero(keep)
    geoms, elev = [], []
    for r, c in zip(rows, cols):
        west, north = transform.c + c * step, transform.f - r * step
        geoms.append(box(round(west, 4), round(north - step, 4), round(west + step, 4), round(north, 4)))
        elev.append(round(float(mean[r, c]), 1))
    gdf = gpd.GeoDataFrame({"elevation_m": elev}, geometry=geoms, crs="EPSG:4326")
    gdf.to_file(path, driver="GeoJSON", COORDINATE_PRECISION=4)
    return len(gdf)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--zoom", type=int, default=9, help="tile zoom level (9 = ~270 m, 8 = ~540 m)")
    ap.add_argument("--raw", help="build from a saved int16 mosaic (.bin or .bin.gz) instead of downloading")
    ap.add_argument("--save-raw", help="save the downloaded mosaic (gzip) for later reuse")
    ap.add_argument("--base-url", default=BASE_URL, help="tile server (mainly for testing)")
    ap.add_argument("--out", default="datasets/elevation/processed", help="output folder")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    mosaic = load_raw(args.raw, args.zoom) if args.raw else download_mosaic(args.zoom, args.base_url)
    if args.save_raw:
        with gzip.open(args.save_raw, "wb") as fh:
            fh.write(mosaic.astype("<i2").tobytes())

    # A few dozen void/artefact pixels (e.g. -1154 m in Tibet, -72 m in river channels) lie below
    # any real land in this region (lowest real terrain is a few metres above sea level)
    mosaic[mosaic < -10] = NODATA

    print("Reprojecting to EPSG:4326 ...")
    dem, transform = reproject_to_wgs84(mosaic, args.zoom)
    valid = dem[dem != NODATA]
    if valid.size == 0 or float(valid.max()) < 1000:
        sys.exit("DEM looks empty or is not the North India region; aborting.")

    write_tif(out / "north_india_dem.tif", dem, transform, NODATA, predictor=2)
    write_tif(out / "slope.tif", compute_slope_deg(dem, transform), transform, 255, predictor=2)
    n_blocks = low_lying_geojson(dem, transform, out / "low_lying_areas.geojson")

    stats = {
        "source": "Terrain Tiles (Mapzen/Tilezen on AWS Open Data; NASA SRTM over India)",
        "region": "North India (24-32N, 72-88E)",
        "elevation_range_m": {"min": float(valid.min()), "max": float(valid.max()),
                              "mean": round(float(valid.mean()), 1), "median": float(np.median(valid))},
        "low_lying_areas": {"below_10m": int((valid < 10).sum()),
                            "10m_to_50m": int(((valid >= 10) & (valid < 50)).sum()),
                            "50m_to_100m": int(((valid >= 50) & (valid < 100)).sum())},
        "low_lying_blocks_exported": n_blocks,
        "raster_info": {"width": dem.shape[1], "height": dem.shape[0],
                        "resolution_m": round(OUT_RES * 111_320)},
    }
    (out / "statistics.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))
    print(f"Wrote DEM, slope, low-lying areas and statistics to {out}/")


if __name__ == "__main__":
    main()
