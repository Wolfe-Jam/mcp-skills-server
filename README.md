# mcp-skills-server

Serves a directory of [Agent Skills](https://agentskills.io/specification) (`SKILL.md`) over MCP, per
[SEP-2640 "Skills Extension"](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640) —
`skills/list`, `skills/get`, and `skill://` resources with real SHA-256 digests.

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

That digest is the real SHA-256 of the actual file — a client can verify it, not just trust it.

`faf-context` is one real skill from [Wolfe-Jam/faf-skills](https://github.com/Wolfe-Jam/faf-skills), bundled
as this server's example content. There are six more alongside it — that's discovery (`skills/list` enumerates
whatever a server serves), not something this README needs to walk through one by one.

## Use

```bash
MCP_SKILLS_SERVER_ROOT=/path/to/your/skills npx mcp-skills-server
```

Point it at any directory whose immediate subdirectories are Agent Skills — this is not FAF-specific. Each
subdirectory needs a `SKILL.md` with `name` and `description` frontmatter, where `name` matches the directory
name. Without `MCP_SKILLS_SERVER_ROOT` set, it serves its own bundled examples.

## What it implements

- **`skills/list`** — enumerates every skill this server serves: URI, verbatim frontmatter, and a complete,
  digest-pinned manifest of its files.
- **`skills/get`** — retrieves one skill's entry by its `SKILL.md` URI (including skills absent from any listing).
- **`resources/read`** — reads any file within a skill, the standard MCP way.
- **`resources/list`** — every skill file as a plain resource too, for clients that aren't skills-extension-aware.

Not yet implemented: `resources/directory/read` (the `directoryRead` capability) — none of the bundled example
skills have subdirectories, so v1 doesn't claim it. Nested skills are similarly out of scope for now.

## Status

Early — a working, spec-conformant reference implementation, not yet published. See `CHANGELOG.md` once there's
a release.

## License

MIT
