# AGENTS.md

## Project

BlockIn is a Manifest V3 Chrome extension that redirects selected distracting sites to an extension page that plays a random bundled motivation video.

Current blocked sites are Facebook, Instagram, and Twitch. Navigation is handled with Chrome `declarativeNetRequest` rules generated from `blocked-sites.js` and redirected to `video.html`.

This is a personal productivity extension for one user. Optimize for practical personal use, not Chrome Web Store submission, public onboarding, multi-user support, or generic product polish unless explicitly requested.

Primary browser target is Brave. Brave is Chromium-based, so normal Chrome extension APIs should work, but validate behavior in Brave when browser behavior matters.

## Architecture

- `manifest.json` declares permissions, broad host access for future user-added sites, the background service worker, and popup.
- `blocked-sites.js` is the current source of truth for blocked site config.
- `background.js` loads `blocked-sites.js` and installs matching dynamic redirect rules.
- `video.html` hosts the video player shown after a redirect.
- `videos.js` discovers supported files in the packaged `videos/` folder and picks one at random.
- `video.js` initializes the player and stores the selected video path in `chrome.storage.local` for debugging.
- `popup.html` is the current minimal extension popup.
- `videos/*` is ignored by git because local video assets can be large or personal.

There is no package manager setup, build step, or automated test runner at this point.

## Working Rules

- Keep changes small and scoped to the requested behavior.
- Preserve user work. The repo may already have dirty files, especially line-ending-only changes on Windows.
- Do not reformat unrelated JS, HTML, JSON, or Markdown.
- Avoid adding dependencies or tooling unless the task clearly needs them.
- Prefer plain JavaScript and Chrome extension APIs already used by the project.
- Keep extension behavior compatible with Manifest V3.
- Treat bundled video files as local/private assets unless explicitly told otherwise.
- Favor fast personal workflow over store-readiness. Do not add Web Store packaging, branding, analytics, privacy-policy work, or review-compliance changes unless asked.
- Design new features for Brave first, while keeping Chromium compatibility where it costs little.

## Validation

Run syntax validation for JSON files after changes that touch manifest or rules:

```bash
python3 -m json.tool manifest.json >/tmp/blockin_manifest.json
```

Manual extension check for behavior changes:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load or reload this unpacked extension folder.
4. Visit a blocked site such as `https://www.facebook.com/`.
5. Confirm Chrome redirects to `video.html`.
6. Confirm a random video loads and plays from `videos/`.
7. Check extension/service-worker console for errors.

## Project Tracking

- Update `roadmap.md` when a feature, fix, or cleanup changes project direction or status.
- Append one short dated sentence to `project_log.md` for meaningful changes.
- Keep `project_log.md` high signal; do not turn it into a full commit log.
- If line endings are cleaned up, do that as its own change so behavioral diffs stay readable.
