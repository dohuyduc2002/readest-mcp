"use strict";

const fs = require("fs").promises;
const { existsSync } = require("fs");
const path = require("path");
const os = require("os");
const EpubParser = require("./epub-parser");

const HASH_RE = /^[a-f0-9]+$/i;
const MAX_CACHE_SIZE = 20;

class ReadestLibrary {
  constructor(dataDir) {
    this.dataDir = path.resolve(
      dataDir ||
        process.env.READEST_BOOKS_DIR ||
        path.join(
          os.homedir(),
          ".var/app/com.bilingify.readest/data/com.bilingify.readest/Readest/Books",
        ),
    );
    this.libraryIndexPath = path.join(this.dataDir, "library.json");
    this._parserCache = new Map();
  }

  // --- Security helpers ---

  _validateHash(hash) {
    if (typeof hash !== "string" || !HASH_RE.test(hash)) {
      throw new Error("Invalid book ID format");
    }
    return hash;
  }

  _assertWithinDataDir(resolvedPath) {
    const normalized = path.resolve(resolvedPath);
    if (
      !normalized.startsWith(this.dataDir + path.sep) &&
      normalized !== this.dataDir
    ) {
      throw new Error("Access denied: path outside data directory");
    }
    return normalized;
  }

  // --- File I/O ---

  async _readJson(filePath) {
    const safe = this._assertWithinDataDir(filePath);
    if (!existsSync(safe)) return null;
    const content = await fs.readFile(safe, "utf8");
    return content ? JSON.parse(content) : null;
  }

  async _writeJson(filePath, data) {
    const safe = this._assertWithinDataDir(filePath);
    await fs.writeFile(safe, JSON.stringify(data, null, 2), "utf8");
  }

  // --- Public API ---

  async listBooks() {
    const index = (await this._readJson(this.libraryIndexPath)) || [];
    return index.map((book) => ({
      id: book.hash,
      title: book.title || book.metadata?.title || "Unknown Title",
      author: book.author || book.metadata?.author || "Unknown Author",
      format: book.format,
    }));
  }

  async getBookConfig(hash) {
    const safeHash = this._validateHash(hash);
    const configPath = path.join(this.dataDir, safeHash, "config.json");
    return this._readJson(configPath);
  }

  async getBookDetails(id) {
    const safeId = this._validateHash(id);
    const index = (await this._readJson(this.libraryIndexPath)) || [];
    const book = index.find((b) => b.hash === safeId);
    if (!book) return null;
    const config = await this.getBookConfig(safeId);
    return { ...book, config };
  }

  async getChapterContent(id, chapterIndex) {
    const safeId = this._validateHash(id);
    const index = (await this._readJson(this.libraryIndexPath)) || [];
    const book = index.find((b) => b.hash === safeId);
    if (!book) throw new Error(`Book not found: ${safeId}`);

    const bookDir = path.join(this.dataDir, safeId);
    this._assertWithinDataDir(bookDir);
    if (!existsSync(bookDir)) {
      throw new Error(`Book directory not found: ${safeId}`);
    }

    const files = await fs.readdir(bookDir);
    const epubFile = files.find((f) => f.endsWith(".epub"));
    if (!epubFile) throw new Error("EPUB file not found in book directory");

    const epubPath = path.join(bookDir, epubFile);
    const parser = await this._getParser(safeId, epubPath);

    if (chapterIndex !== undefined) {
      const content = parser.getChapterContent(chapterIndex);
      if (content === null) throw new Error("Chapter index out of bounds");
      return content;
    }

    const parts = [];
    for (let i = 0; i < parser.getChapterCount(); i++) {
      parts.push(`--- Chapter ${i} ---\n${parser.getChapterContent(i)}`);
    }
    return parts.join("\n\n");
  }

  async updateBookmark(bookId, bookmarkId, updates) {
    const safeBookId = this._validateHash(bookId);
    if (typeof bookmarkId !== "string" || bookmarkId.length === 0) {
      throw new Error("Invalid bookmark ID");
    }

    const configPath = path.join(this.dataDir, safeBookId, "config.json");
    const config = await this._readJson(configPath);
    if (!config) throw new Error(`Config not found for book: ${safeBookId}`);
    if (!Array.isArray(config.booknotes)) {
      throw new Error(`No bookmarks in book: ${safeBookId}`);
    }

    const bookmark = config.booknotes.find((b) => b.id === bookmarkId);
    if (!bookmark) throw new Error(`Bookmark not found: ${bookmarkId}`);

    if (updates.note !== undefined) bookmark.note = String(updates.note);
    if (updates.color !== undefined) bookmark.color = updates.color === null ? null : String(updates.color);
    bookmark.updatedAt = Date.now();

    await this._writeJson(configPath, config);
    return bookmark;
  }

  // --- Internal ---

  async _getParser(id, epubPath) {
    if (this._parserCache.has(id)) return this._parserCache.get(id);

    if (this._parserCache.size >= MAX_CACHE_SIZE) {
      const oldest = this._parserCache.keys().next().value;
      this._parserCache.delete(oldest);
    }

    const parser = new EpubParser(epubPath);
    await parser.parse();
    this._parserCache.set(id, parser);
    return parser;
  }
}

module.exports = ReadestLibrary;
