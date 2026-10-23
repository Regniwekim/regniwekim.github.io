"""Resolve immutable audit paths from imported folders or the private originals.

Inventory paths stay historical and portable. The machine-local private root is
kept in an ignored configuration file rather than in sprite source metadata.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "asset-organization/private-store.local.json"
PACK_DIRECTORIES = (
    "Sprout Lands - Sprites - Basic pack",
    "Sprout Lands - UI Pack - Basic pack",
    "Sprout Sorry pack",
)


def private_originals():
    if not CONFIG.is_file():
        raise FileNotFoundError(
            "Originals are absent. Configure asset-organization/private-store.local.json "
            "with an absolute originalsDirectory outside this repository."
        )
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    folder = Path(config["originalsDirectory"])
    if not folder.is_absolute():
        raise ValueError("Private originalsDirectory must be absolute")
    folder = folder.resolve()
    if folder == ROOT.parent or ROOT.parent in folder.parents:
        raise ValueError("Private originalsDirectory must be outside the repository")
    if not folder.is_dir():
        raise FileNotFoundError(f"Private originalsDirectory is missing: {folder}")
    return folder


def pack_directory(name):
    if name not in PACK_DIRECTORIES:
        raise ValueError(f"Unknown source pack directory: {name}")
    imported = ROOT / "assets" / name
    return imported if imported.is_dir() else private_originals() / name


def asset_path(relative):
    relative = Path(relative)
    if relative.is_absolute() or ".." in relative.parts or len(relative.parts) < 3 or relative.parts[0] != "assets":
        raise ValueError(f"Unsafe original asset path: {relative}")
    return pack_directory(relative.parts[1]) / Path(*relative.parts[2:])


def iter_original_files():
    for name in PACK_DIRECTORIES:
        folder = pack_directory(name)
        if not folder.is_dir():
            raise FileNotFoundError(f"Missing original pack: {folder}")
        for path in folder.rglob("*"):
            if path.is_file():
                yield (Path("assets") / name / path.relative_to(folder)).as_posix(), path


def catalog_target(relative):
    """Use a working relative link while imported, otherwise an absolute private link."""
    imported = ROOT / relative
    return relative if imported.is_file() else asset_path(relative).as_posix()
