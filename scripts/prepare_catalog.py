#!/usr/bin/env python3
"""One-off: turn the WooCommerce export (catalog.json) into data/products.json
and optimised WebP images in public/img/p/.

Usage: python3 scripts/prepare_catalog.py <catalog.json> <raw-image-dir>
Raw images are named md5(url)[:12] + original extension (see README)."""
import hashlib, json, os, re, sys
from PIL import Image

SRC, RAW = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_OUT = os.path.join(ROOT, "public", "img", "p")
os.makedirs(IMG_OUT, exist_ok=True)

# (name prefix in export, category slug)
PREFIXES = [
    ("Sofa-Cum-Bed", "sofa-cum-beds"), ("Dressing Table", "dressing-tables"),
    ("Crockery Shelf", "crockery-shelves"), ("Corner Shelf", "corner-shelves"),
    ("Shoes Rack", "shoe-racks"), ("Tv Shelf", "tv-shelves"), ("Dining Set", "dining-sets"),
    ("Bookshelf", "bookshelves"), ("Wardrobe", "wardrobes"), ("Almirah", "almirahs"),
    ("Divan", "divans"), ("Sofa", "sofas"), ("Bed", "beds"),
]
SINGULAR = {"sofa-cum-beds": "sofa-cum-bed", "dressing-tables": "dressing-table",
    "crockery-shelves": "crockery-shelf", "corner-shelves": "corner-shelf",
    "shoe-racks": "shoe-rack", "tv-shelves": "tv-shelf", "dining-sets": "dining-set",
    "bookshelves": "bookshelf", "wardrobes": "wardrobe", "almirahs": "almirah",
    "divans": "divan", "sofas": "sofa", "beds": "bed"}

def clean_size(s):
    s = (s or "").strip()
    s = s.replace("''", '"').replace("”", '"').replace("“", '"').replace("″", '"')
    s = re.sub(r"\s+", " ", s)
    return s

def to_webp(src, dst, width):
    im = Image.open(src)
    im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dst, "WEBP", quality=80, method=6)
    return im.width, im.height

products, seen = [], set()
for x in json.load(open(SRC)):
    if not x.get("published"):
        continue
    name = x["name"].strip()
    for pre, cat in PREFIXES:
        if name.lower().startswith(pre.lower()):
            break
    else:
        raise SystemExit("unknown prefix: " + name)
    model = name[len(pre):].strip(" -")
    model = re.sub(r"\s*-\s*", "-", model)
    slug = SINGULAR[cat] + "-" + re.sub(r"[^a-z0-9]+", "-", model.lower()).strip("-")
    assert slug not in seen, slug
    seen.add(slug)
    imgs = []
    for i, url in enumerate(x["images"]):
        raw = os.path.join(RAW, hashlib.md5(url.encode()).hexdigest()[:12] + os.path.splitext(url)[1].lower())
        base = f"{slug}-{i + 1}"
        w, h = to_webp(raw, os.path.join(IMG_OUT, base + ".webp"), 1000)
        to_webp(raw, os.path.join(IMG_OUT, base + "-sm.webp"), 480)
        imgs.append({"src": f"/img/p/{base}.webp", "sm": f"/img/p/{base}-sm.webp", "w": w, "h": h})
    products.append({
        "slug": slug, "cat": cat, "model": model, "code": (x.get("code") or "").strip(),
        "sku": x.get("sku"), "price": x.get("sale_price") or x["price"],
        "regular_price": x["price"] if x.get("sale_price") else None,
        "size": clean_size(x.get("size")), "wood": x.get("wood") or "Pine",
        "polishes": [p.strip() for p in (x.get("polish") or "").split("/") if p.strip()],
        "images": imgs, "old_id": x["id"],
    })

json.dump(products, open(os.path.join(ROOT, "data", "products.json"), "w"), ensure_ascii=False, indent=1)
print(len(products), "products")
