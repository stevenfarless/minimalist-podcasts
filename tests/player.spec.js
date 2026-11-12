const { test, expect } = require("@playwright/test");

const STORAGE_KEY = "plain-html-podcast-player-v1";
const RSS_URL = "https://feeds.example.test/podcast.xml";
const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Regression Test Podcast</title>
    <description>A test feed</description>
    <item><guid>episode-one</guid><title>Episode One</title><pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate><enclosure url="https://media.example.test/one.mp3" type="audio/mpeg" length="1000"/><description>First episode</description></item>
    <item><guid>episode-two</guid><title>Episode Two</title><pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate><enclosure url="https://media.example.test/two.mp3" type="audio/mpeg" length="1000"/><description>Second episode</description></item>
  </channel>
</rss>`;
const VIDEO_RSS_URL = "https://feeds.example.test/video.xml";
const VIDEO_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>Video Regression Podcast</title>
    <description>A video test feed</description>
    <item>
      <guid>video-one</guid><title>Video Episode</title>
      <enclosure url="https://media.example.test/video-audio.mp3" type="audio/mpeg" length="1000"/>
      <podcast:alternateEnclosure type="video/mp4" length="5000">
        <podcast:source uri="https://media.example.test/video-one.mp4"/>
      </podcast:alternateEnclosure>
    </item>
    <item>
      <guid>audio-two</guid><title>Audio Episode</title>
      <enclosure url="https://media.example.test/audio-two.mp3" type="audio/mpeg" length="1000"/>
    </item>
  </channel>
</rss>`;
const RDF_URL = "https://feeds.example.test/rdf.xml";
const RDF = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:enc="http://purl.org/rss/1.0/modules/content/">
  <channel rdf:about="https://feeds.example.test/rdf.xml"><title>RDF Podcast</title></channel>
  <item rdf:about="https://feeds.example.test/item"><title>RDF Episode</title><enc:content url="https://media.example.test/cover.jpg" type="image/jpeg"/><enc:content url="https://media.example.test/audio.ogg" type="audio/ogg"/></item>
</rdf:RDF>`;
const ATOM_URL = "https://feeds.example.test/atom.xml";
const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Regression Podcast</title>
  <entry><id>tag:example.test,2026:atom-one</id><title>Atom Episode</title><published>2026-11-10T12:00:00Z</published><link rel="enclosure" type="audio/mpeg" href="../media/atom.mp3"/><summary>Atom summary</summary></entry>
</feed>`;

const HISTORY_EPISODE = {
  id: "history-duplicate",
  title: "Duplicate History Episode",
  showTitle: "History Test",
  audioUrl: "https://media.example.test/history.mp3",
  date: "2026-11-10T12:00:00Z"
};
const UNIQUE_HISTORY_EPISODE = {
  id: "history-unique",
  title: "Unique History Episode",
  showTitle: "History Test",
  audioUrl: "https://media.example.test/unique.mp3",
  date: "2026-11-10T12:00:00Z"
};
const HISTORY_FIXTURE = {
  history: [
    { ...HISTORY_EPISODE, playedAt: "2026-11-10T01:00:00Z" },
    { ...HISTORY_EPISODE, playedAt: "2026-11-10T02:00:00Z" },
    { ...UNIQUE_HISTORY_EPISODE, playedAt: "2026-11-10T03:00:00Z" }
  ]
};

async function mockMedia(page) {
  await page.addInitScript(() => {
    // The fixtures use unresolvable *.example.test media hosts. Record the source
    // without letting the browser fetch it, otherwise the browser fires a genuine
    // media "error" event that the app correctly reports. Tests dispatch their own
    // synthetic media events when they need them.
    const sources = new WeakMap();
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      configurable: true,
      get() { return sources.get(this) || ""; },
      set(value) { sources.set(this, value ? new URL(value, document.baseURI).href : ""); }
    });
    HTMLMediaElement.prototype.play = function () {
      this.__mockPlaying = true;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      this.__mockPlaying = false;
    };
    HTMLMediaElement.prototype.load = function () {};
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      configurable: true,
      get() { return !this.__mockPlaying; }
    });
    const originalRemoveAttribute = Element.prototype.removeAttribute;
    Element.prototype.removeAttribute = function (name) {
      originalRemoveAttribute.call(this, name);
      if (this instanceof HTMLMediaElement && name === "src") sources.delete(this);
    };
  });
}

