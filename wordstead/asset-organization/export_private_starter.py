"""Prepare the owner-approved starter selection inside the private asset store.

Read-only preflight unless --write is supplied. Never exports into the public
repository; never overwrites an existing export. No source images are altered.
"""
import argparse
import copy
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "asset-audit"))
from asset_sources import private_originals


def json_bytes(value):
    return (json.dumps(value, indent=2) + "\n").encode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    selection = json.loads((ROOT / "asset-organization/starter-selection.proposed.json").read_text(encoding="utf-8"))
    if selection["status"] != "approved-for-private-preparation" or selection["publicReleaseApproved"]:
        parser.error("Expected an owner-approved private-only starter selection")
    originals = private_originals()
    export = originals.parent / "exports" / "wordstead-starter"
    for item in [export, *export.parents]:
        if item.is_symlink() or (hasattr(item, "is_junction") and item.is_junction()):
            parser.error("Symlinks/junctions are not permitted in the private export path")
    if export.exists():
        parser.error("Private starter export already exists; refusing to overwrite it")
    sample = json.loads((ROOT / "asset-audit/sprite-manifest.sample.json").read_text(encoding="utf-8"))
    source_keys = {"A033": "terrain.grass", "A036": "terrain.soil", "A013": "crops.basic",
                   "A004": "animals.chicken", "A005": "animals.cow", "A018": "buildings.coop",
                   "A044": "ui.rack-slots", "A089": "ui.blank-buttons"}
    payloads = {}
    sources = {}
    sprites = {}
    provenance = []
    used_packs = set()
    for entry in selection["files"]:
        relative = Path(entry["originalPath"])
        if relative.is_absolute() or ".." in relative.parts or relative.parts[0] != "assets":
            raise ValueError(f"Unsafe source path: {relative}")
        content = (originals / Path(*relative.parts[1:])).read_bytes()
        if hashlib.sha256(content).hexdigest() != entry["sha256"]:
            raise ValueError(f"Private source hash differs: {relative}")
        target = Path(entry["proposedExportPath"])
        if target.is_absolute() or ".." in target.parts or target.parts[:3] != ("assets", "vendor", "cup-nooble"):
            raise ValueError(f"Unsafe export path: {target}")
        payloads[target.as_posix()] = content
        key = source_keys[entry["auditId"]]
        sources[key] = {"path": target.as_posix(), "packId": entry["packId"],
                        "pixelSize": entry["pixelSize"], "sha256": entry["sha256"]}
        used_packs.add(entry["packId"])
        for sprite_id in entry["verifiedSpriteIds"]:
            if sprite_id == "terrain.soil.center":
                sprite = {"source": key, "rect": {"x": 0, "y": 80, "w": 16, "h": 16}, "status": "verified",
                          "evidence": "A036 source inspected on 16px overlay; complete opaque plain fill at (0,80,16,16). Edge adjacency remains unverified.",
                          "logicalFootprint": None}
            else:
                sprite = copy.deepcopy(sample["sprites"][sprite_id])
                if sample["sources"][sprite["source"]]["sha256"] != entry["sha256"]:
                    raise ValueError(f"Cannot transfer verified coordinates across different artwork: {sprite_id}")
                sprite["source"] = key
            sprites[sprite_id] = sprite
        provenance.append({"originalPack": entry["packId"], "auditId": entry["auditId"],
                           "originalPath": entry["originalPath"], "originalSha256": entry["sha256"],
                           "originalRect": {"x": 0, "y": 0, "w": entry["pixelSize"][0], "h": entry["pixelSize"][1]},
                           "exportPath": target.as_posix(), "exportSha256": entry["sha256"],
                           "transform": "none-original-sheet-intact", "publicDeliveryStatus": entry["publicDeliveryStatus"]})
    packs = {}
    for pack_id in sorted(used_packs):
        pack = copy.deepcopy(sample["packs"][pack_id])
        pack["noticePath"] = f"licenses/cup-nooble/{pack_id}/read_me.txt"
        payloads[pack["noticePath"]] = (ROOT / pack["noticePath"]).read_bytes()
        packs[pack_id] = pack
    manifest = {"$schema": "./sprite-manifest.schema.json", "schemaVersion": "1.0", "purpose": "private-local-preview",
                "coordinateSystem": "source-pixels-top-left", "sourcePathBase": "wordstead-entry-url",
                "packs": packs, "sources": sources, "sprites": sprites, "animations": {}}
    payloads["assets/sprites/registry.json"] = json_bytes(manifest)
    payloads["assets/sprites/sprite-manifest.schema.json"] = (ROOT / "asset-audit/sprite-manifest.schema.json").read_bytes()
    payloads["provenance.json"] = json_bytes({"purpose": "private-local-preview", "publicReleaseApproved": False,
                                             "intendedUse": "noncommercial", "files": provenance,
                                             "unresolved": ["Public UI delivery permission", "Terrain adjacency map", "Logical feature footprints and render pivots"]})
    payloads["README.md"] = (
        "# Wordstead private starter export\n\n"
        "Local review only. Do not publish, commit, or upload this directory.\n\n"
        "Eight original PNG sheets are intact, with 11 verified static sprite rectangles, "
        "the applicable original notices, and a provenance map. No runtime game is included. "
        "Source pack credit: Sprout Lands assets by Cup Nooble. UI public-delivery permission "
        "remains unresolved. All logical feature footprints remain undecided.\n"
    ).encode("utf-8")
    summary = {"mode": "write" if args.write else "preflight-only", "destination": str(export),
               "artworkFiles": len(selection["files"]), "artworkBytes": selection["totalSourceBytes"],
               "verifiedStaticSprites": len(sprites), "fileCount": len(payloads), "publicReleaseApproved": False}
    print(json.dumps(summary))
    if args.write:
        export.mkdir(parents=True, exist_ok=False)
        for relative, content in payloads.items():
            target = export / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as output:
                output.write(content)
            if target.read_bytes() != content:
                raise ValueError(f"Export verification failed: {target}")
        print("Private starter export created and byte-verified; no public asset export performed.")


if __name__ == "__main__":
    main()
