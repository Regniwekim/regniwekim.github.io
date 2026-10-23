# Asset organization progress

October 22, 2026. This records implementation of the [organization plan](../ASSET-ORGANIZATION-PLAN.md), after the owner approved the private location, noncommercial use under bundled notices, the starter selection, the exact duplicate aliases, and local removal of backed-up source folders.

The owner subsequently requested a detailed commit and pull request for this work. The phase-completion observations below describe the earlier local organization step; they do not prohibit that subsequently authorized branch push and PR. `status.json` preserves the historical phase snapshot separately from this authorization.

## Completed

- Copied all **220 files / 19,837,064 bytes** to [private originals](E:/Wordstead-private-assets/cup-nooble/originals), preserving every original pack path and file byte. Verified each SHA-256 before copying, after copying, and again before local removal.
- Kept the backup inventory and full file-by-file [verification record](E:/Wordstead-private-assets/cup-nooble/provenance/backup-verification.json) privately. Created separate private `downloads`, `entitlement`, `provenance`, `previews` and `exports` directories; no receipts or additional permissions were supplied.
- Preserved three byte-identical original notices in [licenses/cup-nooble](../licenses/cup-nooble/), plus [credits and scope notes](../licenses/ASSET-CREDITS.md). Scoped Git attributes preserve notice bytes across checkout platforms. Updated the existing license document to use the retained notices.
- Removed the three complete pack folders from the Wordstead working tree only after verifying the private copies and notice copies. This removes **220 original source paths**; Git may show the three retained notices as renames. At completion of the local organization step, nothing had been staged, committed or pushed, and no history rewrite had occurred.
- Added Wordstead-scoped ignore rules for the exact full pack folders/ZIP names, Python caches and the machine-local storage binding. Ignore rules do not remove historical files or erase copies on GitHub.
- Recorded the eight approved [exact duplicate aliases](duplicate-alias-proposal.json). Both originals in every pair remain privately preserved; the starter crop sheet uses canonical `Basic_Plants.png`.
- Created the approved [private starter export](E:/Wordstead-private-assets/cup-nooble/exports/wordstead-starter): eight intact PNG sheets, 14,447 artwork bytes, **11 verified static sprite rectangles**, a JSON registry/schema, applicable notices and a provenance map. No art was added to the public working tree.
- Added a private-source resolver so the original audit's paths and hashes remain usable. The catalog now links to private originals. The pre-organization inventory remains a historical snapshot.

## Private starter contents

| Source | Purpose | State |
| --- | --- | --- |
| Sprites Basic `Grass.png` | Grass fill | Verified static center rectangle |
| Sprites Basic `Tilled_Dirt.png` | Chosen narrow soil family | Plain fill verified at `(0,80,16,16)`; edge/adjacency map unresolved |
| Sprites Basic `Basic_Plants.png` | Two crop stages | Verified coordinates transferred from byte-identical A009/A013 pair |
| Sprites Basic `Free Chicken Sprites.png` | Chicken bonus art | One verified static pose; animation deferred |
| Sprites Basic `Free Cow Sprites.png` | Cow bonus art | One verified static 32×32 pose |
| Sprites Basic `Free_Chicken_House.png` | Building bonus art | Verified 48×48 artwork; gameplay footprint undecided |
| UI Basic `Inventory_Blocks_Spritesheet.png` | Modular rack slots | Two verified slot regions; public delivery on hold |
| UI Basic `UI Big Play Button.png` | Blank menu/button art | Two verified blank regions; public delivery on hold |

The export is under `E:/Wordstead-private-assets/cup-nooble/exports/wordstead-starter/`. Its registry is at `assets/sprites/registry.json`; paths resolve against that export root. `purpose` is `private-local-preview`. All logical feature footprints remain null, animation tables are empty, audio is deferred and no pack font is included. No runtime game or public release is included.

The approved selection is recorded in [starter-selection.proposed.json](starter-selection.proposed.json). Its filename is retained from the review; its `status` field records approval. The source sheets remain intact and retain their original basenames. Private `provenance.json` maps original paths/hashes to the export paths; no atlas transformation was made.

## Local tooling

The ignored `private-store.local.json` contains this machine's absolute `originalsDirectory`. On another machine, create that JSON binding to an authorized private copy. Runtime code must never read it or request a private filesystem path.

Use the existing bundled Python described in the [registry guide](../asset-audit/SPRITE-REGISTRY.md#reproducing-this-audit):

```powershell
& $auditPython asset-audit/validate_audit.py
& $auditPython asset-organization/validate_organization.py
```

`backup_assets.py` and `export_private_starter.py` default to read-only preflight and require `--copy` / `--write` for their explicitly approved operations. Both refuse an existing destination; re-running them against the completed stores should refuse to overwrite. `prepare_proposals.py` refuses to reset an approved selection. The tools do not mutate Git, delete sources, send messages, publish, or rewrite history. The organization validator reads Git state and compares removals with the recorded source baseline, so it works before and after staging/committing.

## Decisions still requiring approval or clarification

- **Public source/history remediation:** the existing public `main` and historical ZIP exposure remain. Local deletions do not change production or remote history. A coordinated history/branch/artifact cleanup needs a separate concrete review and explicit authorization.
- **Public runtime subset:** this selection was approved for private preparation only. UI public browser/source delivery remains unresolved under its bundled notice. Confirm scope with the artist or approve an original/CSS UI alternative before preparing public runtime art.
- **Game rendering:** choose logical feature footprints, permitted overhang and pivots before wiring this art into board logic. No gameplay rules were inferred from the artwork.
- **Release work:** the owner's subsequent request authorizes committing these changes, pushing their branch and opening a PR. Merging, history rewriting, public game-art delivery, Pages settings, workflows, domain/DNS changes and arcade homepage edits remain outside this authorization.

Original assets were not modified or renamed. Only their verified imported working-tree copies were removed; every original remains in private storage, including exact duplicates, alternatives, editor files, font, audio and reference resources.