// Every main section is a native <details> element that starts collapsed, and
// Playwright will not interact with controls inside a closed one.
async function openSection(page, id) {
  const section = page.locator(`#${id}`);
  if (!(await section.evaluate(element => element.open))) {
    await page.locator(`#${id} > summary`).click();
  }
  await expect(section).toHaveJSProperty("open", true);
}

async function addFeed(page, url, body) {
  await page.route(url, route => route.fulfill({
    status: 200,
    contentType: "application/xml; charset=utf-8",
    headers: { "access-control-allow-origin": "*" },
    body
  }));
  await openSection(page, "rss-section");
  await page.locator("#rss-url").fill(url);
  await page.getByRole("button", { name: "Add Feed" }).click();
}

test.beforeEach(async ({ page }, testInfo) => {
  await mockMedia(page);
  if (testInfo.title === "keeps listening timestamps attached to their episodes when duplicate history IDs are removed") {
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(HISTORY_FIXTURE)]);
  }
  await page.goto("/");
});

test("normalizes malformed local storage without crashing or retaining invalid records", async ({ page }) => {
  // Seed storage before the app starts. Seeding the already-loaded page and then
  // calling reload() does not work: the old page's pagehide handler saves its own
  // in-memory state over the seed while it unloads.
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem("test-seeded")) {
      sessionStorage.setItem("test-seeded", "1");
      localStorage.setItem(key, value);
    }
  }, [STORAGE_KEY, JSON.stringify({
      library: [null, "bad", { title: "Valid Show", feedUrl: "https://valid.example.test/feed.xml" }, { title: "Duplicate", feedUrl: "https://valid.example.test/feed.xml" }],
      queue: [null, {}, { id: "no-audio", title: "No Audio" }, { id: "valid", title: "Playable", audioUrl: "https://media.example.test/valid.mp3" }],
      favorites: [null, { id: "favorite", title: "Saved" }],
      history: [null, { id: "played", title: "Played", playedAt: "2026-11-10T00:00:00Z" }],
      inProgress: [null, { episode: { id: "bad" }, currentTime: -5, duration: 100 }, { episode: { id: "good", audioUrl: "https://media.example.test/good.mp3" }, currentTime: 120, duration: 100 }],
      diagnostics: [null, { message: "Stored diagnostic" }],
      expandedSections: { "library-section": true, invalid: "yes" },
      currentEpisode: { title: "Broken current episode" },
      currentTime: -1,
      playbackRate: 99
  })]);
  await page.goto("/");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.library).toHaveLength(1);
  expect(saved.library[0].title).toBe("Valid Show");
  expect(saved.queue).toHaveLength(1);
  expect(saved.queue[0].id).toBe("valid");
  expect(saved.inProgress).toHaveLength(1);
  expect(saved.inProgress[0].currentTime).toBe(100);
  expect(saved.currentEpisode).toBeNull();
  expect(saved.currentTime).toBe(0);
  expect(saved.playbackRate).toBe(1);
  // The app records the open/closed state of every section, so check that the
  // invalid entry was dropped and the valid one kept rather than exact equality.
  expect(saved.expandedSections["library-section"]).toBe(true);
  expect(saved.expandedSections).not.toHaveProperty("invalid");
  expect(Object.values(saved.expandedSections).every(value => typeof value === "boolean")).toBe(true);
});

test("imports RSS, renders episodes, and supports queue, favorites, and played state", async ({ page }) => {
  await addFeed(page, RSS_URL, RSS);
  await expect(page.locator("#library-list")).toContainText("Regression Test Podcast");
  await expect(page.locator("#library-list")).toContainText("Episode One");
  const firstEpisode = page.locator("#library-list").getByText("Episode One", { exact: true });
  await firstEpisode.click();
  await page.getByRole("button", { name: "Add to Queue" }).first().click();
  await page.getByRole("button", { name: "Save Episode" }).first().click();
  await page.getByRole("button", { name: "Mark Played" }).first().click();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.queue).toHaveLength(1);
  expect(saved.favorites).toHaveLength(1);
  expect(saved.playedEpisodeIds).toContain(saved.queue[0].id);
});

test("parses RSS 1.0 RDF feeds and selects audio over non-audio enclosures", async ({ page }) => {
  await addFeed(page, RDF_URL, RDF);
  await expect(page.locator("#library-list")).toContainText("RDF Podcast");
  await expect(page.locator("#library-list")).toContainText("RDF Episode");
  const episode = page.locator("#library-list li[data-episode-id]").filter({ hasText: "RDF Episode" });
  await expect(episode).toHaveAttribute("data-audio-url", "https://media.example.test/audio.ogg");
});

