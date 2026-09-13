/**
 * Real end-to-end demo: spawns the built server over stdio, connects a real
 * MCP client, and drives every method this server implements. `npm run demo`
 * (after `npm run build`) — not a unit test, a live proof the wire protocol
 * actually works, digests included.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/bin.js"],
});
const client = new Client({ name: "mcp-skills-server-demo", version: "0" }, { capabilities: {} });
await client.connect(transport);

console.log("server:", client.getServerVersion());
console.log("capabilities:", JSON.stringify(client.getServerCapabilities()));

// skills/list and skills/get aren't in the SDK's built-in convenience methods
// yet (SEP-2640 hasn't landed there) — call them via the generic escape hatch.
const AnyResult = z.looseObject({});

const list = (await client.request({ method: "skills/list", params: {} }, AnyResult)) as any;
console.log(
  `skills/list -> ${list.skills.length} skills:`,
  list.skills.map((s: any) => s.frontmatter.name),
);

const get = (await client.request(
  { method: "skills/get", params: { uri: "skill://faf-context/SKILL.md" } },
  AnyResult,
)) as any;
console.log("skills/get(faf-context) ->", JSON.stringify(get.skill, null, 2));

const read = await client.readResource({ uri: "skill://faf-context/SKILL.md" });
const body = "text" in read.contents[0] ? read.contents[0].text : "<binary>";
console.log("resources/read ->", body.slice(0, 80) + "...");

await client.close();
console.log("DEMO OK");
