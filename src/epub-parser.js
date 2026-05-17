"use strict";

const AdmZip = require("adm-zip");
const path = require("path").posix; // fix on window force to possix
const { XMLParser } = require("fast-xml-parser");

class EpubParser {
  constructor(epubPath) {
    this.epubPath = epubPath;
    this.zip = new AdmZip(epubPath);
    this.contentDir = "";
    this.spine = [];
    this.manifest = {};
    this.toc = [];
    this.metadata = {};
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      processEntities: true,
      trimValues: true,
    });
  }

  async parse() {
    const containerEntry = this.zip.getEntry("META-INF/container.xml");
    if (!containerEntry) {
      throw new Error("Invalid EPUB: META-INF/container.xml not found");
    }

    const containerData = this.xmlParser.parse(
      containerEntry.getData().toString(),
    );
    const rootfiles = containerData?.container?.rootfiles?.rootfile;
    const opfPath = Array.isArray(rootfiles)
      ? rootfiles[0]["@_full-path"]
      : rootfiles?.["@_full-path"];

    if (!opfPath) {
      throw new Error("Invalid EPUB: Could not find OPF path in container.xml");
    }

    this.contentDir = path.dirname(opfPath);
    if (this.contentDir === ".") this.contentDir = "";

    const opfEntry = this.zip.getEntry(opfPath);
    if (!opfEntry) {
      throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);
    }

    const opfData = this.xmlParser.parse(opfEntry.getData().toString());
    const opfPackage = opfData.package;

    this._parseMetadata(opfPackage.metadata);
    this._parseManifest(opfPackage.manifest);
    this._parseSpine(opfPackage.spine);
    await this._parseTOC();
  }

  _parseMetadata(metadata) {
    this.metadata = {
      title:
        metadata["dc:title"]?.["#text"] ||
        metadata["dc:title"] ||
        "Unknown Title",
      author:
        metadata["dc:creator"]?.["#text"] ||
        metadata["dc:creator"] ||
        "Unknown Author",
    };
  }

  _parseManifest(manifest) {
    const items = Array.isArray(manifest.item)
      ? manifest.item
      : [manifest.item];

    this._navPath = null;
    this._ncxPath = null;

    for (const item of items) {
      const id = item["@_id"];
      const href = item["@_href"];
      const type = item["@_media-type"];
      const properties = item["@_properties"] || "";

      this.manifest[id] = { href, mediaType: type, properties };

      if (properties.includes("nav")) this._navPath = href;
      if (type === "application/x-dtbncx+xml") this._ncxPath = href;
    }
  }

  _parseSpine(spine) {
    const tocId = spine["@_toc"];
    if (tocId && this.manifest[tocId]) {
      this._ncxPath = this.manifest[tocId].href;
    }

    const itemrefs = Array.isArray(spine.itemref)
      ? spine.itemref
      : [spine.itemref];
    this.spine = itemrefs.map((ref) => ref["@_idref"]);
  }

  async _parseTOC() {
    if (this._navPath) {
      this._parseNav(this._navPath);
    } else if (this._ncxPath) {
      this._parseNCX(this._ncxPath);
    }
  }

  _parseNav(navHref) {
    const navPath = this.contentDir
      ? path.join(this.contentDir, navHref)
      : navHref;
    const entry = this.zip.getEntry(navPath);
    if (!entry) return;

    const navData = this.xmlParser.parse(entry.getData().toString());

    const findNav = (obj) => {
      if (!obj) return null;
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const res = findNav(item);
          if (res) return res;
        }
      } else if (typeof obj === "object") {
        if (obj["@_epub:type"] === "toc") return obj;
        for (const key in obj) {
          const res = findNav(obj[key]);
          if (res) return res;
        }
      }
      return null;
    };

    const tocNav = findNav(navData);
    if (tocNav?.ol) {
      const items = Array.isArray(tocNav.ol.li)
        ? tocNav.ol.li
        : [tocNav.ol.li];
      for (const li of items) {
        const a = li.a;
        if (a) {
          this.toc.push({
            href: (a["@_href"] || "").split("#")[0],
            label: a["#text"] || (typeof a === "string" ? a : "Chapter"),
          });
        }
      }
    }
  }

  _parseNCX(ncxHref) {
    const ncxPath = this.contentDir
      ? path.join(this.contentDir, ncxHref)
      : ncxHref;
    const entry = this.zip.getEntry(ncxPath);
    if (!entry) return;

    const ncxData = this.xmlParser.parse(entry.getData().toString());
    const navMap = ncxData.ncx?.navMap;
    if (navMap?.navPoint) {
      const navPoints = Array.isArray(navMap.navPoint)
        ? navMap.navPoint
        : [navMap.navPoint];
      for (const pt of navPoints) {
        this.toc.push({
          label: pt.navLabel?.text || "Chapter",
          href: (pt.content?.["@_src"] || "").split("#")[0],
        });
      }
    }
  }

  getChapterCount() {
    return this.spine.length;
  }

  getTOC() {
    return this.toc;
  }

  getChapterContent(index) {
    if (index < 0 || index >= this.spine.length) return null;

    const idref = this.spine[index];
    const item = this.manifest[idref];
    if (!item) return null;

    const chapterPath = this.contentDir
      ? path.join(this.contentDir, item.href)
      : item.href;
    const entry = this.zip.getEntry(chapterPath);
    if (!entry) return null;

    let content = entry.getData().toString();
    content = content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, "");
    content = content.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, "");
    content = content.replace(/<(p|div|h[1-6]|li|br|tr)[^>]*>/gi, "\n");
    content = content.replace(/<(blockquote|section|article)[^>]*>/gi, "\n\n");
    content = content.replace(/<[^>]+>/g, " ");
    content = content.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
    content = content.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    content = content.replace(/&(nbsp|lt|gt|amp|quot|apos|mdash|ndash|lsquo|rsquo|ldquo|rdquo|hellip|copy|reg|trade);/gi, (_, e) => ({
      nbsp: " ", lt: "<", gt: ">", amp: "&", quot: '"', apos: "'",
      mdash: "\u2014", ndash: "\u2013", lsquo: "\u2018", rsquo: "\u2019",
      ldquo: "\u201C", rdquo: "\u201D", hellip: "\u2026", copy: "\u00A9",
      reg: "\u00AE", trade: "\u2122",
    })[e.toLowerCase()] || "");

    return content
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n/g, "\n\n")
      .trim();
  }
}

module.exports = EpubParser;
