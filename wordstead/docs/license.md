# Wordstead licenses and asset scope

## ESDB gameplay vocabulary (Milestone 3A)

The public game now includes a generated English word list from ESDB, pinned at
[`1e5b7d3a72f47a71da5d28686c1dd4b397178485`](https://github.com/en-wl/wordlist/tree/1e5b7d3a72f47a71da5d28686c1dd4b397178485).
Copyright 2000-2026 by Kevin Atkinson. The MIT-like permission expressly allows
redistribution of generated word lists, with copyright in copies and copyright
and permission in supporting documentation. The full
[upstream notice](../licenses/esdb/Copyright), including permission/disclaimer and
source acknowledgments, is preserved. The runtime list embeds its first section;
[browser credits](../vocabulary/index.html) expose the notices and attribution.

This American/neutral, US/neutral size-60 export uses neither Australian data nor
size levels above 80. Its generated-word-list scope does not require the additional
Australian/UKACD/database notices described upstream; the complete upstream text
is nevertheless retained. See [exact scope, filters and generation](vocabulary.md).
Keep the list and notices together when redistributing. This permission covers
ESDB-derived vocabulary only and grants no rights to Wordstead code or third-party
art. The existing asset review below is preserved.

## Existing third-party artwork review

Reviewed October 22, 2026. This document records the licenses supplied with the
third-party assets originally imported into `wordstead/assets/`. The originals
are now kept in the approved private asset store; their original notices are
preserved under `wordstead/licenses/`. This document does not license Wordstead's
design or source code, or grant additional rights to the assets.

**Asset credit: Sprout Lands assets by Cup Nooble.** Sprites Basic and Sorry
explicitly require credit; the UI pack's page requests credit, while its bundled
notice has no explicit attribution clause. Credit all three when used. Keep
their original `read_me.txt` notices and the applicable terms with selected
project assets. See [asset credits](../licenses/ASSET-CREDITS.md).

## Inventory and sources

The three extracted directories below originally contained 217 asset files and
three readmes. All 220 files were copied and hash-verified in private storage
before their approved removal from the working tree. The original ZIP archives
are absent from the current tree but remain in Git history. No history rewrite
or public game-art export was performed. Original notice copies remain here; no
additional license documents were supplied.

| Asset directory | Contents covered by the bundled notice | License source |
| --- | --- | --- |
| `Sprout Lands - Sprites - Basic pack` | Characters, objects, tilesets, palette images and Aseprite file, and reference animation | [Preserved readme](../licenses/cup-nooble/sprout-sprites-basic/read_me.txt), headed "License - Basic Pack" |
| `Sprout Lands - UI Pack - Basic pack` | UI sprite sheets, buttons, icons, cursors, dialogue, emoji and inventory/weather art, font and font previews | [Preserved readme](../licenses/cup-nooble/sprout-ui-basic/read_me.txt), headed "License - Free Basic Pack" |
| `Sprout Sorry pack` | Early Access sprites and Aseprite files, test characters/animations, and 22 WAV sound effects | [Preserved readme](../licenses/cup-nooble/sprout-sorry/read_me.txt), headed "License - Basic Pack" |

Author reference pages: [Cup Nooble](https://cupnooble.itch.io/),
[Sprout Lands - Asset Pack](https://cupnooble.itch.io/sprout-lands-asset-pack),
[Sprout Lands - UI Pack](https://cupnooble.itch.io/sprout-lands-ui-pack), and
[Sprout Sorry Pack](https://cupnooble.itch.io/sorry-package).
The bundled notices below record the terms included with these copies; the
upstream pages also describe separate premium licenses. No premium license or
other commercial permission was found among the supplied files.

## Summary of the bundled terms

- **Sprites Basic and Sorry packs:** Modification and non-commercial projects
  are allowed. NFT-related use and AI training are prohibited. Redistributing
  or reselling the asset pack itself is prohibited, including slightly modified
  versions. Projects made with the assets may be distributed, including open
  source projects, with Cup Nooble credited and the licensing terms included.
- **UI Basic pack:** Modification and non-commercial projects are allowed.
  Redistribution or resale, even after modification, is prohibited. The notice
  excludes NFTs and directs commercial users to contact the creator or buy the
  Premium version. It does not include the other packs' explicit project/open
  source redistribution exception or AI-training clause. We retain Cup Nooble
  credit as requested on the source page and as the project's credit policy.

These are custom author terms, not a standard open-source license. The complete
bundled license sections are reproduced below, with surrounding whitespace
normalized. The summaries do not replace them.

## Bundled font

The UI pack includes
`pixelFont-7-8x14-sproutLands.ttf` (audit ID A062; see the
[font catalog](../ASSET-CATALOG.md#fonts)). The font remains private and is not
included in the starter export.
Its embedded name records identify the designer as Cup Nooble and the version
as 1.0. It contains no copyright, license-description, or license-URL name
record. No separate font license was supplied; the UI pack's readme is the
only bundled license notice for this font and its PNG previews.

## Redistribution question to resolve

The UI notice has no explicit project/open-source redistribution exception.
The owner confirmed noncommercial use with the bundled notices only. Confirm
the UI pack's permitted public browser/source scope with Cup Nooble before
relying on such an exception for a public release. UI artwork in the private
starter export remains on hold for public delivery. The Sprites and Sorry notices provide the contact
`cup_nooble` on Discord for questions or different licensing terms.

## Sprites Basic and Sorry: supplied license section

The license sections in these two packs are identical after whitespace
normalization. Both label the terms "Basic Pack", including the Sorry pack's
Early Access, Audio, and Tests directories; no separate notices were found for
those subdirectories.

```text
>>> License - Basic Pack

----------

- You can modify the assets.

[ Feel free to get creative and make your own sprites in this style or use them as reference for your own ]
[ Making additional sprites in the same style or using them as reference for your own project is also allowed ]

----------

- You can use these assets in any kind of non-commercial projects.

[ Except anything to do with NFTs or AI training is not allowed ]

----------

- You can not redistribute the asset pack itself or resell it on other platforms, even if it is slightly modified.

[ Of course, you can redistribute your own projects made with these assets like games, software, or other ]
[ Making your project opensource is also allowed ]
[ For open source projects include a note that says some or all assets are made by Cup Nooble together with the licensing terms ]

----------

- Credit is required : (Cup Nooble)

[ Credit example : Assets -From : Sprout Lands -By : Cup Nooble ]
[ If you share your game on itch.io a link to the Asset Packs page would be very appreciated ]
[ But feel free to credit in whatever way fits your project best ]
[ Thanks a lot for reading ^^ ]

----------

~ And most importantly hope you have fun with your project !!!

? And if you have questions or need/want different licensing terms please reach out to me and I can work with you on a license that suits your needs.
My Discord : cup_nooble
```

## UI Basic: supplied license section

```text
License - Free Basic Pack
- You can modify the assets.
- You can not redistribute or resale, even if modified.
- You can only use these assets in non-commercial projects. [ Also No NFT's pls ]
( If you want to make something commercial with these sprites contact me or buy the Premium version )
```
