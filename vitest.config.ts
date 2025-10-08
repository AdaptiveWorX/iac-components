/**
 * Copyright (c) Adaptive Technology
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.unit.test.{js,ts}", "src/**/*.integration.test.{js,ts}"],
		exclude: ["node_modules", "dist", "build"],
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov", "html"],
			exclude: ["node_modules/", "dist/", "build/", "**/*.d.ts", "**/*.config.*"],
		},
	},
	esbuild: {
		target: "node22",
	},
});
