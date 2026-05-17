"use strict";

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const EpubParser = require("../src/epub-parser");

const EPUB_PATH = path.join(
  __dirname,
  "fixtures",
  "abc123def456",
  "test-book.epub",
);

describe("EpubParser", () => {
  let parser;

  before(async () => {
    parser = new EpubParser(EPUB_PATH);
    await parser.parse();
  });

  it("parses metadata", () => {
    assert.equal(parser.metadata.title, "Test Book");
    assert.equal(parser.metadata.author, "Test Author");
  });

  it("parses spine with correct count", () => {
    assert.equal(parser.getChapterCount(), 2);
  });

  it("parses TOC from nav", () => {
    const toc = parser.getTOC();
    assert.equal(toc.length, 2);
    assert.equal(toc[0].label, "Chapter One");
    assert.equal(toc[0].href, "ch1.xhtml");
    assert.equal(toc[1].label, "Chapter Two");
  });

  it("extracts chapter content as plain text", () => {
    const ch1 = parser.getChapterContent(0);
    assert.ok(ch1.includes("Chapter One"));
    assert.ok(ch1.includes("Hello world from chapter one"));
    assert.ok(!ch1.includes("<h1>"));
  });

  it("returns null for out-of-bounds index", () => {
    assert.equal(parser.getChapterContent(-1), null);
    assert.equal(parser.getChapterContent(5), null);
  });

  it("throws on invalid EPUB path", () => {
    assert.throws(() => new EpubParser("/nonexistent.epub"));
  });
});