test("parses video podcast enclosures and uses the browser's native video element", async ({ page }) => {
  await addFeed(page, VIDEO_RSS_URL, VIDEO_RSS);
  const videoEpisode = page.locator("#library-list li[data-episode-id]").filter({ hasText: "Video Episode" });
  await expect(videoEpisode).toHaveAttribute("data-media-type", "video");
  await expect(videoEpisode).toHaveAttribute("data-audio-url", "https://media.example.test/video-one.mp4");
  await videoEpisode.getByText("Video Episode", { exact: true }).click();
  const videoFileLink = videoEpisode.getByRole("link", { name: "Open Video File" });
  await expect(videoFileLink).toHaveAttribute("href", "https://media.example.test/video-one.mp4");
  await expect(videoFileLink).toHaveAttribute("target", "_blank");
  await videoEpisode.getByRole("button", { name: "Play Episode" }).click();

  const video = page.locator("#video-player");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("controls", "");
  // A 1080p file must not render at its native size.
  expect((await video.boundingBox()).width).toBeLessThanOrEqual(480);
  await expect(page.locator("#audio-player")).toBeHidden();
  expect(await video.evaluate(element => element.src)).toBe("https://media.example.test/video-one.mp4");

  // If the browser or publisher cannot play the video enclosure, use the
  // ordinary audio enclosure from the same episode when one is available.
  await video.evaluate(element => element.dispatchEvent(new Event("error")));
  await expect(page.locator("#audio-player")).toBeVisible();
  await expect(video).toBeHidden();
  expect(await page.locator("#audio-player").evaluate(element => element.src)).toBe("https://media.example.test/video-audio.mp3");
  await expect(videoEpisode.locator("#player-interface")).toHaveCount(1);
  expect(await video.evaluate(element => element.src)).toBe("");

  const audioEpisode = page.locator("#library-list li[data-episode-id]").filter({ hasText: "Audio Episode" });
  await audioEpisode.getByText("Audio Episode", { exact: true }).click();
  await expect(audioEpisode.getByRole("link", { name: "Open Video File" })).toHaveCount(0);
  await audioEpisode.getByRole("button", { name: "Play Episode" }).click();
  await expect(page.locator("#audio-player")).toBeVisible();
  await expect(video).toBeHidden();
  expect(await page.locator("#audio-player").evaluate(element => element.src)).toBe("https://media.example.test/audio-two.mp3");
});

test("resets the active media element when replacing a backup clears a playing video episode", async ({ page }) => {
  await addFeed(page, VIDEO_RSS_URL, VIDEO_RSS);
  const videoEpisode = page.locator("#library-list li[data-episode-id]").filter({ hasText: "Video Episode" });
  await videoEpisode.getByText("Video Episode", { exact: true }).click();
  await videoEpisode.getByRole("button", { name: "Play Episode" }).click();
  await expect(page.locator("#video-player")).toBeVisible();

  await openSection(page, "data-section");
  await page.locator("#replace-backup").check();
  const emptyBackup = {
    schemaVersion: 2,
    library: [],
    queue: [],
    favorites: [],
    history: [],
    inProgress: []
  };
  await page.locator("#import-backup").setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(emptyBackup))
  });

  await expect(page.locator("#backup-status")).toContainText("replacing current data");
  await expect(page.locator("#audio-player")).toHaveJSProperty("hidden", false);
  await expect(page.locator("#video-player")).toHaveJSProperty("hidden", true);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.currentEpisode).toBeNull();
});

test("restoring a backup with a current episode stops the previously active media element", async ({ page }) => {
  await addFeed(page, VIDEO_RSS_URL, VIDEO_RSS);
  const videoEpisode = page.locator("#library-list li[data-episode-id]").filter({ hasText: "Video Episode" });
  await videoEpisode.getByText("Video Episode", { exact: true }).click();
  await videoEpisode.getByRole("button", { name: "Play Episode" }).click();
  const video = page.locator("#video-player");
  await expect(video).toBeVisible();
  expect(await video.evaluate(element => element.paused)).toBe(false);

  const backup = {
    schemaVersion: 2,
    library: [],
    queue: [],
    favorites: [],
    history: [],
    inProgress: [],
    currentEpisode: {
      id: "restored-audio",
      title: "Restored Audio Episode",
      showTitle: "Backup Podcast",
      audioUrl: "https://media.example.test/restored.mp3",
      mediaType: "audio"
    },
    currentTime: 12,
    playbackRate: 1
  };
  await openSection(page, "data-section");
  await page.locator("#replace-backup").check();
  await page.locator("#import-backup").setInputFiles({
    name: "playing-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup))
  });

  await expect(page.locator("#audio-player")).toHaveJSProperty("hidden", false);
  await expect(video).toHaveJSProperty("hidden", true);
  expect(await video.evaluate(element => element.paused)).toBe(true);
  expect(await video.evaluate(element => element.src)).toBe("");
  expect(await page.locator("#audio-player").evaluate(element => element.src)).toBe("https://media.example.test/restored.mp3");
  expect(await page.locator("#audio-player").evaluate(element => element.paused)).toBe(true);
});

