# Web Games

A small, build-free arcade for GitHub Pages at `games.regniwekim.com`.
All pages, styles, illustrations, and fonts are hosted in this repository;
no packages, third-party requests, or build step are required.

```text
/
├── CNAME                 # Custom domain
├── robots.txt            # Requests that crawlers skip the entire site
├── index.html            # Arcade homepage
├── assets/
│   ├── arcade.css        # Shared arcade theme and responsive layouts
│   ├── arcade-carpet.svg # Repeating Memphis-style neon carpet
│   ├── joystick.svg      # Homepage illustration
│   ├── favicon.svg       # Arcade joystick icon
│   └── fonts/            # Local fonts and their SIL Open Font Licenses
├── demo-game/
│   └── index.html        # Playable Target Tap canvas demo
└── wordstead/            # Daily word puzzle and farm enclosure game
    └── index.html        # Native ES modules; preview over HTTP
```

## Add a game

1. Create a folder with a URL-friendly name, such as `my-game/`.
2. Put the game's entry page at `my-game/index.html`. Keep any supporting assets
   inside that folder and use relative paths (for example, `./assets/sprite.png`).
3. Duplicate the first playable `<li>` in `.games-grid` in the root `index.html`.
   Update the link, `aria-labelledby` / game title and play label IDs, artwork,
   description, category, and its visible number. The artwork is styled in
   `assets/arcade.css`, so each game can have its own CSS poster treatment.
   Update the game count and remove the noninteractive coming-soon
   placeholder once you have enough games.
4. Add a link back to the arcade in the game:
   `<a href="../index.html">Back to Main Arcade</a>`.
5. Commit and push the files to the branch used by GitHub Pages.

Use this repository's root as the Pages publishing folder. The `CNAME` file
declares the custom domain; GitHub Pages and the domain's DNS must also be
configured for that domain.

## Preview locally

The arcade and Target Tap can open directly. Wordstead uses native ES modules
and needs HTTP. With Python installed,
run this command from the repository root:

```sh
python -m http.server 8000
```

Visit `http://localhost:8000/`, then follow **Play now** to check subfolder
routing. Target Tap supports clicking, touch, and keyboard controls. Each round
lasts 30 seconds; use **Play again** to restart after it finishes.
Wordstead offers Daily Puzzle and custom Free Play, with browser-local progress
and history. See [its README](wordstead/README.md) and
[release assessment](wordstead/docs/release-readiness.md) for controls and limits.

## Arcade theme

The shared theme uses a charcoal backdrop with cyan, hot pink, acid yellow,
violet, and orange geometric shapes inspired by 1990s arcade carpets. Edit the
color variables in `assets/arcade.css` and the matching shapes in
`assets/arcade-carpet.svg` to customize it. Bungee provides the cabinet lettering,
Press Start 2P the pixel labels, and Space Grotesk the readable body text.

New game pages can use `../assets/arcade.css` and the demo's `.game-shell` and
`.game-cabinet` layout to keep the same visual style. The theme supports narrow
screens, visible keyboard focus, and reduced-motion preferences.

## Search visibility

`robots.txt` asks all compliant crawlers to skip every path. All game entry pages
also have a `noindex, nofollow` meta tag; copy it into new game pages. These
directives do not make the games private or guarantee removal from search
results: anyone with a URL can still visit them.

