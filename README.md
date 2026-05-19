# BlockIn

BlockIn is a personal Brave/Chromium extension for blocking distraction sites. When a blocked site is opened, the extension redirects the tab to `video.html` and plays a random motivation video from the local `videos/` folder.

The project is built for personal use in Brave. Chrome Web Store packaging and public release work are out of scope unless that direction changes.

## Setup

1. Open Brave and go to `brave://extensions`.
2. Enable Developer mode.
3. Choose `Load unpacked`.
4. Select this project folder.
5. Reload the extension after code or video changes.

No install command, package manager, build step, or dependency setup is required.

## Blocked Sites

Current blocked sites are defined in `blocked-sites.js`:

- Facebook
- Instagram
- Twitch

The extension uses dynamic Manifest V3 `declarativeNetRequest` rules generated from that one config file. The rules redirect main-frame navigation to `/video.html`.

## Local Videos

Put personal video files in the `videos/` folder. The folder is ignored by git, so local videos stay out of commits.

Supported formats:

- `.mp4`
- `.webm`
- `.mov`
- `.m4v`

New supported videos do not need to be named in source code. Drop them into `videos/`, reload the extension, and the random video selector can discover them.

## Manual Test

1. Open `brave://extensions`.
2. Reload BlockIn.
3. Visit `https://www.facebook.com/`, `https://www.instagram.com/`, or `https://www.twitch.tv/`.
4. Confirm the tab redirects to the extension `video.html` page.
5. Confirm a random video loads and plays from `videos/`.
6. Check the extension service worker console and redirected page console for errors.

## Development Notes

- Keep line endings as LF.
- Keep changes scoped; this is a small no-build extension.
- Validate JSON after editing `manifest.json`:

```bash
python3 -m json.tool manifest.json >/tmp/blockin_manifest.json
```
