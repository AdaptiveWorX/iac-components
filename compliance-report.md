# Compliance Report

**Generated**: 10/8/2025, 2:04:02 PM

## Summary

| Metric | Value |
|--------|-------|
| Total Controls | 9 |
| Implemented Controls | 9 |
| Total Tests | 0 |
| Passing Tests | 0 |
| Critical Controls | 4 |
| High Controls | 6 |
| Medium Controls | 1 |
| Low Controls | 0 |
| Coverage | 100% |

## Frameworks

- ISO27001

## Controls

### ISO27001:A.13.1.1

**Name**: Network controls

**Coverage**: 50%

**Implementations**:
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:15](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L15)

### ISO27001:A.13.1.3

**Name**: Segregation of networks

**Coverage**: 50%

**Implementations**:
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:16](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L16)
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:951](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L951) - Severity: critical - Type: preventive
  - Risk: Data breach via public internet exposure
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:1032](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L1032) - Severity: high - Type: preventive
  - Risk: Data exfiltration via internet egress
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:1130](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L1130) - Severity: high - Type: preventive
  - Risk: Unauthorized cross-account access to network resources

### ISO27001:A.9.4.1

**Name**: Information access restriction

**Coverage**: 50%

**Implementations**:
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:17](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L17)
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:952](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L952) - Severity: critical - Type: preventive
  - Risk: Data breach via public internet exposure
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:1129](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L1129) - Severity: high - Type: preventive
  - Risk: Unauthorized cross-account access to network resources

### ISO27001:A.12.3.1

**Name**: Information backup

**Coverage**: 50%

**Implementations**:
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:915](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L915) - Severity: medium - Type: corrective
  - Risk: Data loss from accidental deletion or corruption

### ISO27001:A.10.1.1

**Name**: Policy on cryptographic controls

**Coverage**: 50%

**Implementations**:
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:969](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L969) - Severity: critical - Type: preventive
  - Risk: Data breach via unencrypted storage

### ISO27001:A.10.1.2

**Name**: Key management

**Coverage**: 50%

**Implementations**:
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:970](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L970) - Severity: critical - Type: preventive
  - Risk: Data breach via unencrypted storage

### ISO27001:A.12.4.1

**Name**: Event logging

**Coverage**: 50%

**Implementations**:
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:990](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L990) - Severity: high - Type: detective
  - Risk: Undetected network intrusions or data exfiltration

### ISO27001:A.12.4.3

**Name**: Administrator and operator logs

**Coverage**: 50%

**Implementations**:
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:991](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L991) - Severity: high - Type: detective
  - Risk: Undetected network intrusions or data exfiltration

### ISO27001:A.13.2.1

**Name**: Information transfer policies

**Coverage**: 50%

**Implementations**:
- [/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts:1033](/Users/lloyd/code/adaptive/iac-components/src/aws/shared-vpc.ts#L1033) - Severity: high - Type: preventive
  - Risk: Data exfiltration via internet egress

