# Changelog

## 2.0.1

- Preserve loaded subscription panels, episode filters, and expanded episode state when the library is filtered or re-rendered.
- Simplify interface grouping with native `div` and `article` elements and remove fixed input widths that could overflow narrow screens.
- Avoid redundant local-storage writes, reduce saved episode-description size, and save playback progress less frequently while retaining page-close persistence.
- Bound the in-memory feed cache and discard results from feeds unsubscribed during a refresh.
- Improve RSS and Atom validation, namespace-aware RSS channel parsing, Atom alternate episode links, media-content audio detection, and episode description extraction.
- Keep status-message timers independent so activity in one section does not interfere with another.

## 2.0.0

- Added explicit unplayed, in-progress, and played episode tracking.
- Mark episodes played automatically after 90% playback or manually from episode controls.
- Added an In Progress list with resume actions and saved playback positions.
- Added OPML subscription import and export.
- Added JSON backup export and merge/replace restore.
- Added subscription filtering and Latest Episodes filtering and sorting.
- Added bulk marking of listed latest episodes as played.
- Added removal of played episodes from the queue.
- Added up to three concurrent feed refresh workers, retries for transient failures, partial rendering as feeds finish, and retained cached results after failed refreshes.
- Added feed diagnostics and persistent expanded/collapsed state for main sections.
- Added keyboard playback shortcuts.
- Added stable episode identifiers based on feed URL and RSS GUID, with audio URL fallback.
- Added a storage schema version and backup schema version.
- Corrected release-date parsing used to sort Latest Episodes.

## Earlier versions

Earlier development focused on catalogue search, RSS feed import, subscription management, episode browsing, playback, queue management, favorites, listening history, and the Latest Episodes view.
