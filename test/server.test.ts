import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { buildSkillIndex, createServer } from "../src/server.js";
import { SKILLS_EXTENSION_ID } from "../src/constants.js";

const EXAMPLES_ROOT = join(import.meta.dirname, "..", "examples", "skills");

// `skills/list` / `skills/get` aren't in the SDK's built-in client convenience
// methods (SEP-2640 hasn't landed there yet) — call them via the generic
// `request()` escape hatch, same mechanism the server used to register them.
const AnyResult = z.looseObject({});

async function connected(): Promise<Client> {
  const index = await buildSkillIndex(EXAMPLES_ROOT);
  const server = createServer(index);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" }, { capabilities: {} });
  await Promise.all([server.connect(b), client.connect(a)]);
  return client;
}

test("server: declares the io.modelcontextprotocol/skills extension capability", async () => {
  const client = await connected();
  const caps = client.getServerCapabilities();
  assert.ok(caps?.extensions?.[SKILLS_EXTENSION_ID], "skills extension capability must be declared");
  await client.close();
});

test("skills/list: returns every bundled skill with resultType complete", async () => {
  const client = await connected();
  const result = (await client.request({ method: "skills/list", params: {} }, AnyResult)) as any;
  assert.equal(result.resultType, "complete");
  assert.equal(result.skills.length, 7);
  const names = result.skills.map((s: any) => s.frontmatter.name).sort();
  assert.deepEqual(names, [
    "faf-context",
    "faf-expert",
    "faf-go",
    "faf-wizard",
    "repo-maintainer",
    "wjttc-builder",
    "wjttc-tester",
  ]);
  await client.close();
});

test("skills/get: returns the named skill by its SKILL.md uri", async () => {
  const client = await connected();
  const result = (await client.request(
    { method: "skills/get", params: { uri: "skill://faf-context/SKILL.md" } },
    AnyResult,
  )) as any;
  assert.equal(result.resultType, "complete");
  assert.equal(result.skill.frontmatter.name, "faf-context");
  assert.equal(result.skill.uri, "skill://faf-context/SKILL.md");
  await client.close();
});

test("skills/get: an unknown skill uri is InvalidParams (-32602), matching resources/read", async () => {
  const client = await connected();
  await assert.rejects(
    () => client.request({ method: "skills/get", params: { uri: "skill://nonexistent/SKILL.md" } }, AnyResult),
    (err: any) => {
      assert.equal(err.code, ErrorCode.InvalidParams);
      return true;
    },
  );
  await client.close();
});

test("resources/read: reads a skill file's real bytes back over the wire", async () => {
  const client = await connected();
  const { contents } = await client.readResource({ uri: "skill://faf-context/SKILL.md" });
  assert.equal(contents.length, 1);
  assert.equal(contents[0].mimeType, "text/markdown");
  assert.ok("text" in contents[0], "SKILL.md must come back as text, not blob");
  assert.ok((contents[0] as { text: string }).text.includes("name: faf-context"));
});

test("resources/read: an unknown skill file uri is InvalidParams (-32602)", async () => {
  const client = await connected();
  await assert.rejects(
    () => client.readResource({ uri: "skill://faf-context/does-not-exist.md" }),
    (err: any) => {
      assert.equal(err.code, ErrorCode.InvalidParams);
      return true;
    },
  );
});

test("resources/list: every skill file is discoverable as a plain resource too", async () => {
  const client = await connected();
  const { resources } = await client.listResources();
  assert.equal(resources.length, 7); // one SKILL.md per example skill, all flat
  assert.ok(resources.every((r) => r.uri.startsWith("skill://")));
  assert.ok(resources.some((r) => r.uri === "skill://faf-context/SKILL.md"));
});
