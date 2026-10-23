"""Check source preservation, approved private export, notices, and working-tree scope.

Reads source/export files only. Writes a small text-only validation report here.
No dependency installation, source changes, Git mutations, or publication.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "asset-audit"))
from asset_sources import PACK_DIRECTORIES, private_originals


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream,"sha256").hexdigest()


def main():
    inventory = read_json(ROOT / "asset-audit/inventory.json")
    status = read_json(OUT / "status.json")
    entries = {e["path"]: e for e in inventory["files"]}
    private = private_originals()
    report = read_json(private.parent / "provenance/backup-verification.json")
    assert report["status"] == "verified" and report["filesVerified"] == 220
    for entry in inventory["files"]:
        assert digest(private / Path(*Path(entry["path"]).parts[1:])) == entry["sha256"], entry["path"]
    assert len([p for p in private.rglob("*") if p.is_file()]) == 220
    assert all(not (ROOT / "assets" / name).exists() for name in PACK_DIRECTORIES)
    assert not [p for p in (ROOT / "assets").rglob("*") if p.is_file()], "No public runtime art was approved"
    notices = read_json(OUT / "license-notice-copies.json")["files"]
    assert len(notices) == 3
    for notice in notices:
        assert digest(ROOT / notice["preservedPath"]) == entries[notice["originalPath"]]["sha256"] == notice["sha256"]
    aliases = read_json(OUT / "duplicate-alias-proposal.json")
    assert aliases["status"] == "approved-for-private-selection" and len(aliases["groups"]) == 8
    by_id = {e["id"]: e for e in inventory["files"]}
    for group in aliases["groups"]:
        assert by_id[group["canonicalId"]]["sha256"] == group["sha256"]
        assert all(by_id[a["id"]]["sha256"] == group["sha256"] for a in group["aliases"])
    selection = read_json(OUT / "starter-selection.proposed.json")
    assert selection["status"] == "approved-for-private-preparation" and not selection["publicReleaseApproved"]
    export = private.parent / "exports/wordstead-starter"
    manifest = read_json(export / "assets/sprites/registry.json")
    provenance = read_json(export / "provenance.json")
    assert manifest["purpose"] == provenance["purpose"] == "private-local-preview"
    assert provenance["publicReleaseApproved"] is False
    assert len(manifest["sources"]) == 8 and len(manifest["sprites"]) == 11 and not manifest["animations"]
    assert len([p for p in export.rglob("*") if p.is_file()]) == 14
    assert len([p for p in export.rglob("*.png")]) == 8
    assert len(provenance["files"]) == 8
    assert sum(e["bytes"] for e in selection["files"]) == 14447
    assert not [p for p in export.rglob("*") if p.suffix.lower() in (".wav", ".ttf", ".aseprite", ".gif", ".zip")]
    for entry in selection["files"]:
        assert digest(export / entry["proposedExportPath"]) == entry["sha256"]
    for source in manifest["sources"].values():
        assert source["packId"] in manifest["packs"]
        path = export / source["path"]
        assert digest(path) == source["sha256"]
        with Image.open(path) as image:
            assert list(image.size) == source["pixelSize"]
    for sprite in manifest["sprites"].values():
        assert sprite["status"] == "verified" and sprite["logicalFootprint"] is None
        source = manifest["sources"][sprite["source"]]
        r = sprite["rect"]
        assert min(r["x"],r["y"]) >= 0 and min(r["w"],r["h"]) > 0
        assert r["x"] + r["w"] <= source["pixelSize"][0] and r["y"] + r["h"] <= source["pixelSize"][1]
        with Image.open(export / source["path"]) as image:
            crop = image.convert("RGBA").crop((r["x"],r["y"],r["x"]+r["w"],r["y"]+r["h"]))
            assert crop.getchannel("A").getbbox() is not None
    soil = manifest["sprites"]["terrain.soil.center"]
    with Image.open(export / manifest["sources"][soil["source"]]["path"]) as image:
        assert image.convert("RGBA").crop((0,80,16,96)).getchannel("A").getextrema() == (255,255)
    for pack in manifest["packs"].values():
        assert (export / pack["noticePath"]).read_bytes() == (ROOT / pack["noticePath"]).read_bytes()
        assert pack["licenseReview"] == "required-before-integration"
    ui = [e for e in provenance["files"] if e["originalPack"] == "sprout-ui-basic"]
    assert len(ui) == 2 and all(e["publicDeliveryStatus"] == "hold-for-UI-permission-review" for e in ui)
    git = ["git", "-c", f"safe.directory={ROOT.parent.as_posix()}", "-c", "core.safecrlf=false"]
    # A fixed source baseline includes all original paths. Disable rename detection
    # because the retained notices can otherwise count as renames after staging.
    # Comparing the baseline with the worktree also includes committed removals.
    deleted = subprocess.check_output(git + ["diff", "--no-renames", "--relative", "--name-only", "--diff-filter=D", "-z", status["sourceBaselineCommit"], "--", "assets"],cwd=ROOT).decode().split("\0")
    assert set(filter(None,deleted)) == set(entries), "Removed source paths must match only the backed-up original inventory"
    merge_base = subprocess.check_output(git + ["merge-base", "HEAD", "origin/main"],cwd=ROOT).decode().strip()
    changed = subprocess.check_output(git + ["diff", "--name-only", "-z", merge_base],cwd=ROOT).decode().split("\0")
    assert all(p.startswith("wordstead/") for p in changed if p), "No other game or root file may change"
    for script, flags in [("backup_assets.py", ["--destination",str(private.parent)]), ("export_private_starter.py", [])]:
        refusal = subprocess.run([sys.executable,str(OUT/script),*flags],cwd=ROOT,capture_output=True,text=True)
        assert refusal.returncode == 2 and "overwrit" in refusal.stderr, f"Existing destination guard: {script}"
    authored = list(OUT.glob("*.py")) + list(OUT.glob("*.json")) + list(OUT.glob("*.md"))
    for path in authored:
        for line in path.read_text(encoding="utf-8").splitlines():
            assert line.rstrip() == line, f"Trailing whitespace: {path.name}"
    result = {"status": "passed", "privateOriginalHashesVerified": 220, "preservedNoticesVerified": 3,
              "exactAliasGroupsVerified": 8, "privateExportSheetsVerified": 8, "privateStaticRectanglesVerified": 11,
              "removedOriginalSourcePathsVerified": 220, "otherGameChanges": False,
              "existingDestinationOverwriteGuards": "passed", "publicReleaseApproved": False,
              "schemaValidation": "JSON and data invariants checked; no full standards-engine validation"}
    with (OUT / "validation-report.json").open("w",encoding="utf-8",newline="\n") as output:
        json.dump(result,output,indent=2)
        output.write("\n")
    print(json.dumps(result,indent=2))


if __name__ == "__main__":
    main()
