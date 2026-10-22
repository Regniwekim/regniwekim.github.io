# WORDSTEAD
*Game Design Skeleton — v0.2 | October 22, 2026*

**Genre:** Single-player spatial word puzzle / cozy farm builder  
**Platform:** Responsive web application (desktop, tablet, mobile)  
**Format:** Short, replayable puzzles with seeded randomness  
**Inspiration:** Scrabble × Go × cozy farming

## 1. High Concept

**Build a farm, one word at a time.**

Place letter tiles to create words that double as fences. Enclose land to claim territory, earn points, and collect farm resources. Reach the farm's target value using as few words as possible.

**Core tension:** Use available letters now, or save them for a more valuable future placement.

## 2. Core Gameplay Loop

1. **Draw** — Maintain a rack of up to seven letters from a shuffled bag.
2. **Build** — Place a valid word following Scrabble placement rules.
3. **Enclose** — Connected letters form fences around empty land.
4. **Harvest** — Score newly enclosed squares and activate captured bonuses.
5. **Replenish** — Draw replacement letters and continue.
6. **Finish** — Reach the score target and receive an efficiency grade.

## 3. Board & Placement

- Configurable rectangular grid of any dimensions.
- Initial test board: 15×15.
- First word crosses a designated starting square.
- Subsequent words connect to the existing network.
- All newly formed words, including perpendicular words, must be valid.
- Placed letters are permanent and may be reused in future words.
- Orthogonally connected letters form continuous fences.
- Board edges do not count as enclosure boundaries.

## 4. Territory & Scoring

- Each newly enclosed empty square earns 1 point.
- Squares occupied by letters never earn territory points.
- Previously scored territory cannot score again.
- Captured farm features provide additional points or utility.
- Letter values do not directly contribute to scoring.
- Victory occurs when the farm's target score is reached.

**Performance grading**
- Primary efficiency metric: number of words placed.
- One standardized grading rubric applies across puzzles.
- Grading thresholds may scale with target score, but not with individual puzzle seeds.
- Random puzzles are not guaranteed equal difficulty.
- Tile exchange penalties and exact grades remain to be balanced.

## 5. Letter Economy

- Standard 100-tile English Scrabble distribution for initial testing.
- Seven-tile rack, replenished after word placement.
- Tile exchanges permitted, with an efficiency cost.
- Letter distribution and exchange rules subject to playtesting.
- Failure occurs when no legal moves or exchanges remain and the target has not been reached.

## 6. Farm Features

Randomly distributed features activate when enclosed.

| Feature | Function |
|---|---|
| Crops | Additional points |
| Livestock | Extra letters or draw bonuses |
| Buildings | Rack management and utility abilities |
| Fertile land | Increased territory value |

Feature types, rarity, and exact effects will be balanced through testing.

## 7. Puzzle Generation & Modes

**Generation**
- Seeded random letter bag and feature layout.
- Configurable board size, bonus density, and score target.
- No predetermined solution or solver requirement.
- Natural variation in difficulty is acceptable.

**Planned modes**
- **Campaign:** Curated progression introducing mechanics.
- **Daily Puzzle:** Shared seed and conditions for comparable attempts.
- **Free Play:** Customizable randomized puzzles.

## 8. Platform & Interface

**Responsive web game**
- Playable on phones, tablets, laptops, and desktops.
- Mobile-first layout adapting to available screen dimensions.
- Touch, mouse, and keyboard support.
- Readable board, rack, score, and placement feedback.
- Touch-friendly letter placement without relying exclusively on drag-and-drop.
- Clean, minimal interface with cozy farm-inspired visuals.
- Board zooming and panning where needed.
- No platform-specific installation required.

**Design priorities:** Clarity, responsiveness, accessibility, and restrained tactile feedback.

## 9. Prototype MVP

- Responsive web interface.
- Configurable rectangular grid.
- Scrabble word validation and placement.
- Standard tile bag and rack management.
- Enclosure detection and territory scoring.
- Basic randomized farm bonuses.
- Seeded puzzle generation.
- Score target, efficiency tracking, victory, and failure.
- Basic touch and desktop controls.

**Deferred:** Campaign progression, advanced farm features, daily distribution infrastructure, leaderboards, animations, sound, and final balance.

---

**Design Pillar:** *Every word is a fence. Every enclosure is an investment. Every tile is a decision.*