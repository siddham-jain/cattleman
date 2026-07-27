"""
Cut the chosen training photo for each breed down to a bundled guide image.

The output is committed; the training set it reads is not. Re-run this only when
a picture needs replacing, after rebuilding the splits with ml/download.py and
ml/splits.py.
"""
from pathlib import Path
from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parents[2]
TRAIN = REPO / "ml/data/splits/train"
OUT = REPO / "mobile/assets/breeds"

# one representative photo per breed, chosen for a clear side-on view of the
# traits the guide describes
PICKS = {
    "Gir": "Gir_77.jpg",
    "Hariana": "Hariana_106.jpg",
    "Jaffarabadi": "Jaffrabadi_103.jpg",
    "Kankrej": "Kankrej_1.JPG",
    "Khillari": "Khillari_11.jpg",
    "Mehsana": "Mehsana_66.jpg",
    "Murrah": "Murrah_1.JPG",
    "Nili-Ravi": "Nili_Ravi_65.jpg",
    "Ongole": "Ongole_127.png",
    "Rathi": "Rathi_15.jpeg",
    "Red Sindhi": "Red_Sindhi_31.jpg",
    "Surti": "Surti_24.jpg",
}

SLUGS = {
    "Nili-Ravi": "nili-ravi",
    "Red Sindhi": "red-sindhi",
}

SIZE = (900, 675)

# square sources lose the horns to a centred 4:3 crop, so bias those upward
CENTERING = {"Kankrej": (0.5, 0.4), "Rathi": (0.5, 0.3)}

OUT.mkdir(parents=True, exist_ok=True)
for breed, filename in PICKS.items():
    source = Image.open(TRAIN / breed / filename)
    # cutouts arrive with an alpha channel; the guide draws them on a light card
    if source.mode in ("RGBA", "LA", "P"):
        source = source.convert("RGBA")
        flat = Image.new("RGB", source.size, (255, 255, 255))
        flat.paste(source, mask=source.split()[-1])
        source = flat
    else:
        source = source.convert("RGB")
    centering = CENTERING.get(breed, (0.5, 0.45))
    image = ImageOps.fit(source, SIZE, method=Image.LANCZOS, centering=centering)
    slug = SLUGS.get(breed, breed.lower())
    target = OUT / f"{slug}.jpg"
    image.save(target, "JPEG", quality=82, optimize=True, progressive=True)
    print(f"{target.name:16} {target.stat().st_size // 1024} KB  <- {filename}")
