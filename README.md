# @adaptiveworx/iac-components

Reusable Pulumi infrastructure components shared across AdaptiveWorX IaC projects. The package is published privately and consumed as a local workspace dependency during development.

## Components

- `GithubActionsOidc` – provisions multi-account GitHub Actions OIDC providers and deployment roles.
- `CrossAccountIAMRoles` – defines product line cross-account IAM roles and supporting policies.
- `PolicyAttacher` and related policy classes – reusable IAM policy documents.
- Shared naming helpers and environment/type aliases for consistent resource naming.

## Development

```bash
npm install
npm run build
```

The package emits compiled artifacts to `dist/` and exposes them via the `files` field. The `prepare` script rebuilds automatically when installed from sibling repositories.

## Publishing

This repository is designed for local workspace usage. To publish, ensure the package version is bumped and the compiled `dist/` directory is present before tagging.
