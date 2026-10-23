"""Prepare text-only source aliases and an explicitly unapproved starter export list.

Also preserves byte-identical license notices in the proposed durable location.
No artwork is copied, modified or deleted. All asset source hashes are checked.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent
inventory = json.loads((ROOT / "asset-audit/inventory.json").read_text(encoding="utf-8"))
entries = {e["id"]: e for e in inventory["files"]}
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "asset-audit"))
from asset_sources import asset_path


def checked_bytes(entry):
    content = asset_path(entry["path"]).read_bytes()
    if hashlib.sha256(content).hexdigest() != entry["sha256"]:
        raise ValueError(f"Source differs from the audit: {entry['path']}")
    return content


def save(name, value):
    target = OUT / name
    if target.is_file():
        previous = json.loads(target.read_text(encoding="utf-8"))
        if previous.get("status", "").startswith("approved"):
            raise ValueError(f"{name} is already approved; refusing to reset owner decisions")
    with target.open("w", encoding="utf-8", newline="\n") as output:
        json.dump(value, output, indent=2)
        output.write("\n")


canonical = ["A011", "A012", "A013", "A014", "A017", "A021", "A023", "A190"]
groups = []
for source_id in canonical:
    source = entries[source_id]
    members = inventory["exact_duplicate_groups"][source["sha256"]]
    for ident in members:
        checked_bytes(entries[ident])
    groups.append({"canonicalId": source_id, "canonicalOriginalPath": source["path"],
                   "sha256": source["sha256"], "bytesPerCopy": source["bytes"],
                   "aliases": [{"id": ident, "originalPath": entries[ident]["path"]} for ident in members if ident != source_id]})
save("duplicate-alias-proposal.json", {"status": "proposed-awaiting-owner-approval", "originalsPreserved": True,
                                      "groups": groups, "redundantCopies": 8, "potentialExportBytesAvoided": 16202})

choices = [
    ("A033", "terrain", "Farm board grass", ["terrain.grass.center"]),
    ("A036", "terrain", "One soil family: original narrow Tilled_Dirt.png", []),
    ("A013", "crops", "Two Basic Plants crop stages using canonical duplicate", ["crop.grain.stage-yellow", "crop.purple-root.stage-large"]),
    ("A004", "animals", "Static chicken pose", ["animal.chicken.pose-0"]),
    ("A005", "animals", "Static cow pose", ["animal.cow.pose-0"]),
    ("A018", "buildings", "Static coop; logical occupancy left undecided", ["building.chicken-coop"]),
    ("A044", "ui", "Modular rack slots; public delivery permission unresolved", ["ui.rack.slot.rounded.light", "ui.rack.slot.square.light"]),
    ("A089", "ui", "Blank buttons with live text; public delivery permission unresolved", ["ui.button.blank.light", "ui.button.blank.partner"]),
]
selection = []
for ident, category, reason, sprite_ids in choices:
    e = entries[ident]
    checked_bytes(e)
    selection.append({"auditId": ident, "packId": e["pack_id"], "originalPath": e["path"],
                      "proposedExportPath": f"assets/vendor/cup-nooble/{e['pack_id']}/{category}/{Path(e['path']).name}",
                      "sha256": e["sha256"], "bytes": e["bytes"], "pixelSize": [e["width"], e["height"]],
                      "reason": reason, "verifiedSpriteIds": sprite_ids,
                      "unresolvedMapping": "Soil source rectangles and adjacency map require verification" if ident == "A036" else None,
                      "publicDeliveryStatus": "hold-for-UI-permission-review" if e["pack_id"] == "sprout-ui-basic" else "noncommercial-project-terms-recorded-not-a-release-approval"})
save("starter-selection.proposed.json", {"status": "proposed-awaiting-owner-approval", "purpose": "selection-review-only",
     "intendedUse": "noncommercial", "entitlementEvidence": "User confirmed bundled notices only; no Premium entitlement claimed",
     "artworkCopied": False, "targetPathsCreated": False, "spriteRectanglesUnchanged": True,
     "publicReleaseApproved": False, "fileCount": len(selection), "totalSourceBytes": sum(e["bytes"] for e in selection),
     "logicalFeatureFootprints": None, "animation": "static-only", "audio": "deferred", "font": "system-fallback",
     "files": selection})

notices = []
for e in entries.values():
    if e["format"] != "TXT":
        continue
    content = checked_bytes(e)
    target = ROOT / "licenses/cup-nooble" / e["pack_id"] / "read_me.txt"
    if target.exists():
        if target.read_bytes() != content:
            raise ValueError(f"Existing license copy differs; refusing to overwrite {target}")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as output:
            output.write(content)
    notices.append({"packId": e["pack_id"], "originalPath": e["path"], "preservedPath": target.relative_to(ROOT).as_posix(), "sha256": e["sha256"]})
save("license-notice-copies.json", {"status": "byte-identical-verified", "files": notices})
print(json.dumps({"exactAliasGroups": len(groups), "proposedStarterFiles": len(selection),
                  "proposedStarterBytes": sum(e["bytes"] for e in selection), "noticesPreserved": len(notices),
                  "artworkCopied": False}))