test("rejects a non-streaming multibyte feed that exceeds the byte limit", async ({ page }) => {
  const url = "https://feeds.example.test/non-streaming-oversized.xml";
  const body = '<?xml version="1.0"?><rss version="2.0"><channel><title>Oversized Unicode Feed</title><description>' +
    "é".repeat(5_300_000) +
    '</description><item><guid>one</guid><title>Episode</title><enclosure url="https://media.example.test/one.mp3" type="audio/mpeg"/></item></channel></rss>';
  expect(body.length).toBeLessThan(10 * 1024 * 1024);
  expect(Buffer.byteLength(body, "utf8")).toBeGreaterThan(10 * 1024 * 1024);
  await page.evaluate(async ({ body }) => {
    window.fetch = async () => ({
      ok: true,
      headers: { get: () => null },
      body: null,
      text: async () => body
    });
  }, { body });

  await openSection(page, "rss-section");
  await page.locator("#rss-url").fill(url);
  await page.getByRole("button", { name: "Add Feed" }).click();
  await expect(page.locator("#rss-status")).toContainText("10 MB size limit");
  await expect(page.locator("#library-list")).not.toContainText("Oversized Unicode Feed");
});

test("parses Atom enclosure links and resolves relative audio URLs", async ({ page }) => {
  await addFeed(page, ATOM_URL, ATOM);
  await expect(page.locator("#library-list")).toContainText("Atom Regression Podcast");
  await expect(page.locator("#library-list")).toContainText("Atom Episode");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.library).toHaveLength(1);
  expect(saved.library[0].feedUrl).toBe(ATOM_URL);
  const episode = page.locator("#library-list li[data-episode-id]").filter({ hasText: "Atom Episode" });
  await expect(episode).toHaveAttribute("data-audio-url", "https://feeds.example.test/media/atom.mp3");
});

test("ignores stale media error and ended events after switching episodes", async ({ page }) => {
  await addFeed(page, RSS_URL, RSS);
  const episodeOne = page.locator("#library-list").getByText("Episode One", { exact: true });
  await episodeOne.click();
  await page.getByRole("button", { name: "Play Episode" }).first().click();

  const episodeTwo = page.locator("#library-list").getByText("Episode Two", { exact: true });
  await episodeTwo.click();
  await page.getByRole("button", { name: "Play Episode" }).last().click();

  const audio = page.locator("#audio-player");
  await page.evaluate(() => {
    const player = document.querySelector("#audio-player");
    Object.defineProperty(player, "currentSrc", {
      configurable: true,
      value: "https://media.example.test/one.mp3"
    });
    player.dispatchEvent(new Event("error"));
    player.dispatchEvent(new Event("ended"));
  });
  const savedAfterStaleEvents = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(savedAfterStaleEvents.currentEpisode.title).toBe("Episode Two");
  expect(savedAfterStaleEvents.history || []).toHaveLength(0);
  await expect(page.locator("#player-status")).not.toContainText("could not be played");

  await page.evaluate(() => {
    const player = document.querySelector("#audio-player");
    delete player.currentSrc;
    player.dispatchEvent(new Event("ended"));
  });
  const savedAfterCurrentEnded = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(savedAfterCurrentEnded.history).toHaveLength(1);
  expect(savedAfterCurrentEnded.history[0].title).toBe("Episode Two");
});

test("imports valid OPML through the FileReader fallback", async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(Blob.prototype, "text", { configurable: true, value: undefined });
  });
  await page.locator("#import-opml").setInputFiles({
    name: "subscriptions.opml",
    mimeType: "text/xml",
    buffer: Buffer.from('<?xml version="1.0"?><opml version="2.0"><head><title>Test</title></head><body><outline text="Imported Show" xmlUrl="https://opml.example.test/feed.xml"/></body></opml>')
  });
  await expect(page.locator("#library-list")).toContainText("Imported Show");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.library).toHaveLength(1);
  expect(saved.library[0].feedUrl).toBe("https://opml.example.test/feed.xml");
});

