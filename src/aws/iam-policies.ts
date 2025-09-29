/**
 * Copyright (c) Adaptive Technology
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Composable IAM policies for cross-account operations
 * TypeScript implementation providing least-privilege access for specific services
 */

import * as aws from "@pulumi/aws";
import type { ResourceOptions } from "@pulumi/pulumi";

type IamCondition = Record<string, string | string[] | Record<string, string | string[]>>;

export interface PolicyDocument {
  Version: string;
  Statement: Array<{
    Effect: "Allow" | "Deny";
    Action: string[];
    Resource: string | string[];
    Condition?: IamCondition;
  }>;
}

/**
 * Route53 DNS management policy for secops accounts
 */
export class Route53Policy {
  static getPolicyDocument(): PolicyDocument {
    return {
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Action: [
          "route53:ChangeResourceRecordSets",
          "route53:GetHostedZone",
          "route53:ListResourceRecordSets",
          "route53:GetHealthCheck",
          "route53:CreateHealthCheck",
          "route53:DeleteHealthCheck",
          "route53:UpdateHealthCheck"
        ],
        Resource: "*"
      }]
    };
  }
}

/**
 * Read ALB information for DNS updates and health checks
 */
export class ALBDescribePolicy {
  static getPolicyDocument(): PolicyDocument {
    return {
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Action: [
          "elasticloadbalancing:DescribeLoadBalancers",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:DescribeRules",
          "ec2:DescribeInstances",
          "ec2:DescribeNetworkInterfaces"
        ],
        Resource: "*"
      }]
    };
  }
}

/**
 * Read RDS database information for DNS updates
 */
export class RDSDescribePolicy {
  static getPolicyDocument(): PolicyDocument {
    return {
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Action: [
          "rds:DescribeDBInstances",
          "rds:DescribeDBClusters",
          "rds:ListTagsForResource",
          "rds:DescribeDBSubnetGroups"
        ],
        Resource: "*"
      }]
    };
  }
}

/**
 * Read EC2 instance information for DNS updates
 */
export class EC2DescribePolicy {
  static getPolicyDocument(): PolicyDocument {
    return {
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Action: [
          "ec2:DescribeInstances",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeVpcs",
          "ec2:DescribeSubnets"
        ],
        Resource: "*"
      }]
    };
  }
}

/**
 * Read CloudWatch metrics for health checks
 */
export class CloudWatchReadPolicy {
  static getPolicyDocument(): PolicyDocument {
    return {
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Action: [
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
          "cloudwatch:DescribeAlarms"
        ],
        Resource: "*"
      }]
    };
  }
}

/**
 * Read S3 bucket information for static website DNS
 */
export class S3ReadPolicy {
  static getPolicyDocument(): PolicyDocument {
    return {
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Action: [
          "s3:GetBucketLocation",
          "s3:GetBucketWebsite",
          "s3:ListBucket"
        ],
        Resource: "*"
      }]
    };
  }
}

/**
 * Read CloudFront distribution information for DNS
 */
export class CloudFrontDescribePolicy {
  static getPolicyDocument(): PolicyDocument {
    return {
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Action: [
          "cloudfront:GetDistribution",
          "cloudfront:ListDistributions",
          "cloudfront:GetDistributionConfig"
        ],
        Resource: "*"
      }]
    };
  }
}

/**
 * Read ACM certificate information for SSL validation
 */
export class ACMDescribePolicy {
  static getPolicyDocument(): PolicyDocument {
    return {
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Action: [
          "acm:ListCertificates",
          "acm:DescribeCertificate",
          "acm:GetCertificate"
        ],
        Resource: "*"
      }]
    };
  }
}

/**
 * Policy class interface for type safety
 */
/**
 * Utility class for attaching multiple policies to roles
 */
export class PolicyAttacher {
  /**
   * Attach multiple policies to a role
   */
  static attachPoliciesToRole(
    roleName: string,
    policies: (typeof Route53Policy)[],
    orgPrefix: string,
    environment: string,
    opts?: ResourceOptions
  ): aws.iam.RolePolicy[] {
    const attachedPolicies: aws.iam.RolePolicy[] = [];
    
    for (const policyCtor of policies) {
      const policyName = policyCtor.name.replace("Policy", "").toLowerCase();
      
      const rolePolicy = new aws.iam.RolePolicy(
        `${orgPrefix}-${policyName}-policy-${environment}`,
        {
          role: roleName,
          policy: JSON.stringify(policyCtor.getPolicyDocument())
        },
        opts
      );
      
      attachedPolicies.push(rolePolicy);
    }
    
    return attachedPolicies;
  }
}

/**
 * Pre-defined combinations of policies for common use cases
 */
export class PolicyCombinations {
  // ALB + DNS operations (most common)
  static readonly ALB_DNS = [Route53Policy, ALBDescribePolicy, EC2DescribePolicy];
  
  // RDS + DNS operations
  static readonly DATABASE_DNS = [Route53Policy, RDSDescribePolicy, EC2DescribePolicy];
  
  // Static website + DNS (S3/CloudFront)
  static readonly STATIC_WEBSITE_DNS = [
    Route53Policy, 
    S3ReadPolicy, 
    CloudFrontDescribePolicy, 
    ACMDescribePolicy
  ];
  
  // Health check monitoring
  static readonly HEALTH_CHECK_MONITORING = [
    Route53Policy, 
    CloudWatchReadPolicy, 
    ALBDescribePolicy
  ];
  
  // Full application stack (ALB + RDS + monitoring)
  static readonly FULL_APPLICATION_STACK = [
    Route53Policy,
    ALBDescribePolicy,
    RDSDescribePolicy,
    EC2DescribePolicy,
    CloudWatchReadPolicy
  ];
}

/**
 * Attach a pre-defined combination of policies to a role
 */
export function attachPolicyCombination(
  roleName: string,
  combinationName: keyof typeof PolicyCombinations,
  orgPrefix: string,
  environment: string,
  opts?: ResourceOptions
): aws.iam.RolePolicy[] {
  const combination = PolicyCombinations[combinationName] as Array<typeof Route53Policy>;

  return PolicyAttacher.attachPoliciesToRole(
    roleName,
    combination,
    orgPrefix,
    environment,
    opts
  );
}
