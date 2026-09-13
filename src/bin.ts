#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSkillIndex, createServer } from "./server.js";

const here = dirname(fileURLToPath(import.meta.url));
/** `dist/` at runtime, `src/` under tsx — both are one up from this file. */
const packageRoot = join(here, "..");

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.error(
    "mcp-skills-server — serves a directory of Agent Skills (SKILL.md) over MCP (SEP-2640)\n\n" +
      "Usage: mcp-skills-server [--help] [--version]\n\n" +
      "Env: MCP_SKILLS_SERVER_ROOT — directory whose immediate subdirectories are skills\n" +
      "     (defaults to this package's bundled examples/skills/, real content from\n" +
      "     Wolfe-Jam/faf-skills, not a synthetic demo).",
  );
  process.exit(0);
}
if (args.includes("--version") || args.includes("-V")) {
  const { VERSION } = await import("./constants.js");
  console.error(VERSION);
  process.exit(0);
}

const root = process.env.MCP_SKILLS_SERVER_ROOT ?? join(packageRoot, "examples/skills");

const index = await buildSkillIndex(root);
const server = createServer(index);
const transport = new StdioServerTransport();
console.error(`mcp-skills-server: serving ${index.entries.length} skill(s) from ${root}`);
await server.connect(transport);
