# Constraints

The quality bar of optikit. Each line is a number and a command, so a machine checks it. The approach comes from the `constraint-driven-development` skill in [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT).

## Always

- [ ] No new suppressions: `@ts-ignore`, `@ts-expect-error` without a reason, `eslint-disable`
- [ ] No stubs: `throw new Error("Not implemented")`, an empty `catch {}`
- [ ] No test skipped or removed without a reason in the commit message
- [ ] No secrets in the source
- [ ] **This file is not weakened to let a change pass.** A threshold is lowered by a decision of its own, with the reason written down

## Blocks a change

| What | Threshold | Checked by | When |
| --- | --- | --- | --- |
| Types | no errors | `tsc --noEmit` | every change |
| Lint | no errors | `eslint .` | every change |
| Secrets | nothing found | `gitleaks detect --redact --no-banner` | every change |
| Tests | all green | `npm test` | end of a task |
| Vulnerabilities in runtime dependencies | no high or critical | `npm audit --omit=dev --audit-level=high` | before a release |
| Build | passes, no tests in `dist/` | `npm run build` | before a release |

`--redact` is required: a secret that gitleaks finds must not land in a log or in a chat with an agent.

## Measured, does not block

| Metric | Value (25 Nov 2026) | Direction |
| --- | --- | --- |
| Tests | 251 | does not go down |
| Package size (`npm pack --dry-run`) | 73.9 kB | does not grow without a new command |
| Runtime dependencies | 7 | does not grow without a reason |

## Exceptions

Each one has an end date. None now.
