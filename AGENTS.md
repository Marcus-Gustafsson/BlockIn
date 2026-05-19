# AGENTS.md

## Project

BlockIn is a Manifest V3 Chrome extension that redirects selected distracting sites to an extension page that plays a random bundled motivation video.

Current blocked sites are Facebook, Instagram, and Twitch. Navigation is handled with Chrome `declarativeNetRequest` rules that redirect matching main-frame requests to `video.html`.

## Architecture

- `manifest.json` declares permissions, host access, the background service worker, popup, and static DNR rules.
- `rules.json` contains static redirect rules for blocked domains.
- `background.js` installs matching dynamic redirect rules.
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

## Validation

Run syntax validation for JSON files after changes that touch manifest or rules:

```bash
python3 -m json.tool manifest.json >/tmp/blockin_manifest.json
python3 -m json.tool rules.json >/tmp/blockin_rules.json
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
