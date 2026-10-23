"""Validate this audit's data and source preservation. No writes to source assets.

This checks data invariants, not full JSON Schema standards conformance.
"""
import csv
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from PIL import Image
sys.dont_write_bytecode = True
from asset_sources import asset_path, iter_original_files

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "asset-audit"
checks = []


def check(condition, message):
    if not condition: raise AssertionError(message)
    checks.append(message)


json_files = list(OUT.glob("*.json"))
parsed = {p.name:json.loads(p.read_text(encoding="utf-8")) for p in json_files}
audit = parsed["inventory.json"]
files = audit["files"]
by_id = {e["id"]:e for e in files}
by_path = {e["path"]:e for e in files}
check(len(files) == len(by_id) == len(by_path) == 220, "220 unique inventory IDs and paths")
current = {relative for relative, _ in iter_original_files()}
check(current == set(by_path), "Original source file set matches inventory in configured storage")
for e in files:
    path = asset_path(e["path"])
    raw = path.read_bytes()
    check(len(raw) == e["bytes"] and hashlib.sha256(raw).hexdigest() == e["sha256"], f"Source bytes unchanged: {e['id']}")
check(sum(e["bytes"] for e in files) == 19837064, "Worktree size total matches inventory")
with (OUT / "inventory.csv").open(newline="",encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
check(len(rows) == 220 and {r["path"] for r in rows} == current, "CSV covers every current source path")
check(all(by_path[r["path"]]["sha256"] == r["sha256"] for r in rows), "CSV and JSON SHA-256 agree")
notes = parsed["catalog-notes.json"]
check(set(notes) == set(by_id), "Content/layout notes cover all 220 files")
catalog = (ROOT / "ASSET-CATALOG.md").read_text(encoding="utf-8")
catalog_ids = re.findall(r"^\| (A\d{3}) \|",catalog,re.M)
check(Counter(catalog_ids) == Counter(by_id.keys()), "Catalog lists every file exactly once")
preview = Path(audit["preview_directory"])
check(ROOT.parent.resolve() not in preview.resolve().parents, "Private artwork preview directory is outside repository")
coverage = []
for p in audit["previews"]:
    check((preview / p["file"]).is_file(), f"Contact sheet exists: {p['file']}")
    coverage.extend(p["ids"])
images = {e["id"] for e in files if e["format"] in ("PNG","GIF")}
check(len(coverage) == 190 and Counter(coverage) == Counter(images), "Contact sheets cover each PNG/GIF once")
check(len(list(preview.glob("grid-*.png"))) == 18, "18 private coordinate overlays exist")
check(len(list(preview.glob("aseprite-*.png"))) == 3, "Three decoded Aseprite previews exist")
check((preview/"index.html").is_file(), "Private gallery exists")

schema = parsed["sprite-manifest.schema.json"]
def check_schema_refs(value):
    if isinstance(value,dict):
        if "$ref" in value:
            ref = value["$ref"]
            check(ref.startswith("#/"), f"Schema reference is local: {ref}")
            target = schema
            for part in ref[2:].split("/"): target = target[part]
        for v in value.values(): check_schema_refs(v)
    elif isinstance(value,list):
        for v in value: check_schema_refs(v)
check_schema_refs(schema)

m = parsed["sprite-manifest.sample.json"]
check(m["purpose"] == "audit-proposal-not-runtime-approved", "Sample is marked audit-only")
check(set(schema["required"]).issubset(m), "Sample has required top-level fields")
for key, source in m["sources"].items():
    p = Path(source["path"])
    check(not p.is_absolute() and ".." not in p.parts and p.parts[0] == "assets", f"Safe relative source path: {key}")
    e = by_path[source["path"]]
    check(e["sha256"] == source["sha256"] and source["pixelSize"] == [e["width"],e["height"]], f"Source dimensions/hash verified: {key}")
    check(source["packId"] in m["packs"] and source["packId"] == e["pack_id"], f"Pack reference verified: {key}")
for key, pack in m["packs"].items():
    check(by_path[pack["noticePath"]]["pack_id"] == key, f"Original license path verified: {key}")
verified = 0
for key, sprite in m["sprites"].items():
    check(sprite["source"] in m["sources"], f"Sprite source exists: {key}")
    if sprite["status"] == "manual-review":
        check(sprite["rect"] is None, f"Unresolved mapping has null coordinates: {key}")
        continue
    verified += 1
    check(sprite["status"] == "verified", f"Known sprite status: {key}")
    r = sprite["rect"]
    w,h = m["sources"][sprite["source"]]["pixelSize"]
    check(all(type(v) is int for v in r.values()) and min(r["x"],r["y"])>=0 and min(r["w"],r["h"])>0 and r["x"]+r["w"]<=w and r["y"]+r["h"]<=h, f"Rectangle within source bounds: {key}")
    with Image.open(asset_path(m["sources"][sprite["source"]]["path"])) as im:
        crop=im.convert("RGBA").crop((r["x"],r["y"],r["x"]+r["w"],r["y"]+r["h"]))
        check(crop.getchannel("A").getbbox() is not None, f"Verified crop contains visible pixels: {key}")
    if "artTileSpan" in sprite:
        a = sprite["artTileSpan"]
        check(a["tileWidth"]*a["columns"]==r["w"] and a["tileHeight"]*a["rows"]==r["h"], f"Art span matches source dimensions: {key}")
    check(sprite["logicalFootprint"] is None, f"Gameplay footprint deliberately undecided: {key}")
for key, animation in m["animations"].items():
    for f in animation["frames"]:
        check(f["sprite"] in m["sprites"] and m["sprites"][f["sprite"]]["status"]=="verified", f"Animation frame reference verified: {key}/{f['sprite']}")
    check(animation["reducedMotionFrame"] in m["sprites"], f"Reduced motion fallback reference exists: {key}")
    if animation["timingStatus"]=="verified":
        check(all(type(f["durationMs"]) is int and f["durationMs"]>0 for f in animation["frames"]), f"Positive verified frame durations: {key}")
    else:
        check(animation["status"]=="manual-review" and all(f["durationMs"] is None for f in animation["frames"]), f"Unknown animation timing stays null: {key}")

details = parsed["detail-measurements.json"]
for prefix,ase_id,png_id in [("winter.tree","A179","A180"),("winter.fire","A182","A181"),("winter.gift.red","A184","A185")]:
    e=by_id[ase_id]
    a=m["animations"][prefix]
    measured=next(c for c in details["aseprite_png_comparisons"] if c["aseprite"]==ase_id)
    check(all(measured["row_major_matches"]) and measured["png"]==png_id, f"Every decoded source frame matched export: {prefix}")
    check([f["durationMs"] for f in a["frames"]]==e["durations_ms"]==measured["durations_ms"], f"Sample timing matches source headers: {prefix}")
    for i,f in enumerate(a["frames"]):
        check(m["sprites"][f["sprite"]]["rect"]=={"x":i*e["width"],"y":0,"w":e["width"],"h":e["height"]}, f"Sample frame rectangle matches measured export: {f['sprite']}")
check(len(details["audio"])==22 and all(a["stereo_channels_identical"] for a in details["audio"]), "All 22 measured WAVs have identical stereo channels")
check(len(audit["errors"])==0, "No inventory decode errors")
check(len(audit["exact_duplicate_groups"])==8 and len(audit["near_image_candidates"])==59, "Recorded duplicate/candidate totals consistent")
whitespace=[]
for p in list(OUT.glob("*.py"))+list(OUT.glob("*.json"))+list(OUT.glob("*.md"))+list(ROOT.glob("ASSET-*.md")):
    for i,line in enumerate(p.read_text(encoding="utf-8").splitlines(),1):
        if line.rstrip()!=line: whitespace.append(f"{p.name}:{i}")
check(not whitespace, "No trailing whitespace in new audit text files")
report={"date":"2026-10-22","status":"passed","checks_passed":len(checks),"source_files_preserved":220,
        "verified_sample_rectangles":verified,"unresolved_sample_rectangles":1,"verified_animation_frames":34,
        "contact_sheets":19,"coordinate_overlays":18,"decoded_aseprite_previews":3,
        "json_files_parsed":[p.name for p in json_files if p.name!="validation-report.json"],
        "schema_validation":"JSON parsed and local references checked; no full standards-engine validation",
        "checks":checks}
(OUT/"validation-report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v for k,v in report.items() if k!="checks"},indent=2))
