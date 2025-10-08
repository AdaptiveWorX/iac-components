# Testing Strategy

Adapted from [iac-worx testing-best-practices.md](https://github.com/AdaptiveWorX/iac-worx/blob/main/docs/testing-best-practices.md).

## Philosophy

Test **business logic and integration points**, not framework internals or trivial code.

## What TO Test ✅

1. **Component Behavior** - Resource configuration, conditional logic, validation
2. **Type Safety** - Ensure types prevent common mistakes
3. **Integration Contracts** - Components work together correctly
4. **Error Handling** - Graceful degradation, input validation
5. **Security Boundaries** - IAM policies, encryption, public access blocks

## What NOT to Test ❌

1. **Pulumi Internals** - Don't test Pulumi SDK behavior
2. **AWS SDK** - Don't test AWS resource behavior
3. **Language Features** - Don't test TypeScript/JavaScript basics
4. **Trivial Code** - Simple getters, constant assignments
5. **Self-Referential** - Testing constants equal themselves

## File Naming Conventions

- `*.unit.test.ts` - Unit tests with mocked dependencies
- `*.integration.test.ts` - Integration tests with real services (future)

## Test Organization

```
src/
├── aws/
│   ├── shared-vpc.ts
│   └── shared-vpc.unit.test.ts
├── azure/
│   └── ...
└── index.ts
```

## Parameterized Tests (Preferred)

Use `it.each` for multiple cases:

```typescript
// ✅ GOOD: One test, multiple cases
it.each([
  [1, "single NAT gateway"],
  [2, "dual NAT gateways"],
  [3, "tri-redundant NAT"],
])("should configure %d NAT gateway(s): %s", (count, description) => {
  // Test NAT gateway configuration logic
});
```

## Anti-Patterns

### ❌ DON'T: Test Pulumi SDK

```typescript
// ❌ BAD: Testing that Pulumi creates resources
it("should create a VPC", () => {
  const vpc = new aws.ec2.Vpc("test", {});
  expect(vpc).toBeDefined(); // Tests Pulumi, not our code
});
```

### ✅ DO: Test Component Logic

```typescript
// ✅ GOOD: Testing our component's logic
it("should calculate subnet CIDRs for 3-tier architecture", () => {
  const cidrs = calculateSubnetCidrs("10.0.0.0/16", 3, 6);
  expect(cidrs.public).toHaveLength(6);
  expect(cidrs.private).toHaveLength(6);
  expect(cidrs.data).toHaveLength(6);
});
```

## Running Tests

```bash
yarn test          # Run all tests
yarn test:watch    # Watch mode
yarn test:ui       # Interactive UI
```

## CI/CD

Tests run automatically on:
- Pull requests
- Merges to main
- Pre-publish (via `prepare` hook)

Failed tests block npm publishing.

## References

- [Vitest Documentation](https://vitest.dev/)
- [iac-worx Testing Practices](https://github.com/AdaptiveWorX/iac-worx/blob/main/docs/testing-best-practices.md)
