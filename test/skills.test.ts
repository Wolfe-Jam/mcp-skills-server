import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSkillIndex } from "../src/skills.js";

const EXAMPLES_ROOT = join(import.meta.dirname, "..", "examples", "skills");
const EXAMPLE_SKILL_NAMES = [
  "faf-context",
  "faf-expert",
  "faf-go",
  "faf-wizard",
  "repo-maintainer",
  "wjttc-builder",
  "wjttc-tester",
];

function scratch(files: Record<string, string>): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "mcp-skills-server-"));
  for (const [relPath, body] of Object.entries(files)) {
    const full = join(root, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("buildSkillIndex: discovers every bundled example skill, one entry each", async () => {
  const index = await buildSkillIndex(EXAMPLES_ROOT);
  assert.deepEqual(
    index.entries.map((e) => e.frontmatter.name).sort(),
    [...EXAMPLE_SKILL_NAMES].sort(),
  );
});

test("buildSkillIndex: entry uri, frontmatter, and resources match SEP-2640's shape", async () => {
  const index = await buildSkillIndex(EXAMPLES_ROOT);
  for (const entry of index.entries) {
    const name = entry.frontmatter.name as string;
    assert.equal(entry.uri, `skill://${name}/SKILL.md`);
    assert.equal(typeof entry.frontmatter.description, "string");
    assert.ok((entry.frontmatter.description as string).length > 0);
    assert.ok(
      Array.isArray(entry.resources),
      "resources must be an array (none of the examples are dynamic)",
    );
    assert.ok(
      entry.resources.some((r) => r.uri === entry.uri),
      "resources must include an entry matching the skill's own uri",
    );
    for (const resource of entry.resources) {
      assert.match(resource.digest, /^sha256:[0-9a-f]{64}$/, `${resource.uri}: malformed digest`);
      assert.ok(resource.size > 0, `${resource.uri}: size must be > 0`);
    }
  }
});

test("buildSkillIndex: digest is a real SHA-256 of the file's exact bytes", async () => {
  const index = await buildSkillIndex(EXAMPLES_ROOT);
  const faf = index.entryByUri.get("skill://faf-context/SKILL.md");
  assert.ok(faf, "faf-context skill entry must exist");
  const bytes = readFileSync(join(EXAMPLES_ROOT, "faf-context", "SKILL.md"));
  const expected = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  assert.equal(faf!.resources[0].digest, expected);
  assert.equal(faf!.resources[0].size, bytes.byteLength);
});

test("buildSkillIndex: filesByUri resolves every resource to its file on disk", async () => {
  const index = await buildSkillIndex(EXAMPLES_ROOT);
  for (const entry of index.entries) {
    for (const resource of entry.resources) {
      const file = index.filesByUri.get(resource.uri);
      assert.ok(file, `${resource.uri}: missing from filesByUri`);
      assert.equal(file!.digest, resource.digest);
      assert.equal(file!.size, resource.size);
    }
  }
});

test("buildSkillIndex: a directory without a SKILL.md is not a skill", async () => {
  const { root, cleanup } = scratch({
    "real-skill/SKILL.md": "---\nname: real-skill\ndescription: a real one\n---\nbody",
    "not-a-skill/README.md": "just a readme, no SKILL.md here",
  });
  try {
    const index = await buildSkillIndex(root);
    assert.deepEqual(
      index.entries.map((e) => e.frontmatter.name),
      ["real-skill"],
    );
  } finally {
    cleanup();
  }
});

test("buildSkillIndex: throws when frontmatter name doesn't match the directory name", async () => {
  const { root, cleanup } = scratch({
    "actual-dir-name/SKILL.md":
      "---\nname: wrong-name\ndescription: mismatched on purpose\n---\nbody",
  });
  try {
    await assert.rejects(() => buildSkillIndex(root), /must match its directory name/);
  } finally {
    cleanup();
  }
});

test("buildSkillIndex: throws when frontmatter is missing name or description", async () => {
  const { root, cleanup } = scratch({
    "no-description/SKILL.md": "---\nname: no-description\n---\nbody",
  });
  try {
    await assert.rejects(() => buildSkillIndex(root), /missing required "description"/);
  } finally {
    cleanup();
  }
});

test("buildSkillIndex: throws when SKILL.md has no frontmatter at all", async () => {
  const { root, cleanup } = scratch({
    "no-frontmatter/SKILL.md": "just a body, no --- block",
  });
  try {
    await assert.rejects(() => buildSkillIndex(root), /no YAML frontmatter/);
  } finally {
    cleanup();
  }
});