test("rejects non-OPML XML and leaves the subscription library unchanged", async ({ page }) => {
  await page.locator("#import-opml").setInputFiles({
    name: "subscriptions.opml",
    mimeType: "text/xml",
    buffer: Buffer.from('<?xml version="1.0"?><opml version="2.0"><head><title>Test</title></head><body><outline text="Existing Show" xmlUrl="https://opml.example.test/existing.xml"/></body></opml>')
  });
  await expect(page.locator("#library-list")).toContainText("Existing Show");
  await page.locator("#import-opml").setInputFiles({
    name: "wrong.xml",
    mimeType: "application/xml",
    buffer: Buffer.from("<root><outline xmlUrl=\"https://example.test/feed.xml\"/></root>")
  });
  await expect(page.locator("#opml-status")).toContainText("not valid OPML/XML");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.library).toHaveLength(1);
  expect(saved.library[0].feedUrl).toBe("https://opml.example.test/existing.xml");
});

test("rejects invalid backups without overwriting current browser data", async ({ page }) => {
  await addFeed(page, RSS_URL, RSS);
  await page.locator("#import-backup").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 2, library: "invalid", queue: [] }))
  });
  await expect(page.locator("#backup-status")).toContainText("invalid library collection");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.library).toHaveLength(1);
  expect(saved.library[0].feedUrl).toBe(RSS_URL);
});


test("ignores a delayed play rejection from an episode that is no longer selected", async ({ page }) => {
  await addFeed(page, RSS_URL, RSS);
  await page.evaluate(() => {
    window.pendingPlayPromises = [];
    HTMLMediaElement.prototype.play = function () {
      return new Promise((resolve, reject) => window.pendingPlayPromises.push({ resolve, reject }));
    };
  });

  await page.locator("#library-list").getByText("Episode One", { exact: true }).click();
  await page.getByRole("button", { name: "Play Episode" }).first().click();
  await page.locator("#library-list").getByText("Episode Two", { exact: true }).click();
  await page.getByRole("button", { name: "Play Episode" }).last().click();

  await page.evaluate(() => {
    window.pendingPlayPromises[0].reject(new DOMException("Playback was interrupted", "NotAllowedError"));
  });
  await expect(page.locator("#player-status")).not.toContainText("The episode is loaded");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.currentEpisode.title).toBe("Episode Two");
});

test("keeps listening timestamps attached to their episodes when duplicate history IDs are removed", async ({ page }) => {
  await openSection(page, "history-section");
  // Trigger persistence explicitly so the test does not depend on the timing
  // of the native details toggle event.
  await page.evaluate(() => {
    document.querySelector("#history-section").dispatchEvent(new Event("toggle"));
  });
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.history).toHaveLength(2);
  expect(saved.history.map(item => item.id)).toEqual(["history-duplicate", "history-unique"]);
  expect(saved.history.map(item => item.playedAt)).toEqual([
    "2026-11-10T01:00:00Z",
    "2026-11-10T03:00:00Z"
  ]);
});

test("rejects an oversized feed when no complete episode fits inside the size limit", async ({ page }) => {
  const oversizedUrl = "https://feeds.example.test/oversized.xml";
  const oversizedBody = " ".repeat(10 * 1024 * 1024 + 1);
  await page.route(oversizedUrl, route => route.fulfill({
    status: 200,
    contentType: "application/xml",
    headers: { "access-control-allow-origin": "*" },
    body: oversizedBody
  }));
  await page.route("https://proxy.cors.dev/**", route => route.fulfill({
    status: 200,
    contentType: "application/xml",
    headers: { "access-control-allow-origin": "*" },
    body: oversizedBody
  }));
  await openSection(page, "rss-section");
  await page.locator("#rss-url").fill(oversizedUrl);
  await page.getByRole("button", { name: "Add Feed" }).click();
  await expect(page.locator("#rss-status")).toContainText("10 MB size limit");
  await expect(page.locator("#library-list")).not.toContainText("Too Large");
});

