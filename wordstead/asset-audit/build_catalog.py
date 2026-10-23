"""Build catalog, per-image review notes, registry proposal, and private browser index.

All sprite rectangles in this proposal were inspected at source-pixel scale.
This script does not integrate, relocate, or rewrite any artwork.
"""
import html
import json
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote

sys.dont_write_bytecode = True
from audit_assets import ROOT, OUT
from asset_sources import catalog_target

audit = json.loads((OUT / "inventory.json").read_text(encoding="utf-8"))
files = audit["files"]
by_id = {e["id"]:e for e in files}
notes = {}


def note(ids, description, layout, confidence="visual-family-verified"):
    for ident in ids.split():
        notes[ident] = {"description":description,"layout":layout,"confidence":confidence}


note("A001", "Cat character using hoe-like tool, axe, and watering can in four facing rows per action.", "48x48 observed frame pitch; 2 columns x 12 rows; zero inter-cell gutter/outer margin; internal transparent padding. Action names/order and timing need review.")
note("A002", "Cat character poses in four facing rows, with repeated motion poses across columns.", "48x48 observed frames; 4x4; margin/gutter 0; timing and exact idle/walk grouping unverified.")
note("A003", "Egg, small egg, nest with egg, and empty nest.", "Four 16x16 cells in one row; transparent padding inside cells; static variants, not a verified animation.")
note("A004", "Chicken poses; two populated cells in top row, four in bottom row.", "16x16 cells, 4x2; margin/gutter 0; six populated cells; timing and sequence unverified.")
note("A005", "Cow poses; three populated upper frames and two lower frames.", "32x32 cells, 3x2; margin/gutter 0; five populated cells. Not 16x16; timing/sequence unverified.")
note("A006", "Watering cans, axes, and hoe-like tools in multiple orientations.", "16-pixel alignment, 6x6 base units; orientation/pose variants. Verify complete tool bounds before registration.")
note("A007 A011", "Beds, chairs, tables, clocks, small storage furniture, flowers, and rugs.", "Mixed 16-pixel aligned props, including objects spanning several base units; no universal sprite size.")
note("A008 A012", "Trees, bushes, mushrooms, rocks, flowers and small collected items.", "Mixed 16-pixel aligned regions; taller trees span multiple units. Species beyond obvious motifs need review.")
note("A009 A013", "Grain-like and purple-root crop progression, seed bags, harvested item icons.", "16x16 cells, 6x2, margin/gutter 0; each row combines static growth stages and item icons. Growth is not a timed animation.")
note("A010 A014", "Watering can, axes, stone-like material and wood-like item icons.", "Six 16x16 item cells in 3x2 layout, margin/gutter 0.")
note("A015", "Chest opening poses and orientations.", "48x48 observed pitch; 5x2; internal padding. Multiple pose/orientation groups; timing unverified.")
note("A016 A017", "Single egg item.", "Single 16x16 image; no atlas margin/gutter.")
note("A018", "Chicken coop with roof, doorway and ramp.", "Single 48x48 sprite; 3x3 artwork units of 16. Does not imply a 3x3 gameplay footprint.")
note("A019", "Wooden stepping/plank paths and connecting arrangements.", "Mixed 16-pixel base units; assembled path forms must be registered as complete regions.")
note("A020 A021", "Milk bottles at different fill levels and grass-like item.", "Four 16x16 cells in one row; static item/fill variants.")
note("A022 A023", "Wood bridge orientations and segments.", "Mixed modular regions on 16-pixel base units (5x3 canvas units); not one sprite per cell.")
note("A024 A063 A216", "Original author readme and custom license notice; preserve unchanged.", "Text document; no image layout.", "text-verified")
note("A025", "Palette screenshot including editor chrome.", "236x371 reference capture; do not treat as sprites.")
note("A026 A027", "Small color palette resource.", "16x7 color swatch image/editor canvas. Aseprite has one indexed-color frame; editor grid 16x16 is not a sprite grid.")
note("A028 A029", "Bitmask/autotile layout diagrams; second includes additional grid subdivision.", "Reference diagrams, not production texture sheets. No universal bitmask-number mapping inferred.")
note("A030", "Animated tile-layout reference with labels and demonstration area.", "183 composited GIF frames, 100ms each; loop metadata 0. Full 540x540 reference scene, not terrain frame rectangles.")
note("A031", "Wooden door poses/parts.", "16x64 canvas; vertical 16-pixel units. Door extents and sequence require review; do not assume four complete 16x16 doors.")
note("A032", "Wood fence posts, rails, corners and connections.", "4x4 canvas of 16x16 base tiles; includes connecting artwork at cell boundaries. No enclosure-rule mapping supplied.")
note("A033", "Grass edges, corners, inner corners, center fills and decorative patches.", "11x7 canvas of 16x16 terrain units, margin/gutter 0; not all units occupied. Autotile index policy unverified.")
note("A034", "Raised grassy cliff/hill edges, soil faces and stairs.", "11x9 canvas of 16x16 construction units; assembled heights span units; collision/elevation not encoded.")
note("A035", "Older/differently arranged tilled soil edges and patches.", "128x128, mixed layout on 16-pixel alignment; differs from underscore-named 176x112 sheets.")
note("A036 A037 A038 A039", "Tilled soil terrain, inner/outer corners, fill/decorations; narrow/wide and v2 alternatives.", "11x7 canvas of 16x16 base terrain units; zero packing gutter/margin. Different arrangements and edge styles; not interchangeable by filename.")
note("A040", "Water fill variations.", "Four 16x16 cells in one horizontal row, margin/gutter 0. No timing metadata: variants versus animation not established.")
note("A041 A042 A043", "Modular wooden house roof/wall/door components; sheets overlap in subject matter.", "16-pixel construction alignment, multi-tile regions. Compose buildings explicitly; never assign sheet dimensions as board occupancy.")
note("A044", "Nine inventory slot blocks: three shapes/sizes by three tan shades.", "3x3 cells at 48x48 pitch, margin/gutter 0. Visible bounds vary: first [9,9,30,32], last-row light [3,98,42,44]. Not uniform 16x16 art.")
note("A045 A046 A050 A051", "Premade brown/light inventory bars with a five-heart tab; two widths.", "Single composed panel per file (352x96 or 304x96); embedded heart artwork. Prefer modular DOM rack.")
note("A047 A048 A052 A053", "Premade inventory bars with slots and five-heart tab; wide version has seven slots, narrow version six.", "Single composed panel per file; fixed embedded slot count is unsuitable as responsive layout logic.")
note("A049 A054", "Heart fill/progress states, heart tabs and inventory panel pieces in two palettes.", "Mixed-region vertical sheets, not uniform animation strips; component extents/9-slice insets need review.")
note("A055", "Combined inventory hearts, tabs, blocks, corner pieces and bars.", "Composite atlas overlaps dedicated inventory sheets; no new canonical source chosen during audit.")
note("A056", "Sun/cloud, moon/cloud and warm-toned weather icon variants.", "32x32 observed pitch, 2x3; internal padding; static weather/time variants, no verified timing.")
note("A057", "Weather display frame, label field and small weather/navigation motifs.", "Mixed component atlas; no uniform grid or verified stretch/9-slice regions.")
note("A058", "Small expressive faces, animals, farm items, gestures, and other emoji icons.", "16x16 observed base pitch, 10x38 canvas units; mixed occupancy. Individual semantics require review; not 380 verified icons.")
note("A059", "Grey speech bubbles of different sizes with small tail/indicator shapes.", "Mixed regions with large blank areas; explicit rectangles required.")
note("A060 A061", "Bitmap glyph reference images; large preview is exactly a nearest-neighbor 4x copy of the smaller image.", "118x106 original reference and 472x424 preview; variable glyph extents, no verified font-atlas character map.")
note("A062", "Cup Nooble pixelFont-7-8x14-sproutLands Regular, version 1.0; 82 glyph records.", "TTF, 2304 units/em; glyph count is not Unicode coverage. No embedded license records 0/13/14; separate font permission not supplied.", "font-metadata-verified")
note("A064", "Small round/square buttons in pale and tan color/state pairs.", "16x16 observed cells, 2x8; margin/gutter 0; some artwork touches adjacent cell edges. Which state means disabled/pressed is unverified.")
note("A065", "Tall rounded buttons in multiple palettes/state pairs; filename says 19x26.", "Actual observed cell pitch 32x48 (4x2), margin/gutter 0. First visible bounds [7,9,18,30], so filename is not the crop size.")
note("A066", "Wide rounded buttons in multiple palettes/state pairs; filename says 26x19.", "Actual observed cell pitch 48x32 (2x4), margin/gutter 0. First visible bounds [11,6,26,19], partner [59,7,26,18].")
note("A067", "Square buttons in multiple palettes/state pairs; filename says 26x26.", "Observed cell pitch 48x48 (2x4), margin/gutter 0. Visible bounds first [11,11,26,28], partner [59,11,26,26].")
note("A068 A070 A071 A072", "Dialogue bubbles/panels in several widths and small base form.", "Single regions within transparent canvas. 9-slice corners/content insets not verified; do not stretch rasterized text.")
note("A069", "Dialogue continue indicator with successive shape changes.", "Seven 16x16 cells across 112x16 strip; timing and intended loop unknown.")
note("A073", "Teemo/cat portrait emotes and pose sequences.", "32x32 observed pitch, 5x15; sparse rows with different frame counts. Timing, expression names and grouping need review.")
note("A074 A075 A076", "Premade portrait frame plus dialogue panel in three widths.", "Single composition per file; named big/medium/small, with static portrait placeholder.")
note("A077 A080", "Interface glyphs including controls, question mark, money, basket, calendar, trophy, crown, check and cross; white and multicolor rows.", "16x16 observed pitch; All Icons 18x3, white subset 6x3. Dedicated sheet/composite atlas overlap; glyph meaning must be paired with text.")
note("A078", "Colored happiness/sadness-style face icons with bordered alternatives.", "16x16 observed pitch, 6x2; static state variants.")
note("A079", "Stars, hearts and small bar-like icons in colored fill/outline styles.", "16x16 observed pitch, 7x4; variants/states, no timed animation verified.")
note("A081 A082 A083", "Cat-paw cursor/gesture variants.", "Single 16x16 image each; pointer hotspot not documented.")
note("A084 A085 A086", "Three triangular cursor treatments with distinct outline/shadow pixels.", "Single 16x16 image each; visually similar but not duplicates; hotspot unverified.")
note("A087", "Settings menu panels, one with an embedded SETTINGS heading.", "Two 128x144 composition regions; panel/frame text insets require review.")
note("A088", "Composite Basic UI atlas containing buttons, icons, dialogue and settings components.", "896x240 mixed packed regions. Overlaps dedicated sheets; do not slice the entire image on a universal grid.")
note("A089", "Four large buttons: blank and PLAY labels, light/darker partner variants.", "96x32 observed cells, 2x2; margin/gutter 0. First visible [3,2,90,27]; partner [99,4,90,25]. Semantic state assignment unverified.")
note("A090", "Settings labels, round controls, toggles, sliders/levels and speaker motif.", "128x240 mixed regions; state relationships and slider stretch slices need review.")
for n in range(91,113):
    ident=f"A{n:03}"
    note(ident, f"Author-labeled sound effect: {Path(by_id[ident]['path']).stem}. Not auditioned; intended event association unverified.", "PCM WAV: 22050 Hz, stereo, signed 16-bit. Identical channels; large quiet tail indicated by amplitude scan.", "metadata-only-audio-review")
