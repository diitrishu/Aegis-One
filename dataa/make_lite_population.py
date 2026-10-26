"""Shrink a population-count raster by summing factor x factor blocks.

Population totals are preserved exactly; only the cell size grows
(100 m cells with factor 6 -> ~550 m cells, 519 MB -> ~10 MB). This is how
the population raster shipped in this repo was produced from the output of
process_population.py. The backend works with either resolution.

Usage: python make_lite_population.py SRC.tif DST.tif [factor]
"""
import sys
import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.transform import Affine

src_path, dst_path = sys.argv[1], sys.argv[2]
f = int(sys.argv[3]) if len(sys.argv) > 3 else 6
STRIP = f * 200  # source rows per strip

with rasterio.open(src_path) as src:
    nodata = src.nodata
    W, H = src.width, src.height
    ow, oh = -(-W // f), -(-H // f)
    prof = dict(driver="GTiff", dtype="float32", count=1, width=ow, height=oh, crs=src.crs,
                transform=src.transform * Affine.scale(f, f), nodata=nodata,
                tiled=True, blockxsize=256, blockysize=256, compress="deflate", predictor=3, zlevel=9)
    total_in = 0.0
    total_out = 0.0
    with rasterio.open(dst_path, "w", **prof) as dst:
        for r0 in range(0, H, STRIP):
            h = min(STRIP, H - r0)
            a = src.read(1, window=Window(0, r0, W, h)).astype("float64")
            valid = a != nodata if nodata is not None else np.ones_like(a, dtype=bool)
            valid &= np.isfinite(a)
            a = np.where(valid, a, 0.0)
            ph, pw = (-h) % f, (-W) % f
            if ph or pw:
                a = np.pad(a, ((0, ph), (0, pw)))
                valid = np.pad(valid, ((0, ph), (0, pw)))
            H2, W2 = a.shape
            s = a.reshape(H2 // f, f, W2 // f, f).sum(axis=(1, 3))
            c = valid.reshape(H2 // f, f, W2 // f, f).sum(axis=(1, 3))
            out = np.where(c > 0, s, nodata).astype("float32")
            total_in += float(a.sum())
            total_out += float(out[c > 0].sum())
            dst.write(out, 1, window=Window(0, r0 // f, ow, out.shape[0]))
print(f"source {W}x{H} -> {ow}x{oh} (factor {f})")
print(f"population total in : {total_in:,.0f}")
print(f"population total out: {total_out:,.0f}")
