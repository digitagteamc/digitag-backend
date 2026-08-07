# Git Workflow & Release Process

## Branching

`main` is always meant to be deployable. All work happens on short-lived branches off it, merged back via pull request — direct pushes to `main` are blocked by branch protection.

- `feature/<short-name>` — new functionality
- `fix/<short-name>` — bug fixes
- `hotfix/<short-name>` — same as `fix`, just signals "urgent, review fast"
- `incomplete` — work that's finished as code but deliberately not ready to merge yet (e.g. a backend change gated on a mobile release going live first). Lives here instead of as uncommitted local changes, so it's visible and can't be accidentally lost. Not a PR — nothing to review yet. When it's actually ready, branch a normal `feature`/`fix` off it (or just `git merge main` into it to catch up, then open the PR).

No `develop` branch, no release branches — `main` *is* the release line. A deploy is a deliberate, separate action (see below), not something that happens automatically on merge.

## Pull requests

- Open a PR from your branch into `main`.
- Needs at least 1 approval before it can merge (enforced by branch protection).
- If the PR fixes a tracked issue, reference it in the description (`Fixes #12`) so merging auto-closes it.

## Releases

- Bump the `version` field in `package.json` per release.
- Tag the release commit on `main`: `git tag v1.4.0 && git push --tags`.
- Add a line to `CHANGELOG.md` under a new version heading (move it out of `## Unreleased`).

This makes "what's actually running in production" always answerable (`git describe` on the server should match a real tag), and rollback means redeploying the previous tag instead of guessing at a commit hash.

## Deploying

Deploy is still manual — unchanged from `DEPLOYMENT.md`:

```bash
ssh <user>@<ec2-host>
cd /var/www/digitag-backend-main
git pull origin main
pm2 reload <app-name>
```

Deploy from a tagged commit on `main`, not an arbitrary branch tip.

## Bug/feature tracking

Every bug and feature idea gets a GitHub Issue instead of living only in chat — labeled `bug`, `feature`, or `internal-testing`. This is the searchable record of what shipped and why; commit messages and this changelog are the "what," issues are the "why it was asked for."
