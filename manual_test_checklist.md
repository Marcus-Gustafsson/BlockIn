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
- Confirm the popup shows `youtube.com` as inactive before starting Work.
- Add `youtube.com/shorts/*` as a timed access site and confirm it appears as its own inactive row.
- Confirm the popup rejects adding `youtube.com` as a blocked site while it is a timed access site.
- Visit `https://www.youtube.com/` and confirm YouTube loads behind a dark, strongly blurred, blocking Work/Procrastination modal.
- Click `Procrastination` and confirm the tab opens the extension `video.html` page.
- Visit `https://www.youtube.com/` again, click `Work`, and confirm a second Work confirmation modal appears before the timer starts.
- Click `No, procrastination` in the second modal and confirm the tab opens the extension `video.html` page.
- Visit `https://www.youtube.com/` again, click `Work`, then click `Yes, work`, and confirm the modal closes without navigating away.
- Open the popup and confirm the timed access row shows a countdown near 15:00.
- While the `youtube.com` Work timer is active, visit `https://www.youtube.com/shorts/example` and confirm the Shorts timed access modal appears with its own timer.
- While the `youtube.com/shorts/*` Work timer is active, navigate between Shorts without manually refreshing and confirm it does not reuse the main `youtube.com` timer.
- Add `https://www.reddit.com/` as a timed access site, visit a deep Reddit link, click `Work`, and confirm the modal closes on that full link instead of sending the tab to the Reddit homepage.
- After 15 minutes, keep the current tab open and confirm the dimmed Work/Procrastination modal appears without redirecting to `video.html`.
- Click `Work` after expiry and confirm the popup countdown resets near 15:00.
- Remove `youtube.com` from timed access and confirm the root domain no longer shows the Work/Procrastination modal.

## Leisure Access

- Add `netflix.com` and `youtube.com/watch/*` as leisure targets and confirm both appear in the popup.
- Confirm popup shows Morning, Midday, or Evening with a shared countdown near 15:00, or unavailable between 00:00 and 06:00.
- Confirm adding a leisure target whose domain is fully blocked is rejected.
- Confirm adding a leisure target identical to a timed access target is rejected in either direction.
- Open a leisure target and confirm a blocking modal asks `Use leisure time now?` and shows current remaining time.
- Choose `No, motivate me` and confirm the tab redirects to `video.html`.
- Confirm leisure access, keep tab visible and focused, and verify popup shared countdown decreases.
- Switch to another tab or minimize Brave and confirm countdown pauses.
- Return to leisure tab and confirm modal appears again before countdown resumes.
- Move between URLs inside same leisure path using SPA navigation and confirm active access continues without another prompt.
- Navigate away from leisure, return, and confirm another prompt appears.
- Start leisure on one target, then confirm another leisure target and verify both use same remaining budget.
- Confirming a second focused leisure tab transfers active countdown; first tab stops consuming time and prompts again when focused.
- Exhaust allowance and confirm active leisure tab immediately redirects to `video.html` and later leisure visits redirect without confirmation.
- Cross a period boundary while active and confirm immediate redirect plus fresh 15:00 allowance in next period.
- Reload extension or restart Brave and confirm remaining current-period allowance persists without continuing to drain while inactive.
- Remove leisure targets and confirm they stop showing leisure prompts.

## Videos

- Confirm a random local video loads from `videos/`.
- Refresh `video.html` several times and confirm different videos can be selected.
- Confirm `chrome.storage.local.selectedVideo` stores the selected relative video path.
- Add a supported video to `check-in-videos/`, reload the extension, open a timed access site, click `Work`, and confirm a random check-in video appears in the second modal.
- Temporarily test with no supported video files in `check-in-videos/` and confirm the second modal still appears without an empty video box.

## Fallback

- Temporarily test with no supported video files in `videos/`.
- Reload the extension and visit a blocked site.
- Confirm the video page shows a visible fallback message instead of a blank page.

## Console

- Check the service-worker console for rule sync errors.
- Check the popup console for site management errors.
- Check the video page console for video discovery or playback errors.
