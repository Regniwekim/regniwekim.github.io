# Agent instructions

## Verified repository setup

- The root `index.html` is the arcade homepage. Its `.games-grid` links to games
  in their own directories; `demo-game/index.html` is the Target Tap canvas game.
- The current site uses plain HTML, CSS, and browser JavaScript, with no package
  manifests, external runtime libraries, build step, or automated test suite.
  There is no checked-in GitHub Actions deployment workflow.
- `assets/arcade.css` is shared by the homepage and demo. `assets/` also contains
  SVG artwork and a favicon; `assets/fonts/` holds local Bungee, Press Start 2P,
  and Space Grotesk fonts and their license files. Keep those licenses with the fonts.
- GitHub Pages is configured to publish from `main`, folder `/`. `CNAME` and the
  Pages settings specify `games.regniwekim.com`. The homepage is at `/`, and the
  demo is at `/demo-game/`, without a repository-name URL prefix.
- `README.md` documents adding games and local preview. `robots.txt` disallows
  crawling, and both existing HTML pages use `noindex, nofollow` metadata.

## Scope and workflow

- Treat this as a monorepo of independent games. Each game directory is a
  distinct application with its own architecture, stack, and visual identity.
  The root owns the shared arcade experience, navigation, assets, and deployment.
- Before editing, read `README.md`, relevant documentation, and any applicable
  nested `AGENTS.md` files. Game-specific instructions may extend this file within
  their directory; do not impose one game's conventions on another.
- Make small, focused changes to the requested game or component. Do not modify
  unrelated games or files or perform opportunistic refactoring. Preserve
  existing functionality and public URLs.
- Before changing shared resources, identify their consumers and account for the
  effect on each. In particular, shared CSS includes global element selectors.
- Explain significant architectural decisions. On completion, summarize the
  changes, validation actually performed, and outstanding issues or limitations.

## Development standards

- Follow each game's existing technology and coding conventions. Prefer simple,
  maintainable solutions; introduce dependencies only when they provide a clear
  benefit. Keep browser performance, asset sizes, and loading times in mind.
- Favor responsive, mobile-first interfaces. Support touch, mouse, and keyboard
  input where appropriate, with usable target sizes and visible focus states.
- Keep text readable, maintain sufficient contrast, label controls, and respect
  reduced-motion preferences. Preserve existing accessibility features.
- Keep game-specific code and assets within the game directory. Reuse shared
  functionality when useful without coupling games or requiring a common framework.
  The arcade theme may be reused but must not dictate individual games' aesthetics.

## GitHub Pages and URLs

- Treat GitHub Pages as production: deployed files must work on static hosting.
  Do not require a server-side application runtime without explicit approval.
- Respect the verified publishing source and deployment process. Do not change
  Pages settings, deployment workflows, publishing configuration, `CNAME`, or
  custom-domain/DNS settings without explicit authorization. Recheck settings
  before deployment work if they may have changed.
- Preserve directory names, public URLs, navigation, and asset paths. Follow the
  existing relative-path convention: homepage links use `./demo-game/`, game
  resources stay relative to their directory, and shared game assets use
  `../assets/`. CSS asset URLs resolve relative to the stylesheet.
- Games must load directly at their published directory URL and survive refresh
  without first visiting the homepage. Do not rely on server rewrites or a
  homepage-initialized session to make a game playable.
- Preserve the documented crawler restrictions and include the existing
  `noindex, nofollow` metadata in new game entry pages.

## Adding a game to the arcade

- Follow the README: create a URL-friendly directory with an `index.html` entry
  page and local supporting assets. Keep the game independently playable.
- Copy a playable `<li>` in the homepage's `.games-grid`. Update its destination,
  artwork, title, description, category, visible number, and unique heading/play
  label IDs, including `aria-labelledby` references. Update the displayed game count
  to match the available games.
- Provide a return link such as
  `<a href="../index.html">Back to Main Arcade</a>`. Keep homepage card styling
  compatible with the shared theme without requiring the game to adopt it.

## Validation

- Check for relevant tests and build commands in the affected game's documentation
  and configuration; run them when available. The current repository has no
  automated test/build command, so do not invent package-manager checks.
- For page or game changes, use the README's preview: open `index.html` directly,
  or run `python -m http.server 8000` from the root if Python is installed and
  visit `http://localhost:8000/`.
- At the affected scope, check homepage-to-game navigation, the return link,
  direct game loading/refresh, asset references, and browser console errors.
  Exercise relevant input methods and narrow/wide layouts. Shared changes require
  checking the homepage and every consuming game; Target Tap checks should cover
  starting, scoring, the 30-second round ending, and replay.
- Run `git diff --check` before committing; for documentation-only changes,
  review factual claims and confirm the diff stays within the requested scope.
  Report checks that were run and any limitations; never claim unexecuted tests passed.
