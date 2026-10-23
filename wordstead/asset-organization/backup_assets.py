"""Copy audited originals to approved private storage without changing source files.

Default is a read-only preflight. --copy creates a NEW destination and verifies
every copied file. An existing destination is never merged into or overwritten.
"""
import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "asset-audit" / "inventory.json"


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def reject_links(path):
    for item in [path, *path.parents]:
        if item.is_symlink() or (hasattr(item, "is_junction") and item.is_junction()):
            raise ValueError(f"Symlink/junction is not supported for this backup: {item}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", type=Path, required=True)
    parser.add_argument("--copy", action="store_true", help="Create the approved private backup after preflight")
    args = parser.parse_args()
    if not args.destination.is_absolute():
        parser.error("Destination must be an absolute private path")
    reject_links(args.destination)
    destination = args.destination.resolve()
    if destination == ROOT.parent or ROOT.parent in destination.parents:
        parser.error("Private backup must be outside the arcade repository")
    if destination == Path(destination.anchor) or destination.exists():
        parser.error("Destination must be a new dedicated directory; existing paths are never overwritten")
    data = json.loads(INVENTORY.read_text(encoding="utf-8"))
    entries = data["files"]
    seen = set()
    pack_roots = set()
    for entry in entries:
        relative = Path(entry["path"])
        if relative.is_absolute() or ".." in relative.parts or relative.parts[0] != "assets" or len(relative.parts) < 3:
            raise ValueError(f"Unsafe inventory path: {relative}")
        source = ROOT / relative
        reject_links(source)
        if relative.as_posix() in seen:
            raise ValueError(f"Duplicate inventory path: {relative}")
        seen.add(relative.as_posix())
        pack_roots.add(relative.parts[1])
        if not source.is_file() or source.stat().st_size != entry["bytes"] or digest(source) != entry["sha256"]:
            raise ValueError(f"Source differs from audited inventory: {relative}")
    actual = {p.relative_to(ROOT).as_posix() for name in pack_roots for p in (ROOT / "assets" / name).rglob("*") if p.is_file()}
    if actual != seen:
        raise ValueError("Original pack file set differs from inventory; audit before copying")
    total = sum(entry["bytes"] for entry in entries)
    print(json.dumps({"mode": "copy" if args.copy else "preflight-only", "sourceFiles": len(entries),
                      "sourceBytes": total, "destination": str(destination), "sourceHashesVerified": True}))
    if not args.copy:
        return
    destination.mkdir(parents=True, exist_ok=False)
    results = []
    for entry in entries:
        relative = Path(entry["path"])
        target = destination / "originals" / Path(*relative.parts[1:])
        target.parent.mkdir(parents=True, exist_ok=True)
        with (ROOT / relative).open("rb") as source, target.open("xb") as output:
            shutil.copyfileobj(source, output)
        if digest(target) != entry["sha256"] or digest(ROOT / relative) != entry["sha256"]:
            raise ValueError(f"Backup/source verification failed: {relative}; no source files were deleted")
        results.append({"originalPath": entry["path"], "privatePath": target.relative_to(destination).as_posix(),
                        "packId": entry["pack_id"], "bytes": entry["bytes"], "sha256": entry["sha256"]})
    for name in ("downloads", "entitlement", "provenance", "previews", "exports"):
        (destination / name).mkdir(exist_ok=False)
    with (destination / "provenance" / "audit-inventory.json").open("xb") as output:
        output.write(INVENTORY.read_bytes())
    report = {"verifiedAtUtc": datetime.now(timezone.utc).isoformat(), "status": "verified",
              "destination": str(destination), "filesVerified": len(results), "bytesVerified": total,
              "sourceFilesChanged": False, "files": results}
    with (destination / "provenance" / "backup-verification.json").open("x", encoding="utf-8", newline="\n") as output:
        json.dump(report, output, indent=2)
        output.write("\n")
    print(json.dumps({k: v for k, v in report.items() if k != "files"}))


if __name__ == "__main__":
    main()
