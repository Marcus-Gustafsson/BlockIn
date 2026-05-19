# BlockIn Manual Test Checklist

Use this after changes that affect blocking, videos, popup behavior, or permissions.

## Reload

- Open `brave://extensions`.
- Enable Developer mode.
- Load or reload this unpacked extension folder.
- Open the service-worker console and confirm no startup errors.

## Redirects

- Visit `https://www.facebook.com/`.
- Visit `https://www.instagram.com/`.
- Visit `https://www.twitch.tv/`.
- Confirm each navigation redirects to the extension `video.html` page.

## Popup Site Management

- Open the extension popup.
- Confirm `facebook.com`, `instagram.com`, and `twitch.tv` appear after first install or storage reset.
- Add `youtube.com` and confirm it appears in the list.
- Visit `https://www.youtube.com/` and confirm it redirects to the extension `video.html` page.
- Try adding duplicate `youtube.com` and confirm no duplicate site appears.
- Try adding invalid values such as `https://youtube.com/watch`, `youtube.com/shorts`, and blank text.
- Remove `youtube.com`, canceling the first confirmation once, then typing a wrong domain once, then typing the exact domain.
- Confirm `youtube.com` is removed only after the exact two-step removal flow.
- Visit `https://www.youtube.com/` and confirm it no longer redirects.
- Remove a seeded site, reload Brave, and confirm the removal persists.

## Videos

- Confirm a random local video loads from `videos/`.
- Refresh `video.html` several times and confirm different videos can be selected.
- Confirm `chrome.storage.local.selectedVideo` stores the selected relative video path.

## Fallback

- Temporarily test with no supported video files in `videos/`.
- Reload the extension and visit a blocked site.
- Confirm the video page shows a visible fallback message instead of a blank page.

## Console

- Check the service-worker console for rule sync errors.
- Check the popup console for site management errors.
- Check the video page console for video discovery or playback errors.
