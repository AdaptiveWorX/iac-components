/**
 * Shared VPC Component for Multi-Account AWS Architecture
 * Copyright (c) Adaptive Technology
 * SPDX-License-Identifier: Apache-2.0
 *
 * Provides centralized VPC infrastructure deployed in ops-sec account
 * and shared across workload accounts via AWS RAM.
 *
 * Architecture:
 * - Single unified component (not 3-layer)
 * - Logical organization: Foundation → Security → Operations → Sharing
 * - All resources deployed atomically in one stack
 * - Protected resources: VPC, subnets (prevent accidental deletion)
 */

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

/**
 * Configuration for SharedVpc component
 */
export interface SharedVpcArgs {
  /**
   * Environment this VPC serves (dev, stg, prd)
   * For centralized VPCs in sec account, this should be targetEnvironment
   */
  environment: string;

  /**
   * AWS region for deployment
   */
  region: string;

  /**
   * AWS account ID (used for bucket naming uniqueness)
   */
  accountId: string;

  /**
   * Organization prefix (e.g., "worx", "care")
   */
  orgPrefix: string;

  /**
   * VPC CIDR block (e.g., "10.224.0.0/16")
   */
  vpcCidr: string;

  /**
   * Availability zones to deploy across
   * Example: ["us-east-1a", "us-east-1b", "us-east-1c"]
   */
  availabilityZones: string[];

  /**
   * Number of NAT Gateways to deploy (0 = no NAT, use IPv6 egress)
   * - Dev: 0 (cost optimization)
   * - Stg: 2 (multi-AZ)
   * - Prd: 3+ (full HA)
   */
  natGatewayCount?: number;

  /**
   * Enable IPv6 dual-stack
   * Required if natGatewayCount = 0 (for IPv6 egress)
   */
  enableIpv6?: boolean;

  /**
   * Enable DNS hostnames in VPC
   */
  enableDnsHostnames?: boolean;

  /**
   * Enable DNS support in VPC
   */
  enableDnsSupport?: boolean;

  /**
   * VPC Flow Logs configuration
   */
  flowLogs: {
    /**
     * Enable flow logs (from Infisical FLOW_LOGS_ENABLED)
     */
    enabled: boolean;

    /**
     * Traffic type to log
     * - "ALL": All traffic
     * - "ACCEPT": Only accepted traffic
     * - "REJECT": Only rejected traffic (cheapest)
     */
    trafficType: "ALL" | "ACCEPT" | "REJECT";

    /**
     * S3 retention in days (from Infisical RETENTION_DAYS)
     */
    retentionDays?: number;
  };

  /**
   * AWS accounts to share subnets with via RAM
   * Map of account ID to account name
   * Example: { "413639306030": "worx-app-dev" }
   */
  sharedAccounts: { [accountId: string]: string };

  /**
   * VPC endpoints to create
   * Example: ["s3", "dynamodb", "ecr.api", "ecr.dkr"]
   */
  vpcEndpoints?: string[];

  /**
   * Resource tags
   */
  tags: Record<string, string>;
}

/**
 * Subnet CIDR allocation helper
 */
function calculateSubnetCidrs(
  vpcCidr: string,
  azCount: number
): {
  publicSubnets: string[];
  privateSubnets: string[];
  dataSubnets: string[];
} {
  // Extract base IP and prefix from VPC CIDR
  const parts = vpcCidr.split("/");
  if (parts.length !== 2 || parts[0] === undefined || parts[1] === undefined) {
    throw new Error(`Invalid CIDR block: ${vpcCidr}`);
  }

  const vpcPrefixNum = parseInt(parts[1], 10);

  // Subnet sizing: /22 per AZ per tier (1,024 IPs each)
  const subnetPrefix = 22;
  const subnetBits = subnetPrefix - vpcPrefixNum;

  const publicSubnets: string[] = [];
  const privateSubnets: string[] = [];
  const dataSubnets: string[] = [];

  // Calculate CIDRs using cidrsubnet logic
  for (let i = 0; i < azCount; i++) {
    // Public: 0-N
    publicSubnets.push(cidrSubnet(vpcCidr, subnetBits, i));
    // Private: N-2N
    privateSubnets.push(cidrSubnet(vpcCidr, subnetBits, azCount + i));
    // Data: 2N-3N
    dataSubnets.push(cidrSubnet(vpcCidr, subnetBits, 2 * azCount + i));
  }

  return { publicSubnets, privateSubnets, dataSubnets };
}

