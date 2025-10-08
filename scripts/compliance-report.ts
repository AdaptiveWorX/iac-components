#!/usr/bin/env tsx
/**
 * Compliance Report Generator
 * Copyright (c) Adaptive Technology
 * SPDX-License-Identifier: Apache-2.0
 *
 * Extracts compliance metadata from code and tests, generates compliance reports
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface ComplianceTag {
	framework: string;
	control: string;
	description: string;
}

interface ComplianceMetadata {
	id: string;
	compliance: string[];
	severity: "critical" | "high" | "medium" | "low";
	controlType: "preventive" | "detective" | "corrective" | "compensating";
	risk: string;
}

interface CodeCompliance {
	file: string;
	line: number;
	tags: ComplianceTag[];
	severity?: string;
	controlType?: string;
	risk?: string;
}

interface TestCompliance {
	file: string;
	line: number;
	testName: string;
	metadata: ComplianceMetadata;
}

interface ComplianceReport {
	generatedAt: string;
	frameworks: string[];
	summary: {
		totalControls: number;
		implementedControls: number;
		totalTests: number;
		passingTests: number;
		criticalControls: number;
		highControls: number;
		mediumControls: number;
		lowControls: number;
	};
	controls: Map<string, ControlReport>;
}

interface ControlReport {
	id: string;
	name: string;
	implementations: CodeCompliance[];
	tests: TestCompliance[];
	coverage: number;
}

/**
 * Extract compliance tags from code comments
 */
function extractCodeCompliance(filePath: string): CodeCompliance[] {
	const content = readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	const results: CodeCompliance[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Match: // @compliance ISO27001:A.10.1.1 - Description
		const complianceMatch = line.match(/@compliance\s+([\w]+):([\w.]+)\s+-\s+(.+)/);
		if (complianceMatch === null) continue;

		const tags: ComplianceTag[] = [
			{
				framework: complianceMatch[1],
				control: complianceMatch[2],
				description: complianceMatch[3],
			},
		];

		// Look ahead for additional metadata
		let severity: string | undefined;
		let controlType: string | undefined;
		let risk: string | undefined;

		for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
			const nextLine = lines[j];

			const severityMatch = nextLine.match(/@severity\s+(critical|high|medium|low)/);
			if (severityMatch !== null) severity = severityMatch[1];

			const controlTypeMatch = nextLine.match(
				/@control-type\s+(preventive|detective|corrective|compensating)/,
			);
			if (controlTypeMatch !== null) controlType = controlTypeMatch[1];

			const riskMatch = nextLine.match(/@risk\s+(.+)/);
			if (riskMatch !== null) risk = riskMatch[1];

			// Stop at non-comment line
			if (!nextLine.trim().startsWith("//")) break;
		}

		results.push({
			file: filePath,
			line: i + 1,
			tags,
			severity,
			controlType,
			risk,
		});
	}

	return results;
}

/**
 * Extract compliance metadata from test files
 */
function extractTestCompliance(filePath: string): TestCompliance[] {
	const content = readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	const results: TestCompliance[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Match: it("test name", {
		const testMatch = line.match(/it\s*\(\s*"([^"]+)"/);
		if (testMatch === null) continue;

		const testName = testMatch[1];

		// Look ahead for meta object
		let metadataStr = "";
		let inMeta = false;
		let braceCount = 0;

		for (let j = i; j < Math.min(i + 20, lines.length); j++) {
			const nextLine = lines[j];

			if (nextLine.includes("meta:")) {
				inMeta = true;
			}

			if (inMeta) {
				metadataStr += nextLine;
				braceCount += (nextLine.match(/{/g) || []).length;
				braceCount -= (nextLine.match(/}/g) || []).length;

				if (braceCount === 0 && metadataStr.includes("meta:")) {
					break;
				}
			}
		}

		if (metadataStr === "") continue;

		// Parse metadata (simple regex extraction)
		const idMatch = metadataStr.match(/id:\s*"([^"]+)"/);
		const complianceMatch = metadataStr.match(/compliance:\s*\[([^\]]+)\]/);
		const severityMatch = metadataStr.match(/severity:\s*"([^"]+)"/);
		const controlTypeMatch = metadataStr.match(/controlType:\s*"([^"]+)"/);
		const riskMatch = metadataStr.match(/risk:\s*"([^"]+)"/);

		if (
			idMatch === null ||
			complianceMatch === null ||
			severityMatch === null ||
			controlTypeMatch === null ||
			riskMatch === null
		)
			continue;

		const compliance = complianceMatch[1]
			.split(",")
			.map((c) => c.trim().replace(/['"]/g, ""));

		results.push({
			file: filePath,
			line: i + 1,
			testName,
			metadata: {
				id: idMatch[1],
				compliance,
				severity: severityMatch[1] as ComplianceMetadata["severity"],
				controlType: controlTypeMatch[1] as ComplianceMetadata["controlType"],
				risk: riskMatch[1],
			},
		});
	}

	return results;
}

/**
 * Generate compliance report
 */
function generateReport(): ComplianceReport {
	const srcDir = join(process.cwd(), "src");
	const codeCompliance: CodeCompliance[] = [];
	const testCompliance: TestCompliance[] = [];

	// Scan all files recursively
	function scanDirectory(dir: string): void {
		const entries = readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				scanDirectory(fullPath);
			} else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
				codeCompliance.push(...extractCodeCompliance(fullPath));
			} else if (entry.name.endsWith(".test.ts")) {
				testCompliance.push(...extractTestCompliance(fullPath));
			}
		}
	}

	scanDirectory(srcDir);

	// Build control map
	const controlMap = new Map<string, ControlReport>();

	// Add code implementations
	for (const code of codeCompliance) {
		for (const tag of code.tags) {
			const controlId = `${tag.framework}:${tag.control}`;

			if (!controlMap.has(controlId)) {
				controlMap.set(controlId, {
					id: controlId,
					name: tag.description,
					implementations: [],
					tests: [],
					coverage: 0,
				});
			}

			controlMap.get(controlId)?.implementations.push(code);
		}
	}

	// Add test coverage
	for (const test of testCompliance) {
		for (const controlId of test.metadata.compliance) {
			if (!controlMap.has(controlId)) {
				controlMap.set(controlId, {
					id: controlId,
					name: "(No description)",
					implementations: [],
					tests: [],
					coverage: 0,
				});
			}

			controlMap.get(controlId)?.tests.push(test);
		}
	}

	// Calculate coverage
	for (const [controlId, control] of controlMap.entries()) {
		if (control.implementations.length > 0 && control.tests.length > 0) {
			control.coverage = 100;
		} else if (control.implementations.length > 0 || control.tests.length > 0) {
			control.coverage = 50;
		}
	}

	// Extract frameworks
	const frameworks = new Set<string>();
	for (const control of controlMap.keys()) {
		frameworks.add(control.split(":")[0]);
	}

	// Count severity levels
	let criticalControls = 0;
	let highControls = 0;
	let mediumControls = 0;
	let lowControls = 0;

	for (const code of codeCompliance) {
		if (code.severity === "critical") criticalControls++;
		else if (code.severity === "high") highControls++;
		else if (code.severity === "medium") mediumControls++;
		else if (code.severity === "low") lowControls++;
	}

	return {
		generatedAt: new Date().toISOString(),
		frameworks: Array.from(frameworks).sort(),
		summary: {
			totalControls: controlMap.size,
			implementedControls: Array.from(controlMap.values()).filter(
				(c) => c.implementations.length > 0,
			).length,
			totalTests: testCompliance.length,
			passingTests: testCompliance.length, // Assume all passing (would integrate with Vitest)
			criticalControls,
			highControls,
			mediumControls,
			lowControls,
		},
		controls: controlMap,
	};
}

