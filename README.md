# readest-mcp

MCP (Model Context Protocol) server for the [Readest](https://github.com/nicepkg/readest) e-book library. Exposes your local Readest library to LLM tools via stdio transport.

## Setup

```bash
npm install
```

Configure the books directory (defaults to the Readest Flatpak data path):

```bash
export READEST_BOOKS_DIR=~/.var/app/com.bilingify.readest/data/com.bilingify.readest/Readest/Books
```

## Usage

```bash
npm start
# or
npx readest-mcp
```

Add to your MCP client config (e.g. Claude Desktop):

```json
{
  "mcpServers": {
    "readest": {
      "command": "node",
      "args": ["/path/to/readest-mcp/src/server.js"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `list_books` | List all books in the library |
| `get_book_content` | Get chapter text by book ID and chapter index |
| `get_book_details` | Get full book metadata, config, and bookmarks |
| `update_bookmark` | Update a bookmark's note or color |

## Project Structure

```
src/
├── server.js        # Entry point — wires server, library, tools
├── library.js      # Filesystem access with path-traversal guards
├── epub-parser.js  # EPUB extraction (OPF/NCX/NAV parsing)
└── tools.js        # MCP tool definitions with Zod schemas
```

## Development

```bash
npm run lint        # ESLint check
npm run lint:fix    # Auto-fix
```

## License

ISC