note("A113 A115", "Bat animation reference GIFs, large and small bat; opaque background.", "16 GIF frames at 100ms, loop metadata 0; 64x64 preview canvas is not the PNG sprite frame size.")
note("A114 A116", "Large/small bat poses including flying/grounded or collapse-like phases.", "32x32 observed pitch, 6x2; sparse cells. Do not transfer GIF timing/order without exact frame correspondence.")
note("A117", "Green slime motion/deformation sequences across rows.", "38x38 observed candidate pitch, 12x8; variable populated row lengths. NOT 16x16; grouping and timing unverified.", "visual-family-verified-layout-candidate")
note("A118", "Mine cart variants/orientations.", "16-pixel alignment; some cart forms span more than one base unit.")
note("A119", "Pickaxe, ore/ingot-like items, gems and bottles/jars.", "16x16 observed item cells, 5x3; species/material names beyond clear motifs unverified.")
note("A120", "Crates, barrels, containers and tables/storage props.", "Mixed 16-pixel aligned props with multi-tile objects.")
note("A121 A122", "Dungeon walls, doors, archways, gates and decorative elements, including colored variants.", "Mixed modular regions on 16-pixel base alignment; collision and connection maps absent.")
note("A123 A124", "Orange dirt modular terrain, darker variant.", "11x11 canvas of 16x16 base units; includes several region groups and fill variations.")
note("A125 A126", "Ladder/hole ground variants on orange dirt.", "Four 16x16 cells across; static alternatives, not established animation.")
note("A127", "Mine rails and a junction/turning assembly.", "64x48 mixed modular layout; 16-pixel alignment with multi-tile forms.")
note("A128", "Rocks and colored ore/crystal outcrops.", "16-pixel alignment, 4x4 canvas; variable object bounds.")
note("A129", "Lever/switch poses.", "Three 16x16 cells across; sequence and timing unverified.")
note("A130 A138 A139", "Fish swimming/turning poses in three sizes.", "Fifteen 16x16 cells across each strip; facing/motion progression observed, no timing supplied.")
note("A131", "Fish, aquatic motifs, containers and other item icons.", "16-pixel alignment, 10x5 canvas; individual species/semantics require review.")
note("A132 A133 A134", "Fishing character sequences viewed from back, front and side.", "48x48 observed candidate pitch, 32x6 canvas; variable populated row lengths, exact action groups and timing unknown.", "visual-family-verified-layout-candidate")
note("A135", "Fishing rod, float and water-splash pose/effect elements.", "Sparse mixed effect regions; 48-pixel pitch candidate only, not a verified universal frame grid.", "visual-family-verified-layout-candidate")
note("A136 A137", "Two fishing rod item icon variants.", "Single 16x16 image each, different visible pixels.")
note("A140", "Cat swimming poses/facings.", "48x48 observed pitch, 8x8; groups and timing need review.")
note("A141 A144", "Bee wing/body poses in two sizes.", "Eight 16x16 frames in a row, margin/gutter 0; timing and order unverified.")
note("A142 A145", "Beehive structures in large/small forms.", "Single 32x32 / 16x32 sprites; visible size does not determine gameplay footprint.")
note("A143", "Honey jars, honeycomb, bread and preserve-like food items.", "16x16 observed item cells, 4x4; some empty cells; flavor/type names unverified.")
note("A146 A148 A174", "Biome water plants including reeds and lily-pad-like vegetation.", "16-pixel alignment with multiple adjacent small variants; identify full plant bounds individually.")
note("A147 A149 A175", "Author-labeled birch, cherry-blossom and pine biome trees, growth stages, stumps, bushes and items.", "Mixed 16-pixel aligned regions; canopies and trunks span multiple units. Preserve species labels only where supplied by filenames.")
note("A150", "Seed packets, harvested crops and food/produce icons.", "16x16 observed item pitch, 5x14; individual crop labels absent; manual review of species required.")
note("A151 A152", "Many crop growth stages; watered/unwatered alternatives, including obvious grain, pumpkin-like, sunflower-like and climbing forms.", "16-pixel base alignment, 112x528 canvas. MIXED HEIGHTS: some growth rows are 16 high, tall stages cross row boundaries (top crop spans 32 high); no universal row-to-species map. Timing absent.")
note("A153 A154", "Frog pose/motion sheets in two color treatments.", "16x16 observed pitch, 14x6; sparse row groups with different lengths; timing and action labels unverified.")
note("A155 A156 A157 A160 A161 A162", "Chest pose/orientation sheets: birch, cherry, gold, oak, pine, silver by supplied names.", "32x32 observed pitch, 5x2; do not reuse Basic chest 48x48 rectangles. Opening/rotation grouping and timing unverified.")
note("A158", "Small inventory icons for furniture in multiple wood/color variants.", "16x16 observed pitch, 12x5; sparse final row, no timings.")
note("A159", "Beds, chairs, tables and storage furniture in multiple palettes.", "Mixed 16-pixel aligned multi-tile objects. Unlike the small item-icon sheet, not a uniform one-cell atlas.")
note("A163 A164 A165 A166 A167 A168 A169 A170", "Grass tile layers, texture details and vegetation accents in normal/blue-tinted and numbered alternatives.", "16-pixel base units; mostly 11x25 canvas, A168 is 10x25. Numbered variants are not interchangeable or proven animation frames.")
note("A171", "Picnic basket item.", "Single 16x16 sprite.")
note("A172", "Picnic blanket.", "Single 48x48 sprite, 3x3 artwork units; not a 3x3 game footprint declaration.")
note("A173", "Picnic food/ingredient variants.", "16x16 observed pitch, 7x2; sparse second row; recipe/species names need review.")
note("A176", "Trees, stumps, bushes, fruit/wood-related items and growth variants.", "Mixed 16-pixel aligned regions, with multi-tile tree canopies and smaller items.")
note("A177", "Wood/log icons and mushroom-like items in multiple colors/types.", "16x16 observed item pitch, 6x5, some blank positions; species unverified.")
note("A178", "Campfire wood/fire states in multiple arrangements.", "16-pixel aligned mixed stages, including larger multi-tile fires. Timing absent.")
note("A179 A180", "Decorated Christmas tree with changing lights.", "Aseprite/PNG verified pair: 8 frames, 48x64 each, horizontal strip, margin/gutter 0, 100ms per frame. No animation tags or loop semantics.")
note("A181 A182", "Small fire/flame animation.", "Aseprite/PNG verified pair: 16 frames, 16x16 each, horizontal strip, margin/gutter 0, 100ms per frame. No tags/loop semantics.")
note("A183", "Ice surface/edge motifs.", "64x48 canvas on 16-pixel alignment; full patch/edge regions need review.")
note("A184 A185 A190", "Red gift/present opening animation, two PNG aliases.", "Aseprite/PNG verified pair: 10 frames, 16x16, horizontal, margin/gutter 0, 100ms per frame. No tags; one-shot playback would be a game design choice.")
note("A186 A187 A188 A189", "Gift-opening strips with alternate wrapping/ribbon colors/patterns.", "Ten 16x16 cells across. Visually aligned with red gift, but timing not automatically inherited from the separately verified Aseprite pair.")
note("A191", "Tiny snowflake/particle shapes.", "16x48 sparse mixed symbols; not a verified animation strip.")
note("A192 A193", "Snow terrain with edges, interior variations and small details.", "11x25 canvas of 16-pixel base units; two visual alternatives; no animation metadata.")
note("A194", "Candy canes, gingerbread-like food and warm drink item icons.", "16x16 observed pitch, 2x4.")
note("A195", "Snow-covered trees, snow figures, candy canes, gifts and seasonal decorations.", "Mixed 16-pixel aligned multi-tile decorations and item-size variants.")
note("A196 A206 A210", "Separate building ground-shadow masks.", "96x32 or 64x16 image. Alignment relative to building base not documented; near resemblance is not duplication.")
note("A197 A198 A199 A200", "Three grey-brick building variants, with combinations of doors and grass details.", "Three 96x80 composition cells horizontally, margin/gutter 0; door/grass variants are alternatives, not an animation sequence.")
note("A201 A202 A203 A204 A205 A207 A208 A209", "Nine small-house roof colors; light/dark wall versions, doors and grass variants.", "3x3 composition cells of 64x64, margin/gutter 0; static alternatives, not nine animation frames.")
note("A211 A212 A213 A214", "Nine small-hut roof colors, plus door/grass combinations.", "3x3 composition cells of 64x64, margin/gutter 0; static alternatives.")
note("A215", "Wooden door turn/open poses for village buildings.", "Eight 48x48 observed cells in one row; generous internal padding. Timing/grouping unverified.")
note("A217", "Experimental human-like character poses in eight facings/variants.", "16x32 observed pitch, 8x3; row sequence/action semantics unverified.")
note("A218 A220", "Enlarged experimental character demonstration GIF with background and author labeling.", "Eight 100ms GIF frames; loop metadata 0; display composition is not a runtime character atlas.")
note("A219", "Experimental Teemo/cat in eight facings across three pose rows.", "16x16 observed cells, 8x3; mapping between rows and GIF timing not verified.")

