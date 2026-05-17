#!/usr/bin/env node
"use strict";

const { FastMCP } = require("fastmcp");
const ReadestLibrary = require("./library");
const { registerTools } = require("./tools");

const library = new ReadestLibrary();
const server = new FastMCP({
  name: "Readest MCP Server",
  version: "1.0.0",
});

registerTools(server, library);
server.start({ transportType: "stdio" });