/**
 * Simple CIDR subnet calculation (mirrors Terraform cidrsubnet)
 */
function cidrSubnet(cidr: string, newbits: number, netnum: number): string {
  const parts = cidr.split("/");
  if (parts.length !== 2 || parts[0] === undefined || parts[1] === undefined) {
    throw new Error(`Invalid CIDR block: ${cidr}`);
  }

  const baseIp = parts[0];
  const prefix = parseInt(parts[1], 10);
  const newPrefix = prefix + newbits;

  // Convert base IP to 32-bit integer
  const ipParts = baseIp.split(".").map((p) => parseInt(p, 10));
  if (ipParts.length !== 4 || ipParts.some((p) => isNaN(p))) {
    throw new Error(`Invalid IP address: ${baseIp}`);
  }

  let baseNum =
    ((ipParts[0] ?? 0) << 24) |
    ((ipParts[1] ?? 0) << 16) |
    ((ipParts[2] ?? 0) << 8) |
    (ipParts[3] ?? 0);

  // Calculate subnet offset
  const shift = 32 - newPrefix;
  const subnetNum = netnum << shift;
  const resultNum = (baseNum | subnetNum) >>> 0;

  // Convert back to IP string
  const newIp = [
    (resultNum >>> 24) & 0xff,
    (resultNum >>> 16) & 0xff,
    (resultNum >>> 8) & 0xff,
    resultNum & 0xff,
  ].join(".");

  return `${newIp}/${newPrefix}`;
}

/**
 * SharedVpc Component
 *
 * Single unified component that creates:
 * - VPC with IPv4 (+ optional IPv6)
 * - Subnets across all AZs (public, private, data)
 * - Internet Gateway
 * - Optional NAT Gateways
 * - Route tables and associations
 * - VPC Flow Logs
 * - VPC Endpoints
 * - RAM Resource Share for cross-account access
 */
export class SharedVpc extends pulumi.ComponentResource {
  // Outputs
  public readonly vpcId: pulumi.Output<string>;
  public readonly vpcCidr: pulumi.Output<string>;
  public readonly vpcIpv6CidrBlock?: pulumi.Output<string>;
  public readonly publicSubnetIds: pulumi.Output<string[]>;
  public readonly privateSubnetIds: pulumi.Output<string[]>;
  public readonly dataSubnetIds: pulumi.Output<string[]>;
  public readonly internetGatewayId: pulumi.Output<string>;
  public readonly natGatewayIds: pulumi.Output<string[]>;
  public readonly ramShareArn: pulumi.Output<string>;
  public readonly flowLogsBucketArn?: pulumi.Output<string>;