assert set(notes) == set(by_id), sorted(set(by_id)-set(notes))
(OUT / "catalog-notes.json").write_text(json.dumps(notes,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")

preview = Path(audit["preview_directory"])
groups = defaultdict(list)
for e in files: groups[e["category"]].append(e)

lines = ["# Wordstead asset catalog", "", "Audited October 22, 2026. Every one of the 220 source files is listed below. Original files remain unchanged.", "",
         "The full pack folders now live in approved private storage. Original relative paths remain the audit identities; filename links resolve to private originals when the imported folders are absent. Retained notices and current organization status are documented in [organization progress](asset-organization/README.md).", "",
         "IDs A001–A220 are identifiers for this audit snapshot; use named sprite IDs for runtime code. Paths below are relative to `wordstead/assets/`. Pack prefixes preserve provenance. Exact sizes and full SHA-256 hashes are in [inventory.csv](asset-audit/inventory.csv) and [inventory.json](asset-audit/inventory.json).",
         "", "## Browsing previews", "", f"Artwork previews are private local derivatives outside Git: [Open labeled gallery](<{(preview / 'index.html').as_posix()}>). It contains 19 contact sheets covering all 190 PNG/GIF files, 18 coordinate overlays, and three decoded Aseprite first-frame previews. These machine-local links must not be copied into a public artifact release.", "",
         "All contact sheets and coordinate overlays were visually examined. Thumbnails show GIF frame zero; complete GIF frame metadata was decoded. Audio was measured, not auditioned. An observed grid describes source layout, not gameplay occupancy or documented animation semantics. Blank cells are not sprites. No named crop species map is supplied for the large growth sheets.", "",
         "## Pack keys", "", "| Key | Original directory | Files |", "| --- | --- | ---: |",
         "| S | Sprout Lands - Sprites - Basic pack | 43 |", "| U | Sprout Lands - UI Pack - Basic pack | 47 |", "| X | Sprout Sorry pack | 130 |", "",
         "## Wordstead shortlist", "", "| Need | Candidates | Decision / caveat |", "| --- | --- | --- |",
         "| Farm board terrain | A033 Grass; A036–A039 soil; A040 water | Choose one soil edge family; adjacency map remains to be authored. |",
         "| Crop bonus cells | A009/A013 Basic Plants; later A151/A152 | Start with one static stage; large crop sheet has mixed heights and unlabeled species. |",
         "| Livestock bonus cells | A004 chicken; A005 cow; optional A141 bee | Cow art uses 32x32 frames; scale into a logical cell without changing its coordinates. |",
         "| Buildings | A018 coop; A201/A211 small houses/huts; A197 brick houses | Prefer static compact silhouettes; large art can overhang a one-cell feature if the design approves. |",
         "| Decorations | A008/A012; A176 trees; A171/A172 picnic; A022 bridge | Keep away from letters and hit targets; no collisions inferred from artwork. |",
         "| Score/progress | A079 stars/hearts; A049/A054 fill variants | Use real numeric text/progress semantics; hearts need not mean health. |",
         "| Seven-letter rack | A044 slot blocks; A064/A067 buttons | Seven DOM slots; A047/A052 show seven-slot composition, while A048/A053 show six. |",
         "| Menus/buttons | A065–A067; A089 blank button cells; A068/A070 panels | Render accessible text separately; no verified 9-slice insets yet. |",
         "| Restrained feedback | Static crop stage change; A069 continue indicator; optional sound A091/A092 | PNG timing unknown. Fire/gift/tree have verified timing but are seasonal examples, not required MVP content. |", ""]
for category, entries in sorted(groups.items()):
    lines += [f"## {category}", ""]
    seen_previews = sorted({e["preview"] for e in entries if "preview" in e})
    if seen_previews:
        lines += ["Previews: " + ", ".join(f"[{name}](<{(preview/name).as_posix()}>)" for name in seen_previews) + ".", ""]
    lines += ["| ID | Pack / original relative filename | Format / dimensions or duration | Bytes | Content and layout |", "| --- | --- | --- | ---: | --- |"]
    for e in entries:
        pack={"sprout-sprites-basic":"S","sprout-ui-basic":"U","sprout-sorry":"X"}[e["pack_id"]]
        local="/".join(e["path"].split("/")[2:])
        metric=e["format"]
        if "width" in e: metric+=f" · {e['width']}×{e['height']}"
        if e.get("frames",1)>1: metric+=f" · {e['frames']} frames"
        if "duration_seconds" in e: metric+=f" · {e['duration_seconds']:.6f}s"
        if e["format"]=="TTF": metric+=" · 82 glyph records"
        n=notes[e["id"]]
        desc=n["description"]+" "+n["layout"]
        if "candidate" in n["confidence"] or "review" in n["confidence"]: desc+=" **Manual review required.**"
        target = catalog_target(e['path'])
        lines.append(f"| {e['id']} | {pack}: [{local}](<{quote(target, safe='/ :')}>) | {metric} | {e['bytes']:,} | {desc} |")
    lines.append("")
(ROOT/"ASSET-CATALOG.md").write_text("\n".join(lines),encoding="utf-8")

# Machine-readable registry proposal. Names do not rename source files.
packs={}
for e in files:
    if e["pack_id"] not in packs:
        readme=next(f for f in files if f["pack_id"]==e["pack_id"] and f["format"]=="TXT")
        packs[e["pack_id"]]={"author":"Cup Nooble","sourceUrl":e["source_url"],"noticePath":readme["path"],"licenseReview":"required-before-integration"}
sources={}
sprites={}
def sprite(name,ident,rect,evidence,art_span=None):
    e=by_id[ident]
    sources[ident]={"path":e["path"],"packId":e["pack_id"],"pixelSize":[e["width"],e["height"]],"sha256":e["sha256"]}
    sprites[name]={"source":ident,"rect":dict(zip(("x","y","w","h"),rect)) if rect else None,"status":"verified" if rect else "manual-review","evidence":evidence,"logicalFootprint":None}
    if art_span: sprites[name]["artTileSpan"]={"tileWidth":16,"tileHeight":16,"columns":art_span[0],"rows":art_span[1]}

sprite("terrain.grass.center","A033",[16,16,16,16],"grid-A033.png: center of upper-left 3x3 grass patch, source coordinates 16..31 on both axes.")
sprite("crop.grain.stage-yellow","A009",[48,0,16,16],"grid-A009.png: fourth cell of upper row; grain-like yellow crop. Botanical species intentionally not asserted.")
sprite("crop.purple-root.stage-large","A009",[64,16,16,16],"grid-A009.png: fifth cell of lower row, purple-root crop stage; species unspecified.")
sprite("animal.chicken.pose-0","A004",[0,0,16,16],"grid-A004.png: top-left cell, alpha extent [1,3,12,15] (right/bottom exclusive).")
sprite("animal.chicken.pose-1","A004",[16,0,16,16],"grid-A004.png: next top-row cell. Motion semantics/timing are not documented.")
sprite("animal.cow.pose-0","A005",[0,0,32,32],"grid-A005.png: top-left cow cell, alpha extent [3,12,30,30].")
sprite("building.chicken-coop","A018",[0,0,48,48],"Complete standalone PNG, visually inspected; no inferred collision/occupancy.",(3,3))
sprite("item.egg","A016",[0,0,16,16],"Complete standalone egg PNG; A017 is an exact byte duplicate.")
sprite("ui.rack.slot.rounded.light","A044",[0,0,48,48],"grid-A044.png: top-left slot cell. Internal visible bounds [9,9,30,32] in x,y,w,h form.")
sprite("ui.rack.slot.square.light","A044",[0,48,48,48],"grid-A044.png: first cell of middle row. Rendering scale/role is a future UI decision.")
sprite("ui.button.blank.light","A089",[0,0,96,32],"grid-A089.png: top-left blank button cell; visible bounds [3,2,90,27].")
sprite("ui.button.blank.partner","A089",[96,0,96,32],"grid-A089.png: darker blank button; visible bounds [99,4,90,25]. Pressed/disabled meaning unverified.")
for ident,prefix,w,h,count in [("A180","winter.tree",48,64,8),("A181","winter.fire",16,16,16),("A185","winter.gift.red",16,16,10)]:
    for f in range(count):
        sprite(f"{prefix}.{f:02}",ident,[f*w,0,w,h],"Decoded Aseprite frame matches PNG crop pixel-for-pixel after transparent RGB normalization; see detail-measurements.json.",(w//16,h//16))
sprite("review.crop.unidentified","A152",None,"Species, complete source rectangle and crop growth grouping deliberately unresolved; runtime must reject.")
animations={}
for prefix,count in [("winter.tree",8),("winter.fire",16),("winter.gift.red",10)]:
    animations[prefix]={"status":"verified","timingStatus":"verified","loop":None,"frames":[{"sprite":f"{prefix}.{f:02}","durationMs":100} for f in range(count)],"evidence":"Per-frame Aseprite durations and source-pixel export correspondence both verified. Loop is unknown because there are no tags.","reducedMotionFrame":f"{prefix}.00"}
animations["review.chicken.two-pose"]={"status":"manual-review","timingStatus":"unverified","loop":None,"frames":[{"sprite":"animal.chicken.pose-0","durationMs":None},{"sprite":"animal.chicken.pose-1","durationMs":None}],"evidence":"Coordinates verified; grouping/order is only a candidate, and timing/loop unknown.","reducedMotionFrame":"animal.chicken.pose-0"}
manifest={"$schema":"./sprite-manifest.schema.json","schemaVersion":"1.0","purpose":"audit-proposal-not-runtime-approved","coordinateSystem":"source-pixels-top-left","sourcePathBase":"wordstead-entry-url","packs":packs,"sources":sources,"sprites":sprites,"animations":animations}
(OUT/"sprite-manifest.sample.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")

# Standalone local gallery: generated previews only, no artwork copied into repository.
cards=[]
for p in audit["previews"]:
    labels="; ".join(e["id"]+" "+Path(e["path"]).name for e in files if e.get("preview")==p["file"])
    cards.append(f'<article data-search="{html.escape(labels.lower(),quote=True)}"><h2>{html.escape(p["category"])} / {p["file"]}</h2><a href="{p["file"]}"><img loading="lazy" src="{p["file"]}" alt="{html.escape(labels,quote=True)}"></a><p>{html.escape(labels)}</p></article>')
overlays=sorted(preview.glob("grid-*.png"))+sorted(preview.glob("aseprite-*.png"))
grid_links=" ".join(f'<a href="{p.name}">{p.name}</a>' for p in overlays)
gallery='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Wordstead private asset audit</title><style>body{background:#202833;color:#f9edd6;font:16px system-ui;margin:24px auto;max-width:1200px;padding:0 16px}a{color:#b5e4ce}img{width:100%;height:auto}article{margin:32px 0;border-top:1px solid #7c887d;padding-top:16px}p{line-height:1.5}input{padding:12px;font:inherit;width:min(90%,560px)}a:focus-visible,input:focus-visible{outline:3px solid #f8d787}nav a{display:inline-block;padding:10px}h2{font-size:20px}</style><h1>Wordstead — private asset audit</h1><p>October 22, 2026. Cup Nooble artwork; local inspection only. Do not publish this gallery or preview images. Sources remain unchanged. Contact sheets show PNGs and GIF frame zero. Grid overlays are evidence aids, with candidate grids labeled explicitly.</p><label for="filter">Filter by filename or audit ID</label><br><input id="filter" type="search" placeholder="A005, crop, buttons…"><h2>Coordinate and Aseprite previews</h2><nav>'''+grid_links+'</nav>'+"\n".join(cards)+'''<script>document.querySelector('#filter').addEventListener('input',e=>{let q=e.target.value.toLowerCase();document.querySelectorAll('article').forEach(a=>a.hidden=!a.dataset.search.includes(q));});</script></html>'''
(preview/"index.html").write_text(gallery,encoding="utf-8")
print(f"Catalog covers {len(notes)} files; manifest has {len(sources)} sources, {len(sprites)} sprites, {len(animations)} animations.")