test("loads the newest episodes from a feed larger than the size limit", async ({ page }) => {
  const largeUrl = "https://feeds.example.test/large.xml";
  const filler = "x".repeat(8000);
  const items = [];
  // Newest first, like real podcast feeds; far more than fits in 10 MB.
  for (let i = 1500; i >= 1; i -= 1) {
    items.push(`<item><guid>large-${i}</guid><title>Large Episode ${i}</title><pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate><enclosure url="https://media.example.test/large-${i}.mp3" type="audio/mpeg" length="1000"/><description>${filler}</description></item>`);
  }
  const largeBody = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>Large Regression Podcast</title><description>A very long show</description>${items.join("\n")}</channel></rss>`;
  expect(Buffer.byteLength(largeBody)).toBeGreaterThan(10 * 1024 * 1024);
  await addFeed(page, largeUrl, largeBody);
  await expect(page.locator("#rss-status")).not.toContainText("size limit");
  await expect(page.locator("#library-list")).toContainText("Large Regression Podcast");
  await expect(page.locator("#library-list")).toContainText("Large Episode 1500");
  await expect(page.locator("#library-list")).not.toContainText(/Large Episode 1(?!\d)/);
});

test("rejects oversized OPML and JSON backup files before parsing", async ({ page }) => {
  await openSection(page, "data-section");
  const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 32);
  await page.locator("#import-opml").setInputFiles({
    name: "oversized.opml",
    mimeType: "text/xml",
    buffer: oversized
  });
  await expect(page.locator("#opml-status")).toContainText("10 MB import limit");
  await page.locator("#import-backup").setInputFiles({
    name: "oversized.json",
    mimeType: "application/json",
    buffer: oversized
  });
  await expect(page.locator("#backup-status")).toContainText("10 MB import limit");
});

test("merges a backup while preserving existing subscriptions and adding missing items", async ({ page }) => {
  await addFeed(page, RSS_URL, RSS);
  await openSection(page, "data-section");
  const backup = {
    schemaVersion: 2,
    library: [
      { title: "Regression Test Podcast Updated", feedUrl: RSS_URL },
      { title: "Backup-Only Podcast", feedUrl: "https://backup.example.test/feed.xml" }
    ],
    queue: [{
      id: "backup-queue-episode",
      title: "Backup Queue Episode",
      showTitle: "Backup-Only Podcast",
      audioUrl: "https://media.example.test/backup.mp3"
    }],
    favorites: [],
    history: [
      { id: "backup-history", title: "Backup History", showTitle: "Backup-Only Podcast", audioUrl: "https://media.example.test/history.mp3", playedAt: "2026-11-10T04:00:00Z" },
      { id: "backup-history", title: "Duplicate Backup History", showTitle: "Backup-Only Podcast", audioUrl: "https://media.example.test/history.mp3", playedAt: "2026-11-10T05:00:00Z" }
    ],
    inProgress: []
  };
  await page.locator("#import-backup").setInputFiles({
    name: "merge.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup))
  });
  await expect(page.locator("#backup-status")).toContainText("Backup merged");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.library).toHaveLength(2);
  expect(saved.library.filter(show => show.feedUrl === RSS_URL)).toHaveLength(1);
  expect(saved.library.some(show => show.feedUrl === "https://backup.example.test/feed.xml")).toBe(true);
  expect(saved.queue.map(item => item.id)).toContain("backup-queue-episode");
  expect(saved.history.filter(item => item.id === "backup-history")).toHaveLength(1);
  expect(saved.history.find(item => item.id === "backup-history").playedAt).toBe("2026-11-10T04:00:00Z");
});

test("replaces existing browser data when the backup replacement option is selected", async ({ page }) => {
  await addFeed(page, RSS_URL, RSS);
  await openSection(page, "data-section");
  const backup = {
    schemaVersion: 2,
    library: [{ title: "Replacement Podcast", feedUrl: "https://replacement.example.test/feed.xml" }],
    queue: [],
    favorites: [],
    history: [],
    inProgress: []
  };
  await page.locator("#replace-backup").check();
  await page.locator("#import-backup").setInputFiles({
    name: "replacement.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup))
  });
  await expect(page.locator("#backup-status")).toContainText("replacing current data");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.library).toHaveLength(1);
  expect(saved.library[0].feedUrl).toBe("https://replacement.example.test/feed.xml");
});

test("skips duplicate OPML subscriptions while adding new feed addresses", async ({ page }) => {
  await addFeed(page, RSS_URL, RSS);
  await openSection(page, "data-section");
  const opml = '<?xml version="1.0"?><opml version="2.0"><head/><body>' +
    '<outline text="Existing" xmlUrl="' + RSS_URL + '"/>' +
    '<outline text="New Show" xmlUrl="https://opml.example.test/new.xml"/>' +
    '<outline text="Duplicate New Show" xmlUrl="https://opml.example.test/new.xml"/>' +
    '</body></opml>';
  await page.locator("#import-opml").setInputFiles({
    name: "subscriptions.opml",
    mimeType: "text/xml",
    buffer: Buffer.from(opml)
  });
  await expect(page.locator("#opml-status")).toContainText("1 new subscriptions");
  await expect(page.locator("#opml-status")).toContainText("2 duplicates were skipped");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.library).toHaveLength(2);
  expect(saved.library.filter(show => show.feedUrl === RSS_URL)).toHaveLength(1);
});


test("merges Apple Podcasts and Podcast Index results without duplicate feed entries", async ({ page }) => {
  await page.route("https://itunes.apple.com/search?**", route => {
    const requestUrl = new URL(route.request().url());
    const callback = requestUrl.searchParams.get("callback");
    const payload = {
      results: [{
        kind: "podcast",
        trackId: 12345,
        trackName: "Shared Podcast",
        artistName: "Apple Creator",
        feedUrl: RSS_URL,
        trackCount: 12
      }]
    };
    return route.fulfill({
      contentType: "application/javascript",
      body: callback + "(" + JSON.stringify(payload) + ");"
    });
  });
  await page.route("https://search.pinepods.online/api/search?**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({
      feeds: [
        { title: "Shared Podcast", author: "Index Creator", feedUrl: RSS_URL },
        { title: "Index-Only Podcast", author: "Index Creator", feedUrl: "https://index.example.test/feed.xml" }
      ]
    })
  }));
  await page.locator("#search-query").fill("shared");
  await page.getByRole("button", { name: "Search Podcasts" }).click();
  await expect(page.locator("#search-status")).toContainText("2 unique podcasts");
  await expect(page.locator("#search-status")).toContainText("duplicates merged: 1");
  await expect(page.locator("#search-results")).toContainText("Shared Podcast");
  await expect(page.locator("#search-results")).toContainText("Index-Only Podcast");
});

test("looks up the feed URL for Apple search results that omit it", async ({ page }) => {
  await page.route("https://itunes.apple.com/search?**", route => {
    const requestUrl = new URL(route.request().url());
    const callback = requestUrl.searchParams.get("callback");
    return route.fulfill({
      contentType: "application/javascript",
      body: callback + "(" + JSON.stringify({
        results: [{
          kind: "podcast",
          trackId: 987654,
          trackName: "Apple Lookup Podcast",
          artistName: "Lookup Creator"
        }]
      }) + ");"
    });
  });
  await page.route("https://itunes.apple.com/lookup?**", route => {
    const requestUrl = new URL(route.request().url());
    expect(requestUrl.searchParams.get("id")).toBe("987654");
    const callback = requestUrl.searchParams.get("callback");
    return route.fulfill({
      contentType: "application/javascript",
      body: callback + "(" + JSON.stringify({
        results: [{ collectionName: "Apple Lookup Podcast", feedUrl: RSS_URL }]
      }) + ");"
    });
  });
  await page.route("https://search.pinepods.online/api/search?**", route => route.abort());
  await page.route(RSS_URL, route => route.fulfill({
    status: 200,
    contentType: "application/xml; charset=utf-8",
    headers: { "access-control-allow-origin": "*" },
    body: RSS
  }));

  await page.locator("#search-query").fill("Apple Lookup Podcast");
  await page.getByRole("button", { name: "Search Podcasts" }).click();
  await expect(page.locator("#search-results")).toContainText("Apple Lookup Podcast");
  await page.locator("#search-results").getByRole("button", { name: "View Episodes" }).click();
  await expect(page.locator("#search-results")).toContainText("Episode One");
});

test("retains the newest played episode IDs and keeps the collection bounded", async ({ page }) => {
  const playedIds = Array.from({ length: 5001 }, (_, index) => "played-" + index);
  await page.addInitScript(([key, value]) => {
    localStorage.setItem(key, value);
  }, [STORAGE_KEY, JSON.stringify({ playedEpisodeIds: playedIds })]);
  await page.reload();
  await addFeed(page, RSS_URL, RSS);
  const episode = page.locator("#library-list li[data-episode-id]").filter({ hasText: "Episode One" });
  await episode.getByRole("button", { name: "Mark Played" }).click();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.playedEpisodeIds).toHaveLength(5000);
  expect(saved.playedEpisodeIds).toContain("played-5000");
  expect(saved.playedEpisodeIds).not.toContain("played-0");
});

test("keeps Podcast Index search results available when Apple Podcasts is unavailable", async ({ page }) => {
  await page.route("https://itunes.apple.com/search?**", route => route.abort());
  await page.route("https://search.pinepods.online/api/search?**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({
      feeds: [{ title: "Fallback Podcast", author: "Index Creator", feedUrl: "https://index.example.test/fallback.xml" }]
    })
  }));
  await page.locator("#search-query").fill("fallback");
  await page.getByRole("button", { name: "Search Podcasts" }).click();
  await expect(page.locator("#search-status")).toContainText("1 unique podcasts");
  await expect(page.locator("#search-status")).toContainText("Apple Podcasts unavailable");
  await expect(page.locator("#search-results")).toContainText("Fallback Podcast");
});

test("retries a transient feed failure and succeeds when the publisher recovers", async ({ page }) => {
  let directAttempts = 0;
  let proxyAttempts = 0;
  await page.route(RSS_URL, route => {
    directAttempts += 1;
    if (directAttempts === 1) return route.fulfill({ status: 500, body: "Temporary failure" });
    return route.fulfill({
      status: 200,
      contentType: "application/xml",
      headers: { "access-control-allow-origin": "*" },
      body: RSS
    });
  });
  await page.route("https://proxy.cors.dev/**", route => {
    proxyAttempts += 1;
    return route.fulfill({ status: 500, body: "Proxy unavailable" });
  });
  await openSection(page, "rss-section");
  await page.locator("#rss-url").fill(RSS_URL);
  await page.getByRole("button", { name: "Add Feed" }).click();
  await expect(page.locator("#library-list")).toContainText("Regression Test Podcast");
  expect(directAttempts).toBe(2);
  expect(proxyAttempts).toBe(1);
});


test("retries a transient failure when refreshing an already subscribed feed", async ({ page }) => {
  await addFeed(page, RSS_URL, RSS);
  await expect(page.locator("#library-list")).toContainText("Episode Two");

  // Replace the add-feed mock so the refresh requests are counted independently.
  await page.unroute(RSS_URL);
  let directAttempts = 0;
  let proxyAttempts = 0;
  await page.route(RSS_URL, route => {
    directAttempts += 1;
    if (directAttempts === 1) return route.fulfill({ status: 503, body: "Temporary publisher failure" });
    return route.fulfill({
      status: 200,
      contentType: "application/xml",
      headers: { "access-control-allow-origin": "*" },
      body: RSS
    });
  });
  await page.route("https://proxy.cors.dev/**", route => {
    proxyAttempts += 1;
    return route.fulfill({ status: 503, body: "Proxy unavailable" });
  });

  const refresh = page.getByRole("button", { name: "Refresh Episodes" });
  await refresh.click();
  await expect(page.locator("#library-list")).toContainText("Episode Two");
  await expect(page.locator("#library-list")).toContainText("Feed loaded directly");
  expect(directAttempts).toBe(2);
  expect(proxyAttempts).toBe(1);
});

test("reorders and removes episodes in the playback queue", async ({ page }) => {
  await addFeed(page, RSS_URL, RSS);
  await page.locator("#library-list").getByText("Episode One", { exact: true }).click();
  await page.getByRole("button", { name: "Add to Queue" }).first().click();
  await page.locator("#library-list").getByText("Episode Two", { exact: true }).click();
  await page.getByRole("button", { name: "Add to Queue" }).last().click();

  await openSection(page, "queue-section");
  let items = page.locator("#queue-list > li");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Episode One");
  await expect(items.nth(1)).toContainText("Episode Two");
  await items.nth(1).getByRole("button", { name: "Move Up" }).click();
  items = page.locator("#queue-list > li");
  await expect(items.nth(0)).toContainText("Episode Two");
  await expect(items.nth(1)).toContainText("Episode One");
  await items.nth(0).getByRole("button", { name: "Remove" }).click();
  items = page.locator("#queue-list > li");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Episode One");
});

test("falls back to the public CORS proxy when a publisher blocks direct feed access", async ({ page }) => {
  await page.route(RSS_URL, route => route.fulfill({ status: 403, body: "Direct access denied" }));
  await page.route("https://proxy.cors.dev/**", route => route.fulfill({
    status: 200,
    contentType: "application/xml",
    headers: { "access-control-allow-origin": "*" },
    body: RSS
  }));
  await openSection(page, "rss-section");
  await page.locator("#rss-url").fill(RSS_URL);
  await page.getByRole("button", { name: "Add Feed" }).click();
  await expect(page.locator("#library-list")).toContainText("Regression Test Podcast");
});

test("reports browser storage quota failures without breaking the current session", async ({ page }) => {
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    };
  });
  await addFeed(page, RSS_URL, RSS);
  await expect(page.locator("#player-status")).toContainText("storage is unavailable or full");
  await expect(page.locator("#library-list")).toContainText("Regression Test Podcast");
});
