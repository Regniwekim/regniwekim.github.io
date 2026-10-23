"""Read-only source audit. Writes metadata here and artwork previews OUTSIDE Git.

Requires Python 3 and Pillow (already bundled with Codex); no package installation.
Usage: python asset-audit/audit_assets.py --previews ABSOLUTE_PRIVATE_DIRECTORY
"""
import argparse
import csv
import hashlib
import json
import math
import struct
import subprocess
import textwrap
import wave
from collections import Counter, defaultdict
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat
from asset_sources import asset_path, iter_original_files

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "asset-audit"
PACKS = {
    "Sprout Lands - Sprites - Basic pack": ("sprout-sprites-basic", "https://cupnooble.itch.io/sprout-lands-asset-pack"),
    "Sprout Lands - UI Pack - Basic pack": ("sprout-ui-basic", "https://cupnooble.itch.io/sprout-lands-ui-pack"),
    "Sprout Sorry pack": ("sprout-sorry", "https://cupnooble.itch.io/sorry-package"),
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def visible_image(im):
    """Normalize invisible RGB, retaining RGBA dimensions and visible pixels."""
    rgba = im.convert("RGBA")
    clean = Image.new("RGBA", rgba.size)
    clean.paste(rgba, mask=rgba.getchannel("A").point(lambda a: 255 if a else 0))
    return clean


def visual_hash(im):
    im = visible_image(im)
    return sha(struct.pack("<II", *im.size) + im.tobytes())


def ase_metadata(data):
    size, magic, n, w, h, depth = struct.unpack_from("<I5H", data)
    assert magic == 0xA5E0 and size == len(data)
    result = {"width": w, "height": h, "color_depth": depth, "frames": n,
              "editor_grid": list(struct.unpack_from("<hhHH", data, 36)),
              "durations_ms": [], "layers": [], "tags": [], "chunk_types": {}}
    counts = Counter()
    offset = 128
    for _ in range(n):
        length, magic, old_count, duration, new_count = struct.unpack_from("<IHHH2xI", data, offset)
        assert magic == 0xF1FA
        result["durations_ms"].append(duration)
        pos = offset + 16
        for _ in range(new_count or old_count):
            clen, ctype = struct.unpack_from("<IH", data, pos)
            assert clen >= 6 and pos + clen <= offset + length
            counts[f"0x{ctype:04x}"] += 1
            body = data[pos + 6:pos + clen]
            if ctype == 0x2004:
                flags, kind, level = struct.unpack_from("<HHH", body)
                blend, opacity, name_len = struct.unpack_from("<HB3xH", body, 10)
                result["layers"].append({"name": body[18:18 + name_len].decode("utf-8"),
                                         "flags": flags, "type": kind, "level": level,
                                         "blend": blend, "opacity": opacity})
            if ctype == 0x2018:
                tag_count = struct.unpack_from("<H", body)[0]
                t = 10
                for _ in range(tag_count):
                    start, end, direction, repeat = struct.unpack_from("<HHBH", body, t)
                    name_len = struct.unpack_from("<H", body, t + 17)[0]
                    result["tags"].append({"from": start, "to": end, "direction": direction,
                                          "repeat": repeat, "name": body[t + 19:t + 19 + name_len].decode("utf-8")})
                    t += 19 + name_len
            pos += clen
        offset += length
    assert offset == len(data)
    result["chunk_types"] = dict(counts)
    return result


def font_metadata(data):
    count = struct.unpack_from(">H", data, 4)[0]
    tables = {}
    for i in range(count):
        tag, _, offset, length = struct.unpack_from(">4sIII", data, 12 + i * 16)
        tables[tag.decode("ascii")] = (offset, length)
    offset, _ = tables["name"]
    _, count, strings = struct.unpack_from(">HHH", data, offset)
    names = defaultdict(list)
    for i in range(count):
        platform, encoding, lang, ident, length, pos = struct.unpack_from(">6H", data, offset + 6 + 12 * i)
        raw = data[offset + strings + pos:offset + strings + pos + length]
        value = raw.decode("utf-16-be" if platform in (0, 3) else "mac_roman", errors="replace")
        if value not in names[str(ident)]:
            names[str(ident)].append(value)
    return {"tables": sorted(tables), "name_records": dict(names),
            "units_per_em": struct.unpack_from(">H", data, tables["head"][0] + 18)[0],
            "glyph_count": struct.unpack_from(">H", data, tables["maxp"][0] + 4)[0]}


def category(path):
    p = path.lower()
    if p.endswith("read_me.txt"): return "Licenses"
    if p.endswith(".wav"): return "Audio"
    if "/fonts/" in p: return "Fonts"
    if "color pallet" in p: return "Palette and references"
    if "bitmask" in p: return "Palette and references"
    if "ui pack" in p: return "UI"
    if "/tests/" in p: return "Experimental characters"
    if "/dungeon pack/" in p: return "Dungeon extras"
    if "/ocean pack/" in p: return "Ocean and fishing"
    if "/sprout winter/" in p: return "Winter extras"
    if "/village pack/" in p: return "Buildings"
    if "ground tilesets" in p or "/tilesets/" in p: return "Terrain and construction"
    if any(s in p for s in ("chicken", "cow", "egg_and_nest", "/bee/", "/frog/")): return "Animals and habitats"
    if "/characters/" in p: return "Characters and tools"
    if any(s in p for s in ("biom", "plants", "trees", "shroms")): return "Plants and environment"
    return "Furniture and props"


def draw_preview(entries, dest):
    font = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 13)
    titlefont = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 18)
    groups = defaultdict(list)
    for e in entries:
        if e["format"] in ("PNG", "GIF"):
            groups[e["category"]].append(e)
    index = []
    for group, items in sorted(groups.items()):
        slug = group.lower().replace(" ", "-")
        for page in range(math.ceil(len(items) / 16)):
            batch = items[page * 16:(page + 1) * 16]
            board = Image.new("RGB", (1400, 70 + math.ceil(len(batch) / 4) * 290), "#202833")
            d = ImageDraw.Draw(board)
            d.text((20, 12), f"WORDSTEAD / {group} / {page + 1} — PRIVATE AUDIT PREVIEW", font=titlefont, fill="white")
            for j, e in enumerate(batch):
                x, y = (j % 4) * 350, 60 + (j // 4) * 290
                for cy in range(0, 200, 10):
                    for cx in range(0, 330, 10):
                        d.rectangle((x + cx + 10, y + cy, x + cx + 19, y + cy + 9), fill="#45535c" if (cx + cy) % 20 else "#55626b")
                with Image.open(asset_path(e["path"])) as im:
                    im.seek(0)
                    rgba = im.convert("RGBA")
                    scale = min(330 / im.width, 200 / im.height, 4)
                    scale = int(scale) if scale >= 1 else scale
                    rgba = rgba.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.Resampling.NEAREST)
                    board.paste(rgba, (x + 10 + (330 - rgba.width) // 2, y + (200 - rgba.height) // 2), rgba)
                label = f"{e['id']} {e['width']}x{e['height']} / {e['pack_id']}\n" + "\n".join(textwrap.wrap(Path(e["path"]).name, 42))
                d.text((x + 10, y + 205), label, font=font, fill="#f8edd2")
            name = f"{slug}-{page + 1:02d}.png"
            board.save(dest / name)
            for e in batch:
                e["preview"] = name
            index.append({"category": group, "file": name, "ids": [e["id"] for e in batch]})
    (dest / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    return index


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--previews", required=True, type=Path)
    preview = args.parse_args().previews.resolve()
    repo = ROOT.parent.resolve()
    if preview == repo or repo in preview.parents:
        raise ValueError("Artwork previews must remain outside the Git repository")
    preview.mkdir(parents=True, exist_ok=True)
    git = ["git", "-c", f"safe.directory={repo.as_posix()}"]
    tracked = set(subprocess.check_output(git + ["ls-files", "-z", "--", "assets"], cwd=ROOT).decode().split("\0"))
    entries = []
    errors = []
    for rel, p in sorted(iter_original_files(), key=lambda item: item[0].lower()):
        data = p.read_bytes()
        pack, url = PACKS.get(Path(rel).parts[1], ("unknown", None))
        e = {"id": f"A{len(entries) + 1:03}", "path": rel, "pack_id": pack, "source_url": url,
             "bytes": len(data), "sha256": sha(data), "format": p.suffix[1:].upper(),
             "category": category(rel), "tracked": rel in tracked}
        try:
            if p.suffix.lower() in (".png", ".gif"):
                with Image.open(p) as im:
                    im.verify()
                with Image.open(p) as im:
                    e.update(width=im.width, height=im.height, mode=im.mode, frames=im.n_frames)
                    e["loop"] = im.info.get("loop")
                    e["durations_ms"] = []
                    frame_hashes = []
                    for f in range(im.n_frames):
                        im.seek(f)
                        e["durations_ms"].append(im.info.get("duration"))
                        frame_hashes.append(visual_hash(im))
                    im.seek(0)
                    rgba = im.convert("RGBA")
                    e["alpha_bounds_first_frame"] = rgba.getchannel("A").getbbox()
                    e["visual_sha256"] = sha("".join(frame_hashes).encode())
                    e["first_frame_visual_sha256"] = frame_hashes[0]
            elif p.suffix.lower() == ".aseprite": e.update(ase_metadata(data))
            elif p.suffix.lower() == ".ttf": e["font"] = font_metadata(data)
            elif p.suffix.lower() == ".wav":
                with wave.open(str(p), "rb") as w:
                    e.update(channels=w.getnchannels(), sample_rate=w.getframerate(),
                             sample_width_bytes=w.getsampwidth(), sample_frames=w.getnframes(),
                             duration_seconds=w.getnframes() / w.getframerate(), compression=w.getcomptype())
            elif p.suffix.lower() == ".txt": data.decode("utf-8-sig")
        except Exception as ex:
            errors.append({"path": rel, "error": repr(ex)})
        entries.append(e)
    exact, visual = defaultdict(list), defaultdict(list)
    for e in entries:
        exact[e["sha256"]].append(e["id"])
        if "visual_sha256" in e: visual[e["visual_sha256"]].append(e["id"])
    exact = {k:v for k,v in exact.items() if len(v)>1}
    visual = {k:v for k,v in visual.items() if len(v)>1}
    # Same-size near matches are candidates only. Compare visible pixels on neutral background.
    near = []
    images = {}
    for e in entries:
        if e["format"] == "PNG":
            with Image.open(asset_path(e["path"])) as im:
                rgba = im.convert("RGBA")
                bg = Image.new("RGBA", rgba.size, (90,100,105,255))
                images[e["id"]] = Image.alpha_composite(bg, rgba).convert("RGB")
    image_entries = [e for e in entries if e["id"] in images]
    for i, a in enumerate(image_entries):
        for b in image_entries[i + 1:]:
            if (a["width"], a["height"]) != (b["width"], b["height"]) or a["visual_sha256"] == b["visual_sha256"]: continue
            diff = ImageChops.difference(images[a["id"]], images[b["id"]])
            mean = sum(ImageStat.Stat(diff).mean) / 3
            red, green, blue = diff.split()
            mask = ImageChops.lighter(ImageChops.lighter(red, green), blue).point(lambda v: 255 if v else 0)
            changed = mask.histogram()[255] / (a["width"] * a["height"])
            if mean < 12 and changed < .35:
                near.append({"a": a["id"], "b": b["id"], "changed_pixel_fraction": round(changed, 6),
                             "mean_rgb_difference_0_255": round(mean, 3), "status": "candidate-manual-review"})
    previews = draw_preview(entries, preview)
    result = {"audit_date": "2026-10-22", "path_base": "wordstead/", "preview_directory": str(preview),
              "files": entries, "exact_duplicate_groups": exact, "visual_duplicate_groups": visual,
              "near_image_candidates": near, "errors": errors, "previews": previews}
    (OUT / "inventory.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    with (OUT / "inventory.csv").open("w", newline="", encoding="utf-8") as f:
        fields = ["id", "pack_id", "path", "format", "width", "height", "bytes", "frames", "duration_seconds", "sample_rate", "channels", "sample_width_bytes", "sha256", "category", "tracked", "preview"]
        writer = csv.DictWriter(f, fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(entries)
    print(json.dumps({"files":len(entries), "bytes":sum(e["bytes"] for e in entries), "formats":dict(Counter(e["format"] for e in entries)),
                      "packs":dict(Counter(e["pack_id"] for e in entries)), "tracked":sum(e["tracked"] for e in entries),
                      "exact_groups":len(exact), "visual_groups":len(visual), "near_candidates":len(near),
                      "previews":len(previews), "errors":errors}, indent=2))


if __name__ == "__main__": main()
