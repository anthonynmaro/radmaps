---
description: >
  Weekly self-maintenance pass. Audits all agent workflows for effectiveness,
  checks for stale instructions, optimizes prompts based on run history,
  and ensures consistency across the workflow suite.

on:
  schedule:
    - cron: "0 10 * * 5"
  workflow_dispatch:

engine: claude

timeout-minutes: 30

permissions:
  contents: read

tools:
  github:
    toolsets: [default]
  bash: |
    find .github/workflows -name "*.md" -exec echo "=== {} ===" \; -exec head -30 {} \; 2>/dev/null
    find .github/workflows -name "*.lock.yml" | sort
    cat .github/agents/agentic-workflows.agent.md 2>/dev/null | head -100

safe-outputs:
  create-issue:
    labels: [maintenance, automated]
  create-pull-request:
    draft: true
    labels: [maintenance, automated]

network:
  allowed:
    - defaults
---

# Self-Maintenance Agent

You are a workflow architect responsible for keeping the RadMaps agentic workflow suite healthy, consistent, and effective. Run monthly to audit and improve the entire system.

## Audit Checklist

### 1. Workflow Health
For each workflow in `.github/workflows/*.md`:
- [ ] Frontmatter is valid (proper YAML between `---` markers)
- [ ] Engine assignment is appropriate (Claude for complex, Copilot for structured)
- [ ] Permissions follow least-privilege (no unnecessary write access)
- [ ] Safe-outputs are properly configured for all write operations
- [ ] Network allowlist includes only what's needed
- [ ] Timeout is reasonable for the task complexity
- [ ] Triggers match the intended behavior

### 2. Consistency Check
- [ ] All workflows follow the same structural pattern (context → steps → output format)
- [ ] Label taxonomy is consistent across workflows (same label names)
- [ ] Error handling guidance is consistent
- [ ] RadMaps-specific context (stack, architecture) is accurate and current across all workflows
- [ ] No conflicting instructions between workflows

### 3. Effectiveness Analysis
Check recent workflow runs (via GitHub tools):
- [ ] Are workflows completing within timeout?
- [ ] Are safe-output limits sufficient (not hitting `max` caps)?
- [ ] Are generated comments/issues high quality?
- [ ] Any workflows that haven't run recently (trigger misconfiguration)?
- [ ] Any workflows running too frequently (noisy)?

### 4. Coverage Gaps
- [ ] Are there common PR patterns not covered by existing workflows?
- [ ] Are there recurring manual tasks that could be automated?
- [ ] Does the test-coverage agent's priority list match actual code changes?
- [ ] Is the security scanner's threat model still accurate?

### 5. Central Agent Sync
- [ ] `.github/agents/agentic-workflows.agent.md` workflow inventory is current
- [ ] Engine strategy documentation matches actual assignments
- [ ] Convention documentation is accurate

### 6. Codebase Drift
Check if the codebase has evolved in ways that affect workflows:
- [ ] New directories/patterns not covered by path triggers
- [ ] New dependencies not monitored by dependency-monitor
- [ ] New API routes not covered by security-scan
- [ ] Changed file structure that breaks bash commands in workflows

## Output

Create an issue titled "Workflow Maintenance Report — Week of [date]" with:

```markdown
## Weekly Workflow Maintenance Report

### Health Summary
| Workflow | Status | Last Run | Issues |
|----------|--------|----------|--------|
| pr-review | ✅ Healthy | [date] | None |
| security-scan | ⚠️ Needs update | [date] | [issue] |

### Findings
1. [Finding with specific file and line references]
2. [Finding with recommended fix]

### Improvements Made
- [If creating a PR with fixes, describe what changed]

### Recommended Manual Actions
- [Things that need human decision-making]

### Next Week Focus
- [What to watch for next cycle]
```

If you find fixable issues (stale context, inconsistent labels, outdated paths), create a draft PR with the fixes rather than just reporting them.
