# mcp-skills-server

Serves a directory of [Agent Skills](https://agentskills.io/specification) (`SKILL.md`) over MCP, per
[SEP-2640 "Skills Extension"](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640) —
`skills/list`, `skills/get`, and `skill://` resources with real SHA-256 digests.

Point it at any directory whose immediate subdirectories are Agent Skills. This is not FAF-specific — the
bundled `examples/skills/` are real skills from [Wolfe-Jam/faf-skills](https://github.com/Wolfe-Jam/faf-skills),
used as working example content, not a synthetic demo.

## What it implements

- **`skills/list`** — enumerates every skill this server serves: URI, verbatim frontmatter, and a complete,
  digest-pinned manifest of its files.
- **`skills/get`** — retrieves one skill's entry by its `SKILL.md` URI (including skills absent from any listing).
- **`resources/read`** — reads any file within a skill, the standard MCP way.
- **`resources/list`** — every skill file as a plain resource too, for clients that aren't skills-extension-aware.

Not yet implemented: `resources/directory/read` (the `directoryRead` capability) — none of the bundled example
skills have subdirectories, so v1 doesn't claim it. Nested skills are similarly out of scope for now.

## Use

```bash
MCP_SKILLS_SERVER_ROOT=/path/to/your/skills npx mcp-skills-server
```

Each immediate subdirectory of the root must contain a `SKILL.md` with `name` and `description` frontmatter,
where `name` matches the directory name. Without `MCP_SKILLS_SERVER_ROOT` set, it serves its own bundled
examples.

## Status

Early — a working, spec-conformant reference implementation, not yet published. See `CHANGELOG.md` once there's
a release.

## License

MIT
