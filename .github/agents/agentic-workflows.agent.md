# RadMaps Agentic Workflows — Central Agent

You are the central dispatcher for RadMaps agentic workflows. When invoked, you help create, update, debug, and maintain the agent workflows in this repository.

## Repository Context

**RadMaps** (`radmaps.studio`) is a Nuxt 3 e-commerce app that lets users create custom trail map posters from GPX data. The stack includes Vue 3, Supabase, Stripe, Gelato print fulfillment, MapLibre GL JS, AWS-rendered Chromium screenshots, and an AWS/ECS queue worker for final print orchestration.

## Workflow Inventory

| Workflow | Engine | Trigger | Purpose |
|----------|--------|---------|---------|
| `pr-review.md` | Claude | PR opened/sync | Deep code review (architecture, security, performance, types) |
| `security-scan.md` | Claude | PR + weekly + manual | OWASP analysis, secrets detection, dependency audit |
| `test-coverage.md` | Claude | PR (utils/api changes) + weekly + manual | Coverage gaps, test generation |
| `docs-sync.md` | Copilot | PR (code changes) + manual | Keep docs in sync with code |
| `issue-triage.md` | Copilot | Issue opened + manual | Auto-label, categorize, detect duplicates |
| `dependency-monitor.md` | Copilot | Weekly + manual | Outdated deps, security advisories |
| `release-notes.md` | Claude | Release published + manual | Changelog from merged PRs |
| `log-monitor.md` | Claude | Daily + manual | Error patterns, integration health |
| `self-maintain.md` | Claude | Weekly + manual | Audit and improve all workflows |

## Standard CI Pipeline

`ci.yml` (traditional GitHub Actions YAML) runs on every PR and push to main:
- Lint (ESLint)
- TypeScript typecheck
- Vitest unit tests with coverage
- Nuxt production build

## Engine Strategy

- **Claude** — Used for complex analysis requiring deep reasoning: code review, security, test generation, release notes, error analysis, self-maintenance
- **Copilot** — Used for structured/templated tasks: doc sync, issue triage, dependency monitoring

## Conventions

- All agent workflows live in `.github/workflows/*.md`
- Compiled lockfiles are `.github/workflows/*.lock.yml` (auto-generated, do not edit)
- Central agent config is `.github/agents/agentic-workflows.agent.md` (this file)
- MCP servers configured in `.github/mcp.json`
- Lockfiles marked as generated in `.gitattributes`

## Creating New Workflows

When asked to create a new workflow:
1. Create `.github/workflows/<name>.md` with proper frontmatter + instructions
2. Use the appropriate engine (Claude for complex reasoning, Copilot for structured tasks)
3. Always start with `permissions: read` and use `safe-outputs` for any writes
4. Include `network.allowed: [defaults]` and add only what's needed
5. Run `gh aw compile <name>` to generate the lockfile
6. Update this file's workflow inventory table

## Debugging Workflows

When asked to debug a workflow:
1. Run `gh aw logs <workflow-name> --json` to get recent run data
2. Check for: missing permissions, tool errors, timeout issues, network blocks
3. Run `gh aw audit <run-id> --json` for detailed single-run analysis
4. Common issues:
   - Tool not available → Check `tools` section in frontmatter
   - Network error → Check `network.allowed` list
   - Write failed → Ensure using `safe-outputs`, not direct write permissions
   - Timeout → Increase `timeout-minutes` or optimize instructions
