"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const ReadestLibrary = require("../src/library");

const FIXTURES = path.join(__dirname, "fixtures");

describe("ReadestLibrary", () => {
  let lib;

  before(() => {
    lib = new ReadestLibrary(FIXTURES);
  });

  describe("_validateHash", () => {
    it("accepts valid hex hash", () => {
      assert.equal(lib._validateHash("abc123def456"), "abc123def456");
    });

    it("rejects path traversal attempts", () => {
      assert.throws(() => lib._validateHash("../etc/passwd"), /Invalid book ID/);
    });

    it("rejects non-hex characters", () => {
      assert.throws(() => lib._validateHash("abc-xyz"), /Invalid book ID/);
    });

    it("rejects empty string", () => {
      assert.throws(() => lib._validateHash(""), /Invalid book ID/);
    });
  });

  describe("_assertWithinDataDir", () => {
    it("allows paths inside data dir", () => {
      const p = path.join(FIXTURES, "abc123def456", "config.json");
      assert.equal(lib._assertWithinDataDir(p), path.resolve(p));
    });

    it("blocks paths outside data dir", () => {
      assert.throws(
        () => lib._assertWithinDataDir("/etc/passwd"),
        /Access denied/,
      );
    });

    it("blocks path traversal via ..", () => {
      assert.throws(
        () => lib._assertWithinDataDir(path.join(FIXTURES, "..", "..", "etc")),
        /Access denied/,
      );
    });
  });

  describe("listBooks", () => {
    it("returns array of books from library.json", async () => {
      const books = await lib.listBooks();
      assert.equal(books.length, 1);
      assert.equal(books[0].id, "abc123def456");
      assert.equal(books[0].title, "Test Book");
      assert.equal(books[0].author, "Test Author");
    });

    it("includes bookmarks from config", async () => {
      const books = await lib.listBooks();
      assert.equal(books[0].bookmarks.length, 1);
      assert.equal(books[0].bookmarks[0].id, "note-001");
    });
  });

  describe("getBookConfig", () => {
    it("returns config for valid hash", async () => {
      const config = await lib.getBookConfig("abc123def456");
      assert.deepEqual(config.progress, [10, 100]);
      assert.equal(config.booknotes.length, 1);
    });

    it("returns null for nonexistent book", async () => {
      const config = await lib.getBookConfig("deadbeef0000");
      assert.equal(config, null);
    });
  });

  describe("getBookDetails", () => {
    it("returns full details for existing book", async () => {
      const details = await lib.getBookDetails("abc123def456");
      assert.equal(details.title, "Test Book");
      assert.ok(details.config);
    });

    it("returns null for unknown book", async () => {
      const details = await lib.getBookDetails("deadbeef0000");
      assert.equal(details, null);
    });
  });

  describe("getChapterContent", () => {
    it("returns chapter text by index", async () => {
      const text = await lib.getChapterContent("abc123def456", 0);
      assert.ok(text.includes("Chapter One"));
      assert.ok(text.includes("Hello world from chapter one"));
    });

    it("returns second chapter", async () => {
      const text = await lib.getChapterContent("abc123def456", 1);
      assert.ok(text.includes("Chapter Two"));
    });

    it("throws on out-of-bounds index", async () => {
      await assert.rejects(
        () => lib.getChapterContent("abc123def456", 99),
        /out of bounds/,
      );
    });

    it("throws on unknown book", async () => {
      await assert.rejects(
        () => lib.getChapterContent("deadbeef0000", 0),
        /not found/,
      );
    });
  });

  describe("updateBookmark", () => {
    const configPath = path.join(FIXTURES, "abc123def456", "config.json");
    let originalContent;

    before(() => {
      originalContent = fs.readFileSync(configPath, "utf8");
    });

    after(() => {
      fs.writeFileSync(configPath, originalContent, "utf8");
    });

    it("updates note text", async () => {
      const result = await lib.updateBookmark("abc123def456", "note-001", {
        note: "Updated note",
      });
      assert.equal(result.note, "Updated note");
      assert.ok(result.updatedAt > 0);
    });

    it("updates color", async () => {
      const result = await lib.updateBookmark("abc123def456", "note-001", {
        color: "blue",
      });
      assert.equal(result.color, "blue");
    });

    it("throws on invalid bookmark id", async () => {
      await assert.rejects(
        () => lib.updateBookmark("abc123def456", "nonexistent", { note: "x" }),
        /Bookmark not found/,
      );
    });
  });
});
