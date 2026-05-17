"use strict";

const { z } = require("zod");

const BookIdSchema = z
  .string()
  .regex(/^[a-f0-9]+$/i, "Must be a hex hash")
  .describe("The hash identifier of the book.");

/**
 * Registers all MCP tools on the given FastMCP server instance.
 */
function registerTools(server, library) {
  server.addTool({
    name: "list_books",
    description:
      "List all books in the Readest library (id, title, author, format). Use get_book_details for full metadata and bookmarks.",
    parameters: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async () => ({
      content: [
        { type: "text", text: JSON.stringify(await library.listBooks(), null, 2) },
      ],
    }),
  });

  server.addTool({
    name: "get_book_content",
    description:
      "Get plain-text content of a specific book chapter by its ID and zero-based chapter index.",
    parameters: z.object({
      id: BookIdSchema,
      chapter_index: z
        .number()
        .int()
        .min(0)
        .describe("Zero-based index of the chapter."),
    }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async ({ id, chapter_index }) => ({
      content: [
        { type: "text", text: await library.getChapterContent(id, chapter_index) },
      ],
    }),
  });

  server.addTool({
    name: "get_book_details",
    description:
      "Get full metadata, reading config, and all bookmarks/annotations for a book.",
    parameters: z.object({ id: BookIdSchema }),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async ({ id }) => {
      const data = await library.getBookDetails(id);
      if (!data) throw new Error("Book not found");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  });

  server.addTool({
    name: "update_bookmark",
    description: "Update a bookmark's note text or highlight color.",
    parameters: z.object({
      book_id: BookIdSchema,
      bookmark_id: z
        .string()
        .min(1)
        .describe("The unique ID of the bookmark to update."),
      note: z.string().optional().describe("New note text for the bookmark."),
      color: z
        .enum(["yellow", "green", "blue", "pink", "red", "violet"])
        .optional()
        .nullable()
        .describe("New highlight color."),
    }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async ({ book_id, bookmark_id, note, color }) => {
      const updated = await library.updateBookmark(book_id, bookmark_id, {
        note,
        color,
      });
      return {
        content: [
          {
            type: "text",
            text: `Updated bookmark ${bookmark_id}:\n${JSON.stringify(updated, null, 2)}`,
          },
        ],
      };
    },
  });
}

module.exports = { registerTools };
