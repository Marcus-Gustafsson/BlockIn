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
- Confirm `facebook.com/messages/*` appears as an allowed path after first install or storage reset.
- Add `youtube.com` and confirm it appears in the list.
- Visit `https://www.youtube.com/` and confirm it redirects to the extension `video.html` page.
- Try adding duplicate `youtube.com` and confirm no duplicate site appears.
- Try adding invalid blocked-site values such as `https://youtube.com/watch`, `youtube.com/shorts`, and blank text.
- Remove `youtube.com`, canceling the first confirmation once, then typing a wrong domain once, then typing the exact domain.
- Confirm `youtube.com` is removed only after the exact two-step removal flow.
- Visit `https://www.youtube.com/` and confirm it no longer redirects.
- Remove a seeded site, reload Brave, and confirm the removal persists.
- Paste `https://www.facebook.com/messages/e2ee/t/7291377720941268/#` as an allowed path and confirm it stores as `facebook.com/messages/*`.
- Visit `https://www.facebook.com/messages/` and confirm it does not redirect while `https://www.facebook.com/` still redirects.

## Blocked Paths

- Add `youtube.com/shorts/*` as a blocked path and confirm it appears in the list.
- Visit `https://www.youtube.com/shorts/example` and confirm it redirects to the extension `video.html` page.
- Visit `https://www.youtube.com/` and confirm it does not redirect from the blocked path rule alone.
- Try adding duplicate `youtube.com/shorts/*` and confirm no duplicate path appears.
- Remove `youtube.com/shorts/*` and confirm it no longer redirects.

## Timed Access

- Add `youtube.com` as a timed access site and confirm it appears with a 15 minute duration.
- Confirm the popup rejects adding `youtube.com` as a blocked site while it is a timed access site.
- Visit `https://www.youtube.com/` and confirm the Work/Procrastination page appears.
- Click `Procrastination` and confirm the tab opens the extension `video.html` page.
- Visit `https://www.youtube.com/` again, click `Work`, and confirm the tab opens `https://www.youtube.com/`.
- While the Work timer is active, visit `https://www.youtube.com/shorts/example` with a blocked path configured and confirm it still redirects to `video.html`.
- While the Work timer is active, navigate to a Short from inside YouTube without manually refreshing and confirm it redirects to `video.html`.
- Add `https://www.reddit.com/` as a timed access site, visit a deep Reddit link, click `Work`, and confirm the tab returns to that full link instead of the Reddit homepage.
- After 15 minutes, visit `https://www.youtube.com/` and confirm the Work/Procrastination page appears again.
- Remove `youtube.com` from timed access and confirm the root domain no longer shows the Work/Procrastination page.

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
