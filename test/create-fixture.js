"use strict";

const AdmZip = require("adm-zip");
const path = require("path");

const zip = new AdmZip();

zip.addFile("mimetype", Buffer.from("application/epub+zip"));

zip.addFile(
  "META-INF/container.xml",
  Buffer.from(`<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`),
);

zip.addFile(
  "OEBPS/content.opf",
  Buffer.from(`<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`),
);

zip.addFile(
  "OEBPS/ch1.xhtml",
  Buffer.from(`<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body><h1>Chapter One</h1><p>Hello world from chapter one.</p></body>
</html>`),
);

zip.addFile(
  "OEBPS/ch2.xhtml",
  Buffer.from(`<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 2</title></head>
<body><h1>Chapter Two</h1><p>Content of chapter two.</p></body>
</html>`),
);

zip.addFile(
  "OEBPS/nav.xhtml",
  Buffer.from(`<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<body>
<nav epub:type="toc">
  <ol>
    <li><a href="ch1.xhtml">Chapter One</a></li>
    <li><a href="ch2.xhtml">Chapter Two</a></li>
  </ol>
</nav>
</body>
</html>`),
);

const outPath = path.join(__dirname, "fixtures", "abc123def456", "test-book.epub");
zip.writeZip(outPath);
console.log("Created:", outPath);
