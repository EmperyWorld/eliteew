/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * On production build: deploy id in `.build-artifacts/appBuildId.ts` (gitignored) and
 * on disk (`dist-build/app-build-version.txt`, `dist-build/meta.json`).
 *
 * Invariants:
 * - `.build-artifacts/appBuildId.ts` is written in `buildStart` (before Rollup bundles JS).
 * - `src/generated/appBuildId.ts` stays a committed dev placeholder (`dev-local`).
 * - Never writes `public/meta.json` (avoids dirty tracked tree after build).
 *
 * Related:
 * - src/utils/staleBundleReload.ts
 * - scripts/generate-meta.js (dev placeholder only)
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

interface PackageJson {
	version?: string;
}

function writeAppBuildId(root: string, deployId: string): void {
	const artifactsDir = path.join(root, '.build-artifacts');
	fs.mkdirSync(artifactsDir, { recursive: true });
	fs.writeFileSync(
		path.join(artifactsDir, 'appBuildId.ts'),
		`/** Auto-generated on production build — do not edit. */\nexport const APP_BUILD_ID = ${JSON.stringify(deployId)};\n`,
		'utf8'
	);
}

/**
 * Writes app-build-version.txt and meta.json on each production build.
 * Used by startDeployVersionWatcher() and static /meta.json consumers.
 */
export function buildVersionFilePlugin(): Plugin {
	let outDir = 'dist-build';
	let root = process.cwd();
	let deployId: string | null = null;
	let finalizedDeployId: string | null = null;

	return {
		name: 'eliteew-build-version-file',
		apply: 'build',
		enforce: 'pre',
		config(config) {
			root = config.root ?? process.cwd();
			if (deployId === null) {
				deployId = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
			}
			writeAppBuildId(root, deployId);
		},
		resolveId(source) {
			const normalized = source.replace(/\.ts$/, '');
			if (
				normalized.endsWith('generated/appBuildId') ||
				normalized.endsWith('/generated/appBuildId')
			) {
				return path.join(
					root || process.cwd(),
					'.build-artifacts/appBuildId.ts'
				);
			}
			return null;
		},
		configResolved(config) {
			outDir = config.build.outDir;
			root = config.root;
			deployId = finalizedDeployId;
		},
		buildStart() {
			if (finalizedDeployId) {
				deployId = finalizedDeployId;
				writeAppBuildId(root, finalizedDeployId);
				return;
			}
			if (deployId !== null) {
				return;
			}
			deployId = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
			writeAppBuildId(root, deployId);
		},
		closeBundle() {
			if (!deployId) {
				return;
			}

			// Keep generated ts aligned with txt when Rollup invokes buildStart more than once
			// (e.g. multi-input: index.html + mobile-app/index.html).
			finalizedDeployId = deployId;
			writeAppBuildId(root, deployId);

			const pkgPath = path.join(root, 'package.json');
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as PackageJson;
			const version = pkg.version ?? '0.0.0';
			const buildHash = createHash('sha256')
				.update(deployId)
				.digest('hex')
				.slice(0, 8);

			// Public meta: version + deploy-derived hash only (no buildTime / environment).
			const meta = { version, buildHash };
			const metaJson = `${JSON.stringify(meta, null, 2)}\n`;

			const resolvedOutDir = path.isAbsolute(outDir)
				? outDir
				: path.resolve(root, outDir);
			fs.mkdirSync(resolvedOutDir, { recursive: true });
			fs.writeFileSync(
				path.join(resolvedOutDir, 'app-build-version.txt'),
				`${deployId}\n`,
				'utf8'
			);
			fs.writeFileSync(
				path.join(resolvedOutDir, 'meta.json'),
				metaJson,
				'utf8'
			);
		},
	};
}
