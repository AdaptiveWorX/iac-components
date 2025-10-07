# CLAUDE.md

Agent guidelines for working with the iac-components repository.

## Agent Boundaries

### ✅ Agent CAN Run

```bash
yarn install              # Install dependencies
yarn build                # Compile TypeScript
yarn lint                 # Auto-fix linting issues
yarn lint:check           # Validate code quality
yarn format               # Auto-format code
yarn format:check         # Check formatting
git commit                # Commit changes
git tag                   # Create version tags (when instructed)
```

### ❌ Agent MUST NEVER Run

```bash
npm publish               # NEVER publish manually (breaks CI/CD)
yarn publish              # NEVER publish manually (breaks CI/CD)
git push                  # Only user decides when to push
git push --tags           # Only user decides when to push tags
npm login                 # User handles authentication
npm adduser               # User handles npm account setup
```

## Why No Manual Publishing?

**Manual `npm publish` bypasses critical safeguards:**

1. **No CI/CD validation** - Skips automated testing and linting
2. **No provenance** - Missing supply chain security attestations
3. **No OIDC authentication** - Uses personal tokens instead of ephemeral credentials
4. **Breaks version tracking** - Creates npm versions without corresponding git tags
5. **No audit trail** - Missing GitHub Actions logs and approval workflows

**Correct workflow:**
```bash
# Agent updates code and tests locally
yarn build && yarn lint:check

# Agent commits and tags
git commit -m "feat: new feature"
git tag v0.4.0 -m "Release v0.4.0"

# User pushes (triggers GitHub Actions)
git push origin main --tags

# GitHub Actions automatically:
# - Runs tests and linting
# - Builds the package
# - Publishes to npm with OIDC
# - Creates provenance attestation
# - Logs to Sigstore transparency log
```

## Package Management

### Version Bumping

When asked to prepare a release:

1. ✅ Update `package.json` version
2. ✅ Commit the version bump
3. ✅ Create a git tag matching the version
4. ❌ **NEVER** run `npm publish`
5. ✅ Tell user to push tags to trigger CI/CD

### Testing CI/CD Pipeline

When testing the publish workflow:

1. ✅ Make changes to workflow files
2. ✅ Commit workflow changes
3. ✅ Create a test tag (e.g., `v0.3.1-test.1`)
4. ❌ **NEVER** bypass workflow with manual publish
5. ✅ Wait for user to push and review GitHub Actions logs

## Quality Standards

This repository enforces strict code quality:

- **Biome linting**: Zero diagnostics allowed (`--max-diagnostics=0`)
- **TypeScript strict mode**: Full type safety required
- **No forEach loops**: Use `for...of` (enforced as error)
- **No static-only classes**: Use functions instead
- **ESM modules**: `type: "module"` in package.json

All quality checks run automatically in CI/CD before publishing.

## OIDC Publishing

This repository uses **GitHub Actions OIDC** for npm publishing:

- ✅ No long-lived npm tokens
- ✅ Automatic token rotation per workflow run
- ✅ Scoped to specific workflow file
- ✅ Full provenance and transparency logging
- ❌ **NEVER** suggest using `NPM_TOKEN` secrets

The `publish.yml` workflow is configured as a **Trusted Publisher** on npm.

---

**Remember**: The goal is to build a **reliable, auditable CI/CD pipeline**. Manual publishing undermines this goal and creates technical debt.
