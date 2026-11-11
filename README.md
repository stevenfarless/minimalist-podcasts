# Podcast Player

A lightweight podcast player that runs directly in a web browser. The application is a single HTML file containing its markup and vanilla JavaScript. It uses no CSS, frameworks, build tools, backend, account system, or embedded API keys.

The project began as a small, 100% AI-assisted vibe-coding experiment. It grew into a practical personal podcast player. It remains an experimental hobby project.

## Features

- Search Apple Podcasts and Podcast Index through the PinePods hosted search service.
- Merge catalogue results and remove duplicate shows.
- Add podcasts manually using a public RSS or Atom feed address.
- Browse and stream episodes from subscribed feeds.
- Manage subscriptions, saved episodes, listening history, and a playback queue.
- See the latest unplayed episodes across subscriptions.
- Track episodes as unplayed, in progress, or played. Episodes are automatically marked played after 90% completion, and can also be marked manually.
- Resume episodes from saved playback positions.
- Filter subscriptions and latest episodes; sort latest episodes by date, podcast, or title.
- Import and export subscriptions using OPML.
- Export and restore complete JSON backups, either merging with current data or replacing it.
- Refresh feeds with up to three concurrent requests, retry temporary failures, retain previously loaded data when a refresh fails, and inspect feed diagnostics.
- Preserve loaded episodes, episode filters, and expanded episode state while filtering the subscription library.
- Bound the in-memory feed cache and avoid redundant local-storage writes; playback progress is saved periodically and when the page is closed.
- Remember which main sections were expanded.
- Use keyboard shortcuts during playback.

## Run locally

1. Download `index.html`.
2. Open it in a current desktop or mobile browser.
3. Search for a podcast or add a public RSS feed.
4. Subscribe to a show, open its episode list, and play an episode.

The app can also be hosted from the root of a GitHub Pages repository. Naming the main file `index.html` allows GitHub Pages to serve it as the site's entry page.

An internet connection is required for catalogue search, feed retrieval, and audio streaming. Browser support for local file access and media playback varies.

## Data and privacy

Subscriptions, queue contents, favorites, listening history, playback positions, and preferences are stored in the browser's local storage for the current site origin. Clearing browser site data can erase this information. Use the JSON backup feature before moving browsers or clearing site data.

Podcast searches are sent to Apple Podcasts and the PinePods hosted search service. RSS requests may use the public `proxy.cors.dev` CORS proxy when a publisher's feed does not permit direct browser access. Audio is streamed from the podcast publisher or its hosting provider. These external services can receive request metadata such as IP address and requested URLs. The project does not operate its own server or user database.

No API keys are embedded in the HTML file. The PinePods search endpoint and public CORS proxy are third-party dependencies; their availability, policies, and behavior may change.

## Import and backup

- Use **Export Subscriptions as OPML** to move subscriptions to another podcast application.
- Use **Import OPML file** to add subscriptions from a compatible OPML export. Existing subscriptions are retained and duplicate feed URLs are skipped.
- Use **Download JSON Backup** to save subscriptions, queue, favorites, history, played status, in-progress positions, and playback settings.
- Import a JSON backup in merge mode to retain current items and add missing ones. Select the replace option only when you intend to replace the current app data.

OPML contains subscription addresses and titles. JSON backups contain the app's locally stored podcast and listening data, so keep backup files private if that information is sensitive to you.

## Keyboard shortcuts

- `Space`: play or pause the current episode, when focus is outside an input or select control.
- `Alt` + `Left Arrow`: skip back 15 seconds.
- `Alt` + `Right Arrow`: skip forward 30 seconds.
- `Alt` + `N`: play the next item in the queue.

## Design

The deliberately plain interface uses native HTML elements such as `details`, `summary`, `form`, `button`, `input`, `progress`, `audio`, `article`, and `div`. Input widths use browser defaults so they can fit narrow screens without a stylesheet. There is no CSS, framework, dependency, or build process. The JavaScript remains embedded in the HTML file so the app can be downloaded and run as a single file. Layout uses ordinary document flow rather than tables or a styling framework.

The project favors browser-provided controls and straightforward JavaScript. Application logic is required for catalogue searches, feed retrieval, playback management, and local persistence; the browser handles the native interface wherever practical.

## Browser compatibility

The intended targets are current versions of Chrome, Firefox, Safari, Edge, and their mobile counterparts, plus reasonably recent releases. The project does not promise compatibility with Internet Explorer or obsolete browser engines. Older browsers may display the page while lacking support for particular features such as media playback, file handling, or modern network security.

The app uses modern JavaScript and browser APIs. It is not designed around an ES5-only compatibility baseline. Kindle and other e-ink browsers are experimental targets, with functionality dependent on the device's browser, network support, and audio capabilities. No exhaustive cross-browser test suite has been completed.

## Limitations

This is an experimental project and has not been exhaustively tested across every browser, feed format, or podcast host. Some feeds block browser requests, some media hosts restrict playback, and external catalogue or proxy services can become unavailable. Browser local-storage limits vary. The app cannot guarantee that every RSS or Atom extension will be interpreted correctly.

Feed diagnostics can help identify failed requests. A failed refresh retains the last successfully loaded feed data when available.

## Development

- Application version: `2.0.1`
- Storage schema: `2`
- Main application: `index.html`
- Language: HTML and vanilla JavaScript
- Styling: none
- Build process: none

See [CHANGELOG.md](CHANGELOG.md) for project changes.

## License

This project is licensed under the GNU General Public License, version 3, or (at your option) any later version. See [LICENSE](LICENSE) for the full license text.

## Acknowledgment

Built with HTML, JavaScript, curiosity, and an unreasonable amount of AI-assisted vibe coding.
