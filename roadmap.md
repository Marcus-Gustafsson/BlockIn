# BlockIn Roadmap

Status markers: `Planned`, `In Progress`, `Done`, `Blocked`.

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

## Next

## Later

- `Planned` - Add import/export or storage backup for user settings.
- `Planned` - Add optional schedules or focus windows for when blocking should be active.
- `Planned` - Add lightweight usage/debug status in the popup, such as last selected video and active rules.
- `Planned` - Add Brave-specific manual test notes if Brave behavior differs from Chrome.

## Parking Lot

- `Planned` - Explore automated browser/extension testing if the project grows enough to justify tooling.
- `Planned` - Consider richer motivation page design after core blocking and settings are reliable.
- `Planned` - Revisit Chrome Web Store packaging only if personal-use scope changes.
