# Proposed sprite registry

The [schema](sprite-manifest.schema.json) and [sample](sprite-manifest.sample.json) are a plain browser-compatible JSON proposal. There is no runtime game integration in this audit. The sample declares `purpose: "audit-proposal-not-runtime-approved"`; do not ship it wholesale because its source paths point into the full original packs.

The source packs now live in private storage. Configure the ignored `asset-organization/private-store.local.json` with `originalsDirectory` pointing to the private folder containing the three unchanged pack directories. The audit source resolver maps the original `assets/<pack>/...` identities to that location. This binding is for development/audit tools, never for browser runtime loading. See [organization progress](../asset-organization/README.md) for the actual private starter export.

## Coordinates and identity

- Use stable descriptive identifiers (`terrain.grass.center`, `building.chicken-coop`) in game/render code. The A-number source keys link back to this audit snapshot and can be replaced with descriptive source IDs during integration.
- `sources` stores the source path, pixel size, SHA-256 and pack ID. Paths are relative to the Wordstead entry URL, not relative to the JSON file. Resolve with `new URL(source.path, wordsteadEntryUrl)`; do not prepend the arcade repository name.
- `rect: {x, y, w, h}` uses integer source pixels from the top-left. `x + w` and `y + h` are exclusive edges. A rectangle can have any positive dimensions; there is no global tile size.
- `packs` preserves author, source URL, original notice path and a license-review status. “Verified” sprite geometry is not permission to distribute.
- `status: "manual-review"` with `rect: null` is intentionally unresolved. Never coerce null to `(0,0)` or load a placeholder slice as if verified.
- `artTileSpan` measures source art: a 48×48 coop covers three by three 16-pixel artwork units. `logicalFootprint` separately stores a proposed/approved game footprint or null. All sample footprints are null.
- Optional normalized `pivot` values are proposed/approved render decisions. They are not inferred from image dimensions, alpha bounds or the editor grid. Keep source-frame padding until anchor policy is chosen.

## Verified sample coordinates

| Sprite ID | Source ID | Rectangle `(x,y,w,h)` | Evidence |
| --- | --- | --- | --- |
| `terrain.grass.center` | A033 Grass.png | (16,16,16,16) | Center cell of upper-left 3×3 patch, coordinate overlay |
| `crop.grain.stage-yellow` | A009 Basic Plants.png | (48,0,16,16) | Yellow grain-like stage; species not asserted |
| `crop.purple-root.stage-large` | A009 | (64,16,16,16) | Complete crop stage, not the separate harvested item |
| `animal.chicken.pose-0` | A004 | (0,0,16,16) | Top-left populated chicken cell |
| `animal.chicken.pose-1` | A004 | (16,0,16,16) | Next populated cell; no playback semantics assigned |
| `animal.cow.pose-0` | A005 | (0,0,32,32) | Full cow frame, not a 16-pixel quarter |
| `building.chicken-coop` | A018 | (0,0,48,48) | Complete standalone building |
| `item.egg` | A016 | (0,0,16,16) | Complete standalone item; A017 is exact alias |
| `ui.rack.slot.rounded.light` | A044 | (0,0,48,48) | Full cell, retaining internal padding |
| `ui.rack.slot.square.light` | A044 | (0,48,48,48) | Next shape row; separate layout choice |
| `ui.button.blank.light` | A089 | (0,0,96,32) | Full top-left blank button cell |
| `ui.button.blank.partner` | A089 | (96,0,96,32) | Darker blank variant; state meaning unknown |

Thirty-four additional sample rectangles cover three verified winter animation strips. Their larger frames demonstrate variable dimensions and multi-unit art; they are not a recommendation to add seasonal animation to the MVP.

| Animation | PNG / source editor | Per-frame source rect | Count / timing |
| --- | --- | --- | --- |
| `winter.tree` | A180 / A179 | `(48*i, 0, 48, 64)`, i = 0…7 | 8 × 100ms |
| `winter.fire` | A181 / A182 | `(16*i, 0, 16, 16)`, i = 0…15 | 16 × 100ms |
| `winter.gift.red` | A185 / A184 | `(16*i, 0, 16, 16)`, i = 0…9 | 10 × 100ms |

All 34 source frames were decoded and matched to the PNG crops after normalizing invisible RGB. Per-frame durations come from the Aseprite frame headers. No source tag specifies looping: `loop: null` preserves that unknown. A future runtime must select a playback policy explicitly before activating these animations.

The candidate `review.chicken.two-pose` references verified coordinates but has `status: "manual-review"`, `timingStatus: "unverified"`, `durationMs: null` and `loop: null`. Its sequence grouping/order is only a review candidate. The unresolved crop entry also has no source rectangle. They illustrate honest unknowns and must be omitted from production exports.

## Browser consumption and validation

Render a verified source rectangle with Canvas `drawImage(image, x, y, w, h, dx, dy, dw, dh)` or an equivalent CSS atlas treatment. Calculate destination bounds from the responsive view and its chosen anchor. Keep logical board rows/columns, feature occupancy, score and pointer hit testing separate from all source pixel dimensions. A 32-pixel cow and a 16-pixel chicken can both represent one logical feature cell.

Use an explicit export allowlist and an approved-license/approved-mapping check before runtime use. Reject unresolved rectangles, references to absent sources, out-of-bounds crops, changed source hashes and animations with unresolved timing. A source update invalidates coordinate approval until rechecked. A static first frame is a fallback, not an inferred animation timing. Sample `reducedMotionFrame` values are proposed accessibility policy, not embedded creator metadata.

JSON Schema can validate structure, enums, numeric ranges, null handling and required fields. It cannot by itself verify source existence, image size, a crop's visual meaning, source hash, pack references, loop intent or permission. The companion audit validator checks the supplied snapshot's references, hashes, bounds and verified timing correspondence separately. The schema's URI format is an annotation unless a future validator enables format assertions.

When generating a production registry, remove `manual-review` entries, keep only selected approved source files, replace paths with the reviewed export paths and update source dimensions/hashes. Retain applicable notices/credits. If packing selected regions into a new atlas, record original and exported coordinates in a private provenance map; never reuse old pixel coordinates without remapping.

## Reproducing this audit

Use an existing Python 3 installation with Pillow. The bundled runtime used here is `C:/Users/regni/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`. No package installation or game build step is required.

From `wordstead/`, run in this order (PowerShell):

```powershell
$auditPython = 'C:\Users\regni\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $auditPython asset-audit/audit_assets.py --previews '<absolute-private-directory-outside-the-repository>'
& $auditPython asset-audit/inspect_details.py
& $auditPython asset-audit/build_catalog.py
& $auditPython asset-audit/validate_audit.py
```

The inventory script refuses to write previews inside the repository. These scripts overwrite only the generated audit metadata/catalog/sample and private derivative previews; original source files are opened read-only. They use the audit's recorded October 22 date and manually reviewed notes. Re-running after adding/renaming art requires updating those notes and reviewing the new snapshot, not blindly accepting reassigned A-numbers. The script uses Windows Consolas for preview labels.

The recorded inventory is the pre-organization snapshot. Use `validate_audit.py` to check its source hashes in private storage without regenerating it. `audit_assets.py` now enumerates only the three original pack directories via the resolver, so a future curated game export is not mixed into the original-pack inventory. `build_catalog.py` uses private file links when imported source folders are absent.

`repository-safety.json` records a separate read-only GitHub metadata/tree check and local historical observations; the scripts do not refresh that remote evidence. `ASSET-AUDIT.md` and the organization plan are editorial findings, not automatically regenerated. Review all dated claims when repeating the audit.
