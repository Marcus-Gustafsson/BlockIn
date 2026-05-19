# BlockIn Roadmap

Status markers: `Planned`, `In Progress`, `Done`, `Blocked`.

## Done

- `Done` - Created baseline project guidance, roadmap, and project log documents.
- `Done` - Added README with Brave setup, video folder behavior, supported formats, and manual test steps.
- `Done` - Added LF line-ending policy and normalized tracked text files to LF.
- `Done` - Documented supported video formats and confirmed new videos can be added by dropping supported files into `videos/`.
- `Done` - Replaced duplicated static and dynamic blocked-site rules with `blocked-sites.js` as one source of truth.

## Next

- `Planned` - Add popup controls to add and remove blocked sites without editing source code.
- `Planned` - Support path-specific blocking so a sub-path such as `youtube.com/shorts` or `youtube.com/reels` can be blocked without blocking all of YouTube.
- `Planned` - Add timed access flow for mixed-use sites: show Work/Procrastination choice, allow temporary access after Work, then ask again after the timer expires.
- `Planned` - Add fallback/error UI when no supported videos are found or video loading fails.
- `Planned` - Add a manual test checklist for reload, redirect, random video selection, and popup behavior.

## Later

- `Planned` - Add import/export or storage backup for user settings.
- `Planned` - Add optional schedules or focus windows for when blocking should be active.
- `Planned` - Add lightweight usage/debug status in the popup, such as last selected video and active rules.
- `Planned` - Add Brave-specific manual test notes if Brave behavior differs from Chrome.

## Parking Lot

- `Planned` - Explore automated browser/extension testing if the project grows enough to justify tooling.
- `Planned` - Consider richer motivation page design after core blocking and settings are reliable.
- `Planned` - Revisit Chrome Web Store packaging only if personal-use scope changes.
