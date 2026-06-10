# BlockIn Roadmap

Status markers: `Planned` or `Done`

## Done

- `Done` - Created baseline project guidance, roadmap, and project log documents.
- `Done` - Added README with Brave setup, video folder behavior, supported formats, and manual test steps.
- `Done` - Added LF line-ending policy and normalized tracked text files to LF.
- `Done` - Documented supported video formats and confirmed new videos can be added by dropping supported files into `videos/`.
- `Done` - Replaced duplicated static and dynamic blocked-site rules with `blocked-sites.js` as one source of truth.
- `Done` - Cleaned up unused generated files and tightened reliability around dynamic rule sync and video fallback errors.
- `Done` - Added a manual test checklist for extension reload, redirects, video playback, fallback UI, and console checks.
- `Done` - Added popup controls to add and remove blocked sites from local storage with a two-step removal guard.
- `Done` - Added allowed-path exceptions for blocked domains, including Facebook Messenger.
- `Done` - Added popup-managed blocked paths for sub-path blocking without blocking the full domain.
- `Done` - Added timed access flow for mixed-use sites with Work/Procrastination choice and expiring Work sessions.
- `Done` - Replaced timed access redirect pages with in-page Work check-in modals and popup countdowns.
- `Done` - Added path-specific timed access entries with separate timers and a darker check-in modal.
- `Done` - Added a second Work confirmation modal with optional random check-in videos.
- `Done` - Added mood-specific timed access exit buttons with local mood context logging.

## Next

- add leisure sites for time capped leisure/brake activities, similar to timed accessed sites, but instead for leisure/relaxtion, with a e.g. maximum of 3 times maybe 15 minutes per day in total across all visited leisure sites, e.g. when eating or just need a brake to watch a episode or something. It should also be timed accessed as with the time accessed site, but when the timer runs out, it should block the sites and just start playing a motivational video instead if im currently viewing a leisure site when the timer runs out. We can have e.g. one block in the morning, one in the midday and one in the evening, each one limits the activity of leisure sites for a total of 15 min. We should also have a popup that confirms, similar to the timed access popup, but that just do we really want to leisure right now and use the time, it should also display the remaining time for the current block/period we are in.
