# BlockIn

BlockIn is a personal Brave/Chromium extension for blocking distraction sites. When a blocked site is opened, the extension redirects the tab to `video.html` and plays a random motivation video from the local `videos/` folder.

The project is built for personal use in Brave. Chrome Web Store packaging and public release work are out of scope unless that direction changes.

## Install in Brave for Testing

Use these steps when you want to load or reload BlockIn as a local unpacked extension in Brave.

1. Open Brave.
2. Click the address bar.
3. Type `brave://extensions` and press Enter.
4. Turn on `Developer mode` in the top-right corner.
5. Click `Load unpacked`.
6. In the folder picker, choose this project folder:

```text
/mnt/c/Users/Marcu/workspace/github.com/BlockIn
```

7. Click `Select Folder` or `Open`, depending on your file picker.
8. Confirm BlockIn appears on the extensions page.
9. Visit `https://www.facebook.com/`, `https://www.instagram.com/`, or `https://www.twitch.tv/`.
10. Confirm Brave redirects the tab to the extension `video.html` page.
11. Confirm a random video loads and plays from `videos/`.

After code or video changes, go back to `brave://extensions` and click the reload button on the BlockIn extension card. Then test a blocked site again.

No install command, package manager, build step, or dependency setup is required.

## Blocked Sites

Blocked sites are managed from the extension popup and stored in `chrome.storage.local`. On first install or update, BlockIn seeds these sites:

- `facebook.com`
- `instagram.com`
- `twitch.tv`

After that seed, all sites are treated the same. You can add or remove sites from the popup without editing source code. The extension uses dynamic Manifest V3 `declarativeNetRequest` rules generated from stored domains. The rules redirect main-frame navigation to `/video.html`.

To add a site:

1. Click the bLockIn extension icon.
2. Enter a domain only, such as `youtube.com`.
3. Click `Add`.

URLs and paths such as `https://youtube.com/watch` or `youtube.com/shorts` are intentionally rejected for now. Path-specific blocking is planned separately.

To remove a site:

1. Click `Remove` next to the domain.
2. Confirm that you want to remove it.
3. Type the exact domain in the second popup.

## Allowed Paths

Allowed paths are exceptions inside blocked domains. BlockIn seeds this allowed path so Facebook Messenger can still be used while Facebook stays blocked:

- `facebook.com/messages/*`

To add another allowed path:

1. Click the bLockIn extension icon.
2. Enter a domain path, such as `facebook.com/messages/*`.
3. Click `Allow`.

You can also paste a full Facebook Messenger chat URL. BlockIn stores it as `facebook.com/messages/*` so changing chat identifiers do not break the exception.

## Local Videos

Put personal video files in the `videos/` folder. The folder is ignored by git, so local videos stay out of commits.

Supported formats:

- `.mp4`
- `.webm`
- `.mov`
- `.m4v`

New supported videos do not need to be named in source code. Drop them into `videos/`, reload the extension, and the random video selector can discover them.

## Manual Test

See `manual_test_checklist.md` for the fuller checklist.

1. Open `brave://extensions`.
2. Reload BlockIn.
3. Visit `https://www.facebook.com/`, `https://www.instagram.com/`, or `https://www.twitch.tv/`.
4. Confirm the tab redirects to the extension `video.html` page.
5. Add and remove a test domain from the popup, such as `youtube.com`.
6. Confirm `https://www.facebook.com/messages/` does not redirect.
7. Confirm a random video loads and plays from `videos/`.
8. Check the extension service worker console and redirected page console for errors.

## Development Notes

- Keep line endings as LF.
- Keep changes scoped; this is a small no-build extension.
- Validate JSON after editing `manifest.json`:

```bash
python3 -m json.tool manifest.json >/tmp/blockin_manifest.json
```