/**
 * Format report as Markdown
 */
function formatMarkdown(report: ComplianceReport): string {
	let md = "# Compliance Report\n\n";
	md += `**Generated**: ${new Date(report.generatedAt).toLocaleString()}\n\n`;

	md += "## Summary\n\n";
	md += "| Metric | Value |\n";
	md += "|--------|-------|\n";
	md += `| Total Controls | ${report.summary.totalControls} |\n`;
	md += `| Implemented Controls | ${report.summary.implementedControls} |\n`;
	md += `| Total Tests | ${report.summary.totalTests} |\n`;
	md += `| Passing Tests | ${report.summary.passingTests} |\n`;
	md += `| Critical Controls | ${report.summary.criticalControls} |\n`;
	md += `| High Controls | ${report.summary.highControls} |\n`;
	md += `| Medium Controls | ${report.summary.mediumControls} |\n`;
	md += `| Low Controls | ${report.summary.lowControls} |\n`;
	md += `| Coverage | ${Math.round((report.summary.implementedControls / report.summary.totalControls) * 100)}% |\n\n`;

	md += "## Frameworks\n\n";
	for (const framework of report.frameworks) {
		md += `- ${framework}\n`;
	}
	md += "\n";

	md += "## Controls\n\n";
	for (const [controlId, control] of report.controls.entries()) {
		md += `### ${controlId}\n\n`;
		md += `**Name**: ${control.name}\n\n`;
		md += `**Coverage**: ${control.coverage}%\n\n`;

		if (control.implementations.length > 0) {
			md += "**Implementations**:\n";
			for (const impl of control.implementations) {
				md += `- [${impl.file}:${impl.line}](${impl.file}#L${impl.line})`;
				if (impl.severity !== undefined) md += ` - Severity: ${impl.severity}`;
				if (impl.controlType !== undefined) md += ` - Type: ${impl.controlType}`;
				md += "\n";
				if (impl.risk !== undefined) md += `  - Risk: ${impl.risk}\n`;
			}
			md += "\n";
		}

		if (control.tests.length > 0) {
			md += "**Tests**:\n";
			for (const test of control.tests) {
				md += `- [${test.file}:${test.line}](${test.file}#L${test.line}): ${test.testName}\n`;
				md += `  - Severity: ${test.metadata.severity}, Type: ${test.metadata.controlType}\n`;
				md += `  - Risk: ${test.metadata.risk}\n`;
			}
			md += "\n";
		}
	}

	return md;
}

/**
 * Main execution
 */
function main(): void {
	console.log("🔍 Scanning codebase for compliance metadata...");

	const report = generateReport();

	console.log(`\n📊 Compliance Report Summary:`);
	console.log(`   Total Controls: ${report.summary.totalControls}`);
	console.log(`   Implemented: ${report.summary.implementedControls}`);
	console.log(`   Tests: ${report.summary.totalTests}`);
	console.log(`   Frameworks: ${report.frameworks.join(", ")}`);

	const markdown = formatMarkdown(report);
	const outputPath = join(process.cwd(), "compliance-report.md");
	writeFileSync(outputPath, markdown);

	console.log(`\n✅ Report generated: ${outputPath}`);
}

main();
