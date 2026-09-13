/**
 * Discovers Agent Skills (SKILL.md-conformant directories) under a root and
 * builds the index this server answers `skills/list` / `skills/get` /
 * `resources/read` from — per SEP-2640 (Skills Extension).
 *
 * A skill is one immediate subdirectory of `root` containing a `SKILL.md` at
 * its own root (https://agentskills.io/specification). This server does not
 * yet support nested skills or `directoryRead` — every example skill here is
 * flat, and v1 only claims what it actually implements.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { parse as parseYaml } from "yaml";

export interface SkillResource {
  uri: string;
  digest: string;
  size: number;
}

export interface SkillEntry {
  uri: string;
  frontmatter: Record<string, unknown>;
  resources: SkillResource[];
}

export interface SkillFile {
  uri: string;
  absPath: string;
  digest: string;
  size: number;
  mimeType: string;
}

export interface SkillIndex {
  entries: SkillEntry[];
  entryByUri: Map<string, SkillEntry>;
  filesByUri: Map<string, SkillFile>;
}

const MIME_TYPES: Record<string, string> = {
  ".md": "text/markdown",
  ".py": "text/x-python",
  ".json": "application/json",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".txt": "text/plain",
};

function mimeTypeFor(path: string): string {
  return MIME_TYPES[extname(path)] ?? "application/octet-stream";
}

function digestOf(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** Every file under `dir`, as paths relative to `dir` using `/` separators. */
async function listFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const dirent of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      out.push(...(await listFilesRecursive(abs)).map((f) => join(dirent.name, f)));
    } else if (dirent.isFile()) {
      out.push(dirent.name);
    }
  }
  return out.map((f) => f.split(sep).join("/"));
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!match) {
    throw new Error("SKILL.md has no YAML frontmatter (expected a leading --- block)");
  }
  const parsed = parseYaml(match[1]);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("SKILL.md frontmatter must parse to a YAML mapping");
  }
  return parsed as Record<string, unknown>;
}

/**
 * Builds the skill index for every immediate subdirectory of `root` that
 * contains a `SKILL.md`. Directories under `root` without one are ignored
 * (not every subdirectory of a skills root need be a skill).
 *
 * Throws if a skill's frontmatter is missing `name`/`description`, or if
 * `name` doesn't match its directory name — both are real spec violations
 * for a skill this server controls, not something to silently paper over.
 */
export async function buildSkillIndex(root: string): Promise<SkillIndex> {
  const entries: SkillEntry[] = [];
  const entryByUri = new Map<string, SkillEntry>();
  const filesByUri = new Map<string, SkillFile>();

  for (const dirent of await readdir(root, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const skillName = dirent.name;
    const skillDir = join(root, skillName);
    const skillMdPath = join(skillDir, "SKILL.md");
    try {
      await stat(skillMdPath);
    } catch {
      continue; // not a skill directory
    }

    const relFiles = (await listFilesRecursive(skillDir)).sort();
    const resources: SkillResource[] = [];

    for (const relFile of relFiles) {
      const absPath = join(skillDir, relFile);
      const bytes = await readFile(absPath);
      const uri = `skill://${skillName}/${relFile}`;
      const digest = digestOf(bytes);
      const size = bytes.byteLength;
      resources.push({ uri, digest, size });
      filesByUri.set(uri, { uri, absPath, digest, size, mimeType: mimeTypeFor(relFile) });
    }

    const skillMdUri = `skill://${skillName}/SKILL.md`;
    const skillMdBytes = await readFile(skillMdPath, "utf8");
    const frontmatter = parseFrontmatter(skillMdBytes);

    if (typeof frontmatter.name !== "string" || frontmatter.name.length === 0) {
      throw new Error(`${relative(root, skillMdPath)}: frontmatter is missing required "name"`);
    }
    if (typeof frontmatter.description !== "string" || frontmatter.description.length === 0) {
      throw new Error(`${relative(root, skillMdPath)}: frontmatter is missing required "description"`);
    }
    if (frontmatter.name !== skillName) {
      throw new Error(
        `${relative(root, skillMdPath)}: frontmatter name "${frontmatter.name}" must match its directory name "${skillName}"`,
      );
    }

    const entry: SkillEntry = { uri: skillMdUri, frontmatter, resources };
    entries.push(entry);
    entryByUri.set(skillMdUri, entry);
  }

  return { entries, entryByUri, filesByUri };
}
