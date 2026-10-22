# Web Games

A small, build-free arcade for GitHub Pages at `games.regniwekim.com`.
All HTML, CSS, and JavaScript are local; no external assets, packages, or build step are required.
The landing page uses `arcade.css` for its mid-90s game-select design. The demo
keeps its own self-contained styling and game logic.

```text
/
├── CNAME                 # Custom domain
├── robots.txt            # Requests that crawlers skip the entire site
├── arcade.css            # 90s arcade homepage theme (CSS-only)
├── index.html            # Arcade homepage
└── demo-game/
    └── index.html        # Playable Target Tap canvas demo
```

## Add a game

1. Create a folder with a URL-friendly name, such as `my-game/`.
2. Put the game's entry page at `my-game/index.html`. Keep any supporting assets
   inside that folder and use relative paths (for example, `./assets/sprite.png`).
3. Duplicate the first playable `<li>` in `.game-grid` in the root `index.html`.
   Update the link, `aria-labelledby` / game title ID, poster text and art,
   description, category, and its visible number. The artwork is styled in
   `arcade.css`, so each game can have its own CSS poster treatment.
   Update the “games online” count and remove the noninteractive coming-soon
   placeholder once you have enough games.
4. Add a link back to the arcade in the game:
   `<a href="../index.html">Back to Main Arcade</a>`.
5. Commit and push the files to the branch used by GitHub Pages.

Use this repository's root as the Pages publishing folder. The `CNAME` file
declares the custom domain; GitHub Pages and the domain's DNS must also be
configured for that domain.

## Preview locally

Open the root `index.html` directly in a browser, or, with Python installed,
run this command from the repository root:

```sh
python -m http.server 8000
```

Visit `http://localhost:8000/`, then follow **Play demo** to check subfolder
routing. Target Tap supports clicking, touch, and keyboard controls. Each round
lasts 30 seconds; use **Play again** to restart after it finishes.

## Search visibility

`robots.txt` asks all compliant crawlers to skip every path. Both included pages
also have a `noindex, nofollow` meta tag; copy it into new game pages. These
directives do not make the games private or guarantee removal from search
results: anyone with a URL can still visit them.

