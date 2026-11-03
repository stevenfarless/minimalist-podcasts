# Podcast Player

A lightweight, browser-based podcast player built entirely with vanilla HTML and JavaScript.

The goal is simple: make a functional podcast player that can be downloaded, opened locally, or hosted on GitHub Pages without requiring a backend, installation, build tools, API keys, frameworks, or external JavaScript libraries.

**This project is 100% vibe coded.** It started as a quick, low-effort experiment for fun, built with AI assistance and a willingness to see how far a single HTML file could go. It was never intended to be a serious commercial product or an especially ambitious software engineering exercise. It gradually became more capable than originally planned.

## Features

- Search for podcasts through Apple Podcasts and Podcast Index.
- Combine search results and identify duplicate shows.
- Browse podcast RSS feeds and individual episodes.
- Play episodes directly from their publishers.
- Subscribe to podcasts and maintain a personal library.
- View the latest unplayed episodes across subscriptions.
- Expandable podcast and episode sections.
- Playback queue management.
- Saved and favorite episodes.
- Listening history.
- Remember playback position.
- Playback speed controls.
- Manual RSS feed importing.
- Local browser storage for subscriptions and preferences.

## Design Philosophy

The application deliberately uses plain HTML and vanilla JavaScript.

There is no CSS. The intentionally unstyled appearance is part of the project rather than an unfinished design decision.

The application uses native HTML elements for sections, controls, spacing, and interaction wherever practical.

The entire application is distributed as one HTML file.

## Requirements

- A modern web browser.
- An internet connection for podcast discovery, RSS feeds, and audio streaming.

No installation or compilation is required.

## Running Locally

1. Download `podcast_player.html`.
2. Open the file in a modern web browser.
3. Search for a podcast or import an RSS feed.
4. Select a show, browse its episodes, and start listening.

The application can also be hosted through GitHub Pages using the same HTML file.

Some external services may behave differently when the application is opened through `file://` rather than HTTP or HTTPS.

## External Services

The application relies on external services for podcast discovery and feed retrieval.

- **Apple Podcasts:** Podcast catalogue search.
- **Podcast Index:** Additional podcast discovery through the PinePods hosted search service.
- **Podcast publishers:** RSS feeds, episode metadata, and audio streams.

These services are independently operated and may experience outages, rate limits, or changes to their interfaces.

No personal API keys are embedded in the application.

## Privacy and Storage

Subscriptions, playback information, favorites, and other application data are stored locally in the browser.

Search queries are transmitted to the external podcast discovery services.

Audio is streamed from the podcast publisher's hosting service.

The application does not currently require user accounts or a centralized application database.

Clearing browser data may erase locally stored application information.

## Limitations

This is an experimental project. It has not undergone extensive compatibility, security, accessibility, or performance testing.

Potential limitations include:

- Some RSS feeds may be inaccessible because of browser CORS restrictions.
- External search services may become unavailable or change their APIs.
- Some podcast publishers may use unsupported feed formats or audio delivery methods.
- Playback and feed retrieval depend on the availability of external servers.
- Local browser storage is subject to browser-specific limitations.

## Development Status

This is an ongoing hobby project. Features may change, break, or be redesigned as development continues.

The current priority is maintaining a simple, portable, single-file application while gradually improving its functionality and reliability.

## License

GNU General Public License v3.0 or later (GPL-3.0-or-later).

See the `LICENSE` file for details.

## Acknowledgment

Built with HTML, JavaScript, curiosity, and an unreasonable amount of AI-assisted vibe coding.

Use it, modify it, break it, improve it, and have fun.
