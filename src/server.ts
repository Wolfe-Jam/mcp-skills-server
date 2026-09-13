/**
 * mcp-skills-server — serves a directory of Agent Skills (SKILL.md) over
 * MCP, per SEP-2640 ("Skills Extension",
 * https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640):
 *
 *   skills/list          — enumerate every skill this server serves
 *   skills/get           — retrieve one skill's entry by its SKILL.md URI
 *   resources/read       — read any file within a skill (standard MCP)
 *   resources/list        — every skill file, as plain resources (for
 *                           clients that aren't skills-extension-aware)
 *
 * Point it at any directory whose immediate subdirectories are Agent Skills
 * (https://agentskills.io/specification) — this is not FAF-specific; the
 * bundled `examples/skills/` (from Wolfe-Jam/faf-skills) is real content
 * used as the default, not a synthetic demo.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  RequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { buildSkillIndex, type SkillIndex } from "./skills.js";
import { NAME, SKILLS_EXTENSION_ID, VERSION } from "./constants.js";

const SkillsListRequestSchema = RequestSchema.extend({
  method: z.literal("skills/list"),
  params: z.object({ cursor: z.string().optional() }).optional(),
});

const SkillsGetRequestSchema = RequestSchema.extend({
  method: z.literal("skills/get"),
  params: z.object({ uri: z.string() }),
});

export function createServer(index: SkillIndex): Server {
  const server = new Server(
    { name: NAME, version: VERSION },
    {
      capabilities: {
        resources: {},
        extensions: { [SKILLS_EXTENSION_ID]: {} },
      },
    },
  );

  // ── Standard MCP resources — every skill file, for clients that don't
  //    know about the skills extension at all. ─────────────────────────
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [...index.filesByUri.values()].map((f) => ({
      uri: f.uri,
      name: f.uri.slice("skill://".length),
      mimeType: f.mimeType,
    })),
  }));

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const file = index.filesByUri.get(req.params.uri);
    if (!file) {
      throw new McpError(ErrorCode.InvalidParams, `unknown resource: ${req.params.uri}`);
    }
    const bytes = await readFile(file.absPath);
    const isText = file.mimeType.startsWith("text/") || file.mimeType === "application/json" || file.mimeType === "application/yaml";
    return {
      contents: [
        isText
          ? { uri: file.uri, mimeType: file.mimeType, text: bytes.toString("utf8") }
          : { uri: file.uri, mimeType: file.mimeType, blob: bytes.toString("base64") },
      ],
    };
  });

  // ── SEP-2640: Skills Extension ────────────────────────────────────────
  server.setRequestHandler(SkillsListRequestSchema, async () => ({
    resultType: "complete" as const,
    skills: index.entries,
  }));

  server.setRequestHandler(SkillsGetRequestSchema, async (req) => {
    const entry = index.entryByUri.get(req.params.uri);
    if (!entry) {
      throw new McpError(ErrorCode.InvalidParams, `unknown skill: ${req.params.uri}`);
    }
    return { resultType: "complete" as const, skill: entry };
  });

  return server;
}

export { buildSkillIndex } from "./skills.js";
export type { SkillEntry, SkillFile, SkillIndex, SkillResource } from "./skills.js";
