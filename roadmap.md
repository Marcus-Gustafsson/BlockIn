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
- `Done` - Added popup-managed leisure sites with shared 15 minute morning, midday, and evening focus-aware budgets.
