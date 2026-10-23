"""Additional measured comparisons and private coordinate previews; no source writes."""
import array
import json
import struct
import subprocess
import sys
import zlib
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont
sys.dont_write_bytecode = True
from audit_assets import ROOT, OUT, visible_image, visual_hash
from asset_sources import asset_path

data = json.loads((OUT / "inventory.json").read_text(encoding="utf-8"))
by_id = {e["id"]: e for e in data["files"]}
dest = Path(data["preview_directory"])
font = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 14)


def grid(ident, cell, scale=4):
    e = by_id[ident]
    im = Image.open(asset_path(e["path"])).convert("RGBA")
    w, h = im.size
    board = Image.new("RGBA", (max(800, w * scale + 60), h * scale + 70), "#3f505b")
    board.alpha_composite(im.resize((w * scale, h * scale), Image.Resampling.NEAREST), (50, 50))
    d = ImageDraw.Draw(board)
    d.text((5, 5), f"{ident} / candidate grid {cell[0]}x{cell[1]} / coordinates in SOURCE pixels", font=font, fill="white")
    for x in range(0, w + 1, cell[0]):
        d.line((50 + x * scale, 50, 50 + x * scale, 50 + h * scale), fill="#a7aebc66")
        d.text((50 + x * scale, 30), str(x), font=font, fill="white")
    for y in range(0, h + 1, cell[1]):
        d.line((50, 50 + y * scale, 50 + w * scale, 50 + y * scale), fill="#a7aebc66")
        d.text((2, 50 + y * scale), str(y), font=font, fill="white")
    board.convert("RGB").save(dest / f"grid-{ident}.png")


for ident, cell, scale in [("A001", (48,48), 3), ("A002", (48,48), 4), ("A004", (16,16), 8),
                           ("A005", (32,32), 8), ("A009", (16,16), 6), ("A015", (48,48), 4),
                           ("A033", (16,16), 5), ("A044", (48,48), 4), ("A064", (16,16), 5),
                           ("A065", (32,48), 5), ("A066", (48,32), 5), ("A067", (48,48), 4),
                           ("A073", (32,32), 3), ("A089", (96,32), 5), ("A117", (38,38), 3),
                           ("A152", (16,16), 4), ("A201", (64,64), 4), ("A215", (48,48), 3)]:
    grid(ident, cell, scale)


def alpha_components(ident):
    im = Image.open(asset_path(by_id[ident]["path"])).convert("RGBA")
    a = im.getchannel("A")
    pixels = a.load()
    seen = set()
    boxes = []
    for y in range(im.height):
        for x in range(im.width):
            if (x,y) in seen or pixels[x,y] == 0: continue
            stack = [(x,y)]; seen.add((x,y)); points = []
            while stack:
                px,py = stack.pop(); points.append((px,py))
                for nx,ny in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
                    if 0 <= nx < im.width and 0 <= ny < im.height and (nx,ny) not in seen and pixels[nx,ny]:
                        seen.add((nx,ny)); stack.append((nx,ny))
            if len(points) >= 8:
                boxes.append([min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points)+1, max(p[1] for p in points)+1])
    return boxes


components = {i:alpha_components(i) for i in ("A004","A005","A044","A064","A065","A066","A067","A089")}


def ase_frames(ident):
    """Only normal, visible, opaque RGBA image layers used by the three winter files.

    Reject unsupported constructs rather than silently rendering approximations.
    """
    e = by_id[ident]
    assert e["color_depth"] == 32
    assert all(l["type"] == 0 and l["level"] == 0 and l["blend"] == 0 and l["opacity"] == 255 and l["flags"] & 1 for l in e["layers"])
    raw = asset_path(e["path"]).read_bytes()
    offset = 128
    cels = {}
    frames = []
    for frame_index in range(e["frames"]):
        size, _, old, _, new = struct.unpack_from("<IHHH2xI", raw, offset)
        pos = offset + 16
        layers = {}
        for _ in range(new or old):
            length, kind = struct.unpack_from("<IH", raw, pos)
            body = raw[pos+6:pos+length]
            if kind == 0x2005:
                layer, x, y, opacity, typ, z = struct.unpack_from("<HhhBHh", body)
                assert opacity == 255 and z == 0
                if typ == 1:
                    link = struct.unpack_from("<H", body, 16)[0]
                    cel = cels[(link, layer)][2]
                else:
                    assert typ in (0,2)
                    w,h = struct.unpack_from("<HH", body, 16)
                    pixels = zlib.decompress(body[20:]) if typ == 2 else body[20:]
                    cel = Image.frombytes("RGBA", (w,h), pixels)
                cels[(frame_index,layer)] = (x,y,cel)
                layers[layer] = (x,y,cel)
            pos += length
        frame = Image.new("RGBA", (e["width"], e["height"]))
        for layer in sorted(layers):
            x,y,cel = layers[layer]
            frame.alpha_composite(cel, (x,y))
        frames.append(frame)
        offset += size
    return frames


comparisons = []
for ase_id, png_id in [("A179","A180"),("A182","A181"),("A184","A185")]:
    e = by_id[ase_id]
    frames = ase_frames(ase_id)
    png = Image.open(asset_path(by_id[png_id]["path"])).convert("RGBA")
    matches = []
    for i, frame in enumerate(frames):
        rect = [i * e["width"], 0, e["width"], e["height"]]
        crop = png.crop((rect[0],0,rect[0]+rect[2],rect[3]))
        matches.append(visual_hash(frame) == visual_hash(crop))
    comparisons.append({"aseprite":ase_id,"png":png_id,"frame_size":[e["width"],e["height"]],
                        "row_major_matches":matches,"durations_ms":e["durations_ms"],
                        "tags":e["tags"],"loop_semantics":"not documented; runtime choice"})
    frames[0].resize((e["width"]*8,e["height"]*8),Image.Resampling.NEAREST).save(dest / f"aseprite-{ase_id}-first-frame.png")

font_large = Image.open(asset_path(by_id["A060"]["path"])).convert("RGBA")
font_small = Image.open(asset_path(by_id["A061"]["path"])).convert("RGBA").resize(font_large.size,Image.Resampling.NEAREST)
font_scaled_match = visual_hash(font_large) == visual_hash(font_small)

# Audio checks: decoded sample hashes, channel equality and amplitude envelope.
import wave
audio = []
for e in data["files"]:
    if e["format"] != "WAV": continue
    with wave.open(str(asset_path(e["path"])),"rb") as w:
        pcm = w.readframes(w.getnframes())
    samples = array.array("h",pcm)
    if sys.byteorder != "little": samples.byteswap()
    peaks = [max(abs(v) for v in samples[i:i+2205*e["channels"]]) for i in range(0,len(samples),2205*e["channels"])]
    active = [i for i,p in enumerate(peaks) if p > 328]  # -40 dBFS approximate, 100ms windows
    audio.append({"id":e["id"],"pcm_sha256":__import__("hashlib").sha256(pcm).hexdigest(),
                  "stereo_channels_identical":samples[0::2] == samples[1::2],"peak_sample":max(abs(v) for v in samples),
                  "active_window_start_seconds":round(active[0]*.1,1) if active else None,
                  "active_window_end_seconds":round(min((active[-1]+1)*.1,e["duration_seconds"]),3) if active else None})

result = {"components":components,"aseprite_png_comparisons":comparisons,
          "font_preview_exact_nearest_neighbor_4x":font_scaled_match,"audio":audio}
(OUT / "detail-measurements.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"aseprite_png_comparisons":comparisons,"font_scaled_match":font_scaled_match,"components":components},indent=2))
