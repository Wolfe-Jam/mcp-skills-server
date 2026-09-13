# mcp-skills-server

Serves a directory of [Agent Skills](https://agentskills.io/specification) (`SKILL.md`) over MCP, per
[SEP-2640 "Skills Extension"](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640) —
`skills/list`, `skills/get`, and `skill://` resources with real SHA-256 digests.

My example is my own project, [FAF](https://github.com/Wolfe-Jam/faf-skills). Point this at yours instead —
it works on any skill.

## One skill, served

Point this at a directory and here's what a client gets back for a single skill (`skills/get`, real output):

```json
{
  "uri": "skill://faf-context/SKILL.md",
  "frontmatter": {
    "name": "faf-context",
    "description": "Get your project to 100% AI-readiness, fast...",
    "license": "MIT"
  },
  "resources": [
    {
      "uri": "skill://faf-context/SKILL.md",
      "digest": "sha256:5e68e7d871e02bf3f4e040ff6f904d447f52c818aa2325ccbc741fe3680dc1af",
      "size": 5513
    }
  ]
}
```

That digest is the real SHA-256 of the file. Run `shasum -a 256` on it yourself — it matches.

`faf-context` is one skill from FAF. Six more come with it. Swap them for yours:

```bash
MCP_SKILLS_SERVER_ROOT=/path/to/your/skills npx mcp-skills-server
```

Each immediate subdirectory of the root is a skill: a `SKILL.md` with `name` and `description` frontmatter,
`name` matching the directory name. That's the whole requirement.

## What it implements

- **`skills/list`** — enumerates every skill this server serves: URI, verbatim frontmatter, and a complete,
  digest-pinned manifest of its files.
- **`skills/get`** — retrieves one skill's entry by its `SKILL.md` URI (including skills absent from any listing).
- **`resources/read`** — reads any file within a skill, the standard MCP way.
- **`resources/list`** — every skill file as a plain resource too, for clients that aren't skills-extension-aware.

Not yet implemented: `resources/directory/read`, nested skills. None of the seven bundled skills have
subdirectories, so neither has been exercised yet.

## Status

Early. Working, spec-conformant, not yet published. `CHANGELOG.md` starts once there's a release.

## License

MIT
