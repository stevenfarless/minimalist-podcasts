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

async function mockMedia(page) {
  await page.addInitScript(() => {
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
  });
}

async function addFeed(page, url, body) {
  await page.route(url, route => route.fulfill({
    status: 200,
    contentType: "application/xml; charset=utf-8",
    body
  }));
  await page.locator("#rss-url").fill(url);
  await page.getByRole("button", { name: "Add Feed" }).click();
}

test.beforeEach(async ({ page }) => {
  await mockMedia(page);
  await page.goto("/");
});

test("normalizes malformed local storage without crashing or retaining invalid records", async ({ page }) => {
  await page.evaluate(key => {
    localStorage.setItem(key, JSON.stringify({
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
    }));
  }, STORAGE_KEY);
  await page.reload();
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
  expect(saved.expandedSections).toEqual({ "library-section": true });
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

test("parses Atom enclosure links and resolves relative audio URLs", async ({ page }) => {
  await addFeed(page, ATOM_URL, ATOM);
  await expect(page.locator("#library-list")).toContainText("Atom Regression Podcast");
  await expect(page.locator("#library-list")).toContainText("Atom Episode");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.library).toHaveLength(1);
  expect(saved.library[0].feedUrl).toBe(ATOM_URL);
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
    name: "wrong.xml",
    mimeType: "application/xml",
    buffer: Buffer.from("<root><outline xmlUrl=\"https://example.test/feed.xml\"/></root>")
  });
  await expect(page.locator("#opml-status")).toContainText("not valid OPML/XML");
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.library).toHaveLength(0);
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
