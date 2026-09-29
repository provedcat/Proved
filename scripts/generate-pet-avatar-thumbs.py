"""Rebuild enlarged 128px choice thumbnails from the original transparent PNGs."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "images/pet-avatar"
OUT = ROOT / "thumbs"
OUT.mkdir(parents=True, exist_ok=True)
for folder in ("04_eye_color", "05_eye_pattern", "06_blush", "07_nose"):
    for source in (ROOT / "assets" / folder).glob("*.png"):
        image = Image.open(source).convert("RGBA")
        bounds = image.getbbox()
        if not bounds:
            continue
        x0, y0, x1, y1 = bounds
        side = max(x1 - x0, y1 - y0) * 1.2
        x, y = (x0 + x1) / 2, (y0 + y1) / 2
        crop = image.crop((round(x - side / 2), round(y - side / 2),
                           round(x + side / 2), round(y + side / 2)))
        crop.thumbnail((112, 112), Image.Resampling.LANCZOS)
        thumb = Image.new("RGBA", (128, 128), (247, 245, 255, 255))
        thumb.alpha_composite(crop, ((128 - crop.width) // 2, (128 - crop.height) // 2))
        thumb.save(OUT / (source.stem + ".webp"), format="WEBP", quality=85)
