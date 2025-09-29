# @adaptiveworx/iac-components

Reusable Pulumi infrastructure components maintained by Adaptive Technology and published under the Apache 2.0 license. The library provides ready-to-use building blocks for common AWS identity, security, and automation scenarios so teams can focus on higher-level infrastructure design.

## Features

- **GitHub Actions OIDC bridge** – provisions multi-account OIDC providers and deployment roles with environment-specific trust policies.
- **Cross-account IAM roles** – creates Pulumi automation, foundation access, and health-check roles with vetted policies.
- **Policy helpers** – reusable IAM policy definitions and attachment utilities.
- **Shared naming & typing utilities** – consistent resource naming and strongly typed configuration primitives.

## Installation

```bash
npm install @adaptiveworx/iac-components
# or
yarn add @adaptiveworx/iac-components
# or
pnpm add @adaptiveworx/iac-components
```

The package targets Node.js 22+ and Pulumi 3.198.0+.

## Usage

```ts
import { GithubActionsOidc } from "@adaptiveworx/iac-components";

const oidc = new GithubActionsOidc("github-actions", {
  awsRegion: "us-east-1",
  githubOrg: "AdaptiveWorX",
  environments: [
    {
      name: "prod",
      accountId: "436083577402",
      roleName: "worx-prod-github-actions-deploy",
      policyArn: "arn:aws:iam::aws:policy/PowerUserAccess",
    },
  ],
});

export const roleArns = oidc.roleArns;
```

See [`src/aws`](./src/aws) for additional examples of the available components.

## Development

```bash
npm install
npm run build
```

Compiled artifacts are emitted to `dist/` and published automatically via the `prepare` hook when the package is installed from git.

## Contributing

We welcome pull requests that improve component coverage, documentation, or testing. Please open an issue to discuss substantial changes before submitting a PR. By contributing you agree that your contributions will be licensed under the Apache-2.0 License.

## License

Apache License 2.0 © Adaptive Technology. See [LICENSE](./LICENSE) for details.