  constructor(
    name: string,
    args: SharedVpcArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("adaptiveworx:aws:SharedVpc", name, {}, opts);

    const defaultOpts = { parent: this };
    const protectedOpts = { parent: this, protect: true };

    // ====================
    // FOUNDATION RESOURCES
    // ====================

    // VPC
    const vpc = new aws.ec2.Vpc(
      `${args.environment}-vpc`,
      {
        cidrBlock: args.vpcCidr,
        enableDnsHostnames: args.enableDnsHostnames ?? true,
        enableDnsSupport: args.enableDnsSupport ?? true,
        assignGeneratedIpv6CidrBlock: args.enableIpv6 ?? false,
        tags: {
          ...args.tags,
          Name: `${args.environment}-vpc`,
          Environment: args.environment,
        },
      },
      protectedOpts
    );

    this.vpcId = vpc.id;
    this.vpcCidr = vpc.cidrBlock;
    if (args.enableIpv6 === true) {
      this.vpcIpv6CidrBlock = vpc.ipv6CidrBlock;
    }

    // Internet Gateway
    const igw = new aws.ec2.InternetGateway(
      `${args.environment}-igw`,
      {
        vpcId: vpc.id,
        tags: {
          ...args.tags,
          Name: `${args.environment}-igw`,
          Environment: args.environment,
        },
      },
      defaultOpts
    );

    this.internetGatewayId = igw.id;

    // Calculate subnet CIDRs
    const subnetCidrs = calculateSubnetCidrs(
      args.vpcCidr,
      args.availabilityZones.length
    );

    // Create subnets
    const publicSubnets: aws.ec2.Subnet[] = [];
    const privateSubnets: aws.ec2.Subnet[] = [];
    const dataSubnets: aws.ec2.Subnet[] = [];

    args.availabilityZones.forEach((az, i) => {
      const azSuffix = az.slice(-1); // e.g., "a" from "us-east-1a"

      // Get CIDRs with explicit undefined checks
      const publicCidr = subnetCidrs.publicSubnets[i];
      const privateCidr = subnetCidrs.privateSubnets[i];
      const dataCidr = subnetCidrs.dataSubnets[i];

      if (publicCidr === undefined || privateCidr === undefined || dataCidr === undefined) {
        throw new Error(`Failed to calculate subnet CIDR for AZ index ${i}`);
      }

      // Public subnet
      const publicSubnet = new aws.ec2.Subnet(
        `${args.environment}-public-${azSuffix}`,
        {
          vpcId: vpc.id,
          cidrBlock: publicCidr,
          availabilityZone: az,
          mapPublicIpOnLaunch: true,
          tags: {
            ...args.tags,
            Name: `${args.environment}-public-${azSuffix}`,
            Environment: args.environment,
            Type: "public",
            Tier: "public",
            AZ: az,
          },
        },
        protectedOpts
      );
      publicSubnets.push(publicSubnet);

      // Private subnet
      const privateSubnet = new aws.ec2.Subnet(
        `${args.environment}-private-${azSuffix}`,
        {
          vpcId: vpc.id,
          cidrBlock: privateCidr,
          availabilityZone: az,
          mapPublicIpOnLaunch: false,
          tags: {
            ...args.tags,
            Name: `${args.environment}-private-${azSuffix}`,
            Environment: args.environment,
            Type: "private",
            Tier: "private",
            AZ: az,
          },
        },
        protectedOpts
      );
      privateSubnets.push(privateSubnet);

      // Data subnet
      const dataSubnet = new aws.ec2.Subnet(
        `${args.environment}-data-${azSuffix}`,
        {
          vpcId: vpc.id,
          cidrBlock: dataCidr,
          availabilityZone: az,
          mapPublicIpOnLaunch: false,
          tags: {
            ...args.tags,
            Name: `${args.environment}-data-${azSuffix}`,
            Environment: args.environment,
            Type: "data",
            Tier: "data",
            AZ: az,
          },
        },
        protectedOpts
      );
      dataSubnets.push(dataSubnet);
    });

    this.publicSubnetIds = pulumi.output(publicSubnets.map((s) => s.id));
    this.privateSubnetIds = pulumi.output(privateSubnets.map((s) => s.id));
    this.dataSubnetIds = pulumi.output(dataSubnets.map((s) => s.id));

    // NAT Gateways (if enabled)
    const natGateways: aws.ec2.NatGateway[] = [];
    const natGatewayCount = args.natGatewayCount ?? 0;

    if (natGatewayCount > 0) {
      for (let i = 0; i < Math.min(natGatewayCount, publicSubnets.length); i++) {
        const az = args.availabilityZones[i];
        const subnet = publicSubnets[i];

        if (az === undefined || subnet === undefined) {
          throw new Error(`Missing AZ or subnet for NAT Gateway index ${i}`);
        }

        const azSuffix = az.slice(-1);

        // Elastic IP for NAT Gateway
        const eip = new aws.ec2.Eip(
          `${args.environment}-nat-eip-${azSuffix}`,
          {
            domain: "vpc",
            tags: {
              ...args.tags,
              Name: `${args.environment}-nat-eip-${azSuffix}`,
              Environment: args.environment,
            },
          },
          defaultOpts
        );

        // NAT Gateway
        const natGw = new aws.ec2.NatGateway(
          `${args.environment}-nat-${azSuffix}`,
          {
            subnetId: subnet.id,
            allocationId: eip.id,
            tags: {
              ...args.tags,
              Name: `${args.environment}-nat-${azSuffix}`,
              Environment: args.environment,
            },
          },
          defaultOpts
        );
        natGateways.push(natGw);
      }
    }

    this.natGatewayIds = pulumi.output(natGateways.map((ng) => ng.id));

    // Route Tables
    // Public route table (one for all public subnets)
    const publicRt = new aws.ec2.RouteTable(
      `${args.environment}-public-rt`,
      {
        vpcId: vpc.id,
        tags: {
          ...args.tags,
          Name: `${args.environment}-public-rt`,
          Environment: args.environment,
          Type: "public",
        },
      },
      defaultOpts
    );

    // Public route to internet gateway
    new aws.ec2.Route(
      `${args.environment}-public-route-ipv4`,
      {
        routeTableId: publicRt.id,
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: igw.id,
      },
      defaultOpts
    );

    // IPv6 route if enabled
    if (args.enableIpv6 === true) {
      new aws.ec2.Route(
        `${args.environment}-public-route-ipv6`,
        {
          routeTableId: publicRt.id,
          destinationIpv6CidrBlock: "::/0",
          gatewayId: igw.id,
        },
        defaultOpts
      );
    }

    // Associate public subnets with public route table
    publicSubnets.forEach((subnet, i) => {
      const az = args.availabilityZones[i];
      if (az === undefined) {
        throw new Error(`Missing AZ for subnet index ${i}`);
      }
      const azSuffix = az.slice(-1);
      new aws.ec2.RouteTableAssociation(
        `${args.environment}-public-rta-${azSuffix}`,
        {
          subnetId: subnet.id,
          routeTableId: publicRt.id,
        },
        defaultOpts
      );
    });

    // Private/Data route tables (per AZ if NAT Gateways exist, otherwise shared)
    if (natGateways.length > 0) {
      // One route table per NAT Gateway for private subnets
      privateSubnets.forEach((subnet, i) => {
        const az = args.availabilityZones[i];
        if (az === undefined) {
          throw new Error(`Missing AZ for private subnet index ${i}`);
        }
        const azSuffix = az.slice(-1);
        const natIndex = Math.min(i, natGateways.length - 1);
        const natGw = natGateways[natIndex];
        if (natGw === undefined) {
          throw new Error(`Missing NAT Gateway at index ${natIndex}`);
        }

        const privateRt = new aws.ec2.RouteTable(
          `${args.environment}-private-rt-${azSuffix}`,
          {
            vpcId: vpc.id,
            tags: {
              ...args.tags,
              Name: `${args.environment}-private-rt-${azSuffix}`,
              Environment: args.environment,
              Type: "private",
            },
          },
          defaultOpts
        );

        // Route to NAT Gateway
        new aws.ec2.Route(
          `${args.environment}-private-route-${azSuffix}`,
          {
            routeTableId: privateRt.id,
            destinationCidrBlock: "0.0.0.0/0",
            natGatewayId: natGw.id,
          },
          defaultOpts
        );

        new aws.ec2.RouteTableAssociation(
          `${args.environment}-private-rta-${azSuffix}`,
          {
            subnetId: subnet.id,
            routeTableId: privateRt.id,
          },
          defaultOpts
        );
      });

      // Similar for data subnets
      dataSubnets.forEach((subnet, i) => {
        const az = args.availabilityZones[i];
        if (az === undefined) {
          throw new Error(`Missing AZ for data subnet index ${i}`);
        }
        const azSuffix = az.slice(-1);
        const natIndex = Math.min(i, natGateways.length - 1);
        const natGw = natGateways[natIndex];
        if (natGw === undefined) {
          throw new Error(`Missing NAT Gateway at index ${natIndex}`);
        }

        const dataRt = new aws.ec2.RouteTable(
          `${args.environment}-data-rt-${azSuffix}`,
          {
            vpcId: vpc.id,
            tags: {
              ...args.tags,
              Name: `${args.environment}-data-rt-${azSuffix}`,
              Environment: args.environment,
              Type: "data",
            },
          },
          defaultOpts
        );

        new aws.ec2.Route(
          `${args.environment}-data-route-${azSuffix}`,
          {
            routeTableId: dataRt.id,
            destinationCidrBlock: "0.0.0.0/0",
            natGatewayId: natGw.id,
          },
          defaultOpts
        );

        new aws.ec2.RouteTableAssociation(
          `${args.environment}-data-rta-${azSuffix}`,
          {
            subnetId: subnet.id,
            routeTableId: dataRt.id,
          },
          defaultOpts
        );
      });
    } else {
      // No NAT Gateways: shared route table with IPv6 egress only
      const sharedRt = new aws.ec2.RouteTable(
        `${args.environment}-shared-rt`,
        {
          vpcId: vpc.id,
          tags: {
            ...args.tags,
            Name: `${args.environment}-shared-rt`,
            Environment: args.environment,
            Type: "shared",
          },
        },
        defaultOpts
      );

      // IPv6 egress-only gateway if IPv6 is enabled
      if (args.enableIpv6 === true) {
        const eigw = new aws.ec2.EgressOnlyInternetGateway(
          `${args.environment}-eigw`,
          {
            vpcId: vpc.id,
            tags: {
              ...args.tags,
              Name: `${args.environment}-eigw`,
              Environment: args.environment,
            },
          },
          defaultOpts
        );

        new aws.ec2.Route(
          `${args.environment}-shared-route-ipv6`,
          {
            routeTableId: sharedRt.id,
            destinationIpv6CidrBlock: "::/0",
            egressOnlyGatewayId: eigw.id,
          },
          defaultOpts
        );
      }

      // Associate private and data subnets
      [...privateSubnets, ...dataSubnets].forEach((subnet, i) => {
        const az = args.availabilityZones[i % args.availabilityZones.length];
        if (az === undefined) {
          throw new Error(`Missing AZ for shared subnet index ${i}`);
        }
        const azSuffix = az.slice(-1);
        const tier = i < privateSubnets.length ? "private" : "data";
        new aws.ec2.RouteTableAssociation(
          `${args.environment}-${tier}-rta-${azSuffix}`,
          {
            subnetId: subnet.id,
            routeTableId: sharedRt.id,
          },
          defaultOpts
        );
      });
    }

    // ====================
    // OPERATIONS RESOURCES
    // ====================

    // S3 Bucket for VPC Flow Logs (conditionally created)
    let flowLogsBucket: aws.s3.BucketV2 | undefined;
    if (args.flowLogs.enabled) {
      flowLogsBucket = new aws.s3.BucketV2(
        `${args.environment}-flow-logs`,
        {
          bucket: `${args.orgPrefix}-flow-logs-${args.accountId}-${args.region}`,
          tags: {
            ...args.tags,
            Name: `${args.environment}-flow-logs`,
            Environment: args.environment,
            Purpose: "vpc-flow-logs",
          },
        },
        defaultOpts
      );

      // Enable versioning for flow logs bucket
      new aws.s3.BucketVersioningV2(
        `${args.environment}-flow-logs-versioning`,
        {
          bucket: flowLogsBucket.id,
          versioningConfiguration: {
            status: "Enabled",
          },
        },
        defaultOpts
      );

      // Lifecycle policy for flow logs retention
      if (args.flowLogs.retentionDays !== undefined) {
        new aws.s3.BucketLifecycleConfigurationV2(
          `${args.environment}-flow-logs-lifecycle`,
          {
            bucket: flowLogsBucket.id,
            rules: [
              {
                id: "expire-flow-logs",
                status: "Enabled",
                expiration: {
                  days: args.flowLogs.retentionDays,
                },
              },
            ],
          },
          defaultOpts
        );
      }

      // Block public access
      new aws.s3.BucketPublicAccessBlock(
        `${args.environment}-flow-logs-public-access`,
        {
          bucket: flowLogsBucket.id,
          blockPublicAcls: true,
          blockPublicPolicy: true,
          ignorePublicAcls: true,
          restrictPublicBuckets: true,
        },
        defaultOpts
      );

      // Enable default encryption
      new aws.s3.BucketServerSideEncryptionConfigurationV2(
        `${args.environment}-flow-logs-encryption`,
        {
          bucket: flowLogsBucket.id,
          rules: [
            {
              applyServerSideEncryptionByDefault: {
                sseAlgorithm: "AES256",
              },
            },
          ],
        },
        defaultOpts
      );

      // VPC Flow Logs to S3
      new aws.ec2.FlowLog(
        `${args.environment}-flow-logs`,
        {
          vpcId: vpc.id,
          logDestinationType: "s3",
          logDestination: pulumi.interpolate`arn:aws:s3:::${flowLogsBucket.bucket}/vpc-flow-logs/`,
          trafficType: args.flowLogs.trafficType,
          tags: {
            ...args.tags,
            Name: `${args.environment}-flow-logs`,
            Environment: args.environment,
          },
        },
        defaultOpts
      );

      // Assign flow logs bucket ARN to output
      this.flowLogsBucketArn = flowLogsBucket.arn;
    }

    // ====================
    // SHARING RESOURCES
    // ====================

    // RAM Resource Share for cross-account subnet sharing
    const ramShare = new aws.ram.ResourceShare(
      `${args.environment}-vpc-share`,
      {
        name: `${args.environment}-vpc-share`,
        allowExternalPrincipals: false,
        tags: {
          ...args.tags,
          Name: `${args.environment}-vpc-share`,
          Environment: args.environment,
        },
      },
      defaultOpts
    );

    this.ramShareArn = ramShare.arn;

    // Associate all subnets with RAM share
    const allSubnets = [...publicSubnets, ...privateSubnets, ...dataSubnets];
    allSubnets.forEach((subnet, i) => {
      new aws.ram.ResourceAssociation(
        `${args.environment}-ram-subnet-${i}`,
        {
          resourceArn: subnet.arn,
          resourceShareArn: ramShare.arn,
        },
        defaultOpts
      );
    });

    // Associate shared accounts
    Object.entries(args.sharedAccounts).forEach(([accountId, accountName]) => {
      new aws.ram.PrincipalAssociation(
        `${args.environment}-ram-${accountName}`,
        {
          principal: accountId,
          resourceShareArn: ramShare.arn,
        },
        defaultOpts
      );
    });

    this.registerOutputs({
      vpcId: this.vpcId,
      vpcCidr: this.vpcCidr,
      vpcIpv6CidrBlock: this.vpcIpv6CidrBlock,
      publicSubnetIds: this.publicSubnetIds,
      privateSubnetIds: this.privateSubnetIds,
      dataSubnetIds: this.dataSubnetIds,
      internetGatewayId: this.internetGatewayId,
      natGatewayIds: this.natGatewayIds,
      ramShareArn: this.ramShareArn,
      flowLogsBucketArn: this.flowLogsBucketArn,
    });
  }
}
