#!/usr/bin/env node
/**
 * MIT-first gate for direct packages plus unresolved/nonfree transitive guard.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, '..');

const DIRECT_NON_MIT_EXCEPTIONS = [
	{
		id: '@fontsource/*',
		match: (name) => name.startsWith('@fontsource/'),
		reason: 'OFL font exception (bundled fonts).',
	},
	{
		id: 'playwright',
		match: (name) => name === 'playwright',
		reason: 'Dev-only E2E tooling.',
	},
	{
		id: 'typescript',
		match: (name) => name === 'typescript',
		reason: 'Dev-only compiler/type checker.',
	},
	{
		id: 'sharp',
		match: (name) => name === 'sharp',
		reason: 'Optional image optimizer tooling (enabled only via VITE_IMAGE_OPTIMIZER=true).',
	},
];

const TRANSITIVE_METADATA_RESOLUTIONS = new Map([
	[
		'khroma',
		{
			versions: new Set(['2.1.0']),
			license: 'MIT',
			evidence:
				'https://github.com/fabiospampinato/khroma/blob/v2.1.0/license',
		},
	],
]);

const WORKSPACE_PACKAGE_MANIFESTS = new Map([
	[
		'@eliteew/kernel-offline-policy',
		join(frontendRoot, '../../packages/kernel-offline-policy/package.json'),
	],
]);

const HAS_MIT_BRANCH = /\bMIT\b/i;
const NONFREE_OR_UNRESOLVED_LICENSE =
	/\b(?:proprietary|unlicensed)\b|standard ['"]?no charge/i;

function packageVersions(pkg) {
	return Array.isArray(pkg?.versions)
		? pkg.versions.filter((version) => typeof version === 'string')
		: [];
}

function readDirectPackages() {
	const raw = readFileSync(join(frontendRoot, 'package.json'), 'utf8');
	const pkg = JSON.parse(raw);
	const direct = new Map();
	for (const name of Object.keys(pkg.dependencies ?? {})) {
		direct.set(name, 'dependency');
	}
	for (const name of Object.keys(pkg.devDependencies ?? {})) {
		direct.set(name, 'devDependency');
	}
	return direct;
}

function exceptionForPackage(name) {
	return DIRECT_NON_MIT_EXCEPTIONS.find((item) => item.match(name)) ?? null;
}

function main() {
	const directPackages = readDirectPackages();
	const directNames = new Set(directPackages.keys());

	let licensesRaw;
	try {
		licensesRaw = execSync('pnpm licenses list --json', {
			cwd: frontendRoot,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			maxBuffer: 64 * 1024 * 1024,
		});
	} catch (e) {
		console.error('licenses:check: failed to run `pnpm licenses list --json`', e);
		process.exit(2);
	}

	let data;
	try {
		data = JSON.parse(licensesRaw);
	} catch {
		console.error('licenses:check: could not parse JSON output');
		process.exit(2);
	}

	const directLicenseBuckets = new Map();
	for (const [bucket, packages] of Object.entries(data)) {
		if (!Array.isArray(packages)) continue;
		for (const pkg of packages) {
			const name =
				pkg &&
				typeof pkg === 'object' &&
				'name' in pkg &&
				typeof pkg.name === 'string'
					? pkg.name
					: null;
			if (!name || !directNames.has(name)) continue;
			const buckets = directLicenseBuckets.get(name) ?? new Set();
			buckets.add(bucket);
			directLicenseBuckets.set(name, buckets);
		}
	}
	for (const [name, manifestPath] of WORKSPACE_PACKAGE_MANIFESTS.entries()) {
		if (!directNames.has(name) || directLicenseBuckets.has(name)) continue;
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		if (typeof manifest.license === 'string' && manifest.license.trim()) {
			directLicenseBuckets.set(name, new Set([manifest.license.trim()]));
		}
	}

	const violations = [];
	const exceptionsUsed = [];
	for (const [name, kind] of directPackages.entries()) {
		const buckets = directLicenseBuckets.get(name);
		if (!buckets || buckets.size === 0) {
			violations.push({
				name,
				kind,
				buckets: ['missing license metadata'],
			});
			continue;
		}

		const hasMitBranch = [...buckets].some((bucket) => HAS_MIT_BRANCH.test(bucket));
		if (hasMitBranch) continue;

		const exception = exceptionForPackage(name);
		if (exception) {
			exceptionsUsed.push({
				name,
				kind,
				buckets: [...buckets].sort(),
				exceptionId: exception.id,
				reason: exception.reason,
			});
			continue;
		}

		violations.push({
			name,
			kind,
			buckets: [...buckets].sort(),
		});
	}

	const resolvedMetadataGaps = [];
	const transitiveViolations = [];
	for (const [bucket, packages] of Object.entries(data)) {
		if (!Array.isArray(packages)) continue;
		for (const pkg of packages) {
			const name = typeof pkg?.name === 'string' ? pkg.name : null;
			if (!name) continue;
			if (bucket.toLowerCase() === 'unknown') {
				const resolution = TRANSITIVE_METADATA_RESOLUTIONS.get(name);
				const versions = packageVersions(pkg);
				const versionsMatch =
					resolution &&
					versions.length > 0 &&
					versions.every((version) => resolution.versions.has(version));
				if (resolution && versionsMatch) {
					resolvedMetadataGaps.push({
						name,
						versions,
						license: resolution.license,
						evidence: resolution.evidence,
					});
					continue;
				}
				transitiveViolations.push({
					name,
					versions,
					bucket,
					reason: 'unknown license has no exact-version evidence resolution',
				});
				continue;
			}
			if (NONFREE_OR_UNRESOLVED_LICENSE.test(bucket)) {
				transitiveViolations.push({
					name,
					versions: packageVersions(pkg),
					bucket,
					reason: 'nonfree or unresolved license in the bundled dependency graph',
				});
			}
		}
	}

	if (violations.length > 0) {
		console.error('licenses:check: MIT-first gate failed for direct packages:');
		for (const violation of violations) {
			console.error(
				`- ${violation.name} [${violation.kind}] SPDX: ${violation.buckets.join(' OR ')} | action: remove/replace package or add explicit non-MIT exception with reason`
			);
		}
		process.exit(1);
	}

	if (transitiveViolations.length > 0) {
		console.error(
			'licenses:check: unresolved/nonfree transitive dependency licenses:'
		);
		for (const violation of transitiveViolations) {
			console.error(
				`- ${violation.name}@${violation.versions.join(',') || '?'} SPDX: ${violation.bucket} | ${violation.reason}`
			);
		}
		process.exit(1);
	}

	if (exceptionsUsed.length > 0) {
		console.log('licenses:check: non-MIT exceptions in use:');
		for (const item of exceptionsUsed.sort((a, b) => a.name.localeCompare(b.name))) {
			console.log(
				`- ${item.name} [${item.kind}] SPDX: ${item.buckets.join(' OR ')} | exception: ${item.exceptionId} | ${item.reason}`
			);
		}
	}

	if (resolvedMetadataGaps.length > 0) {
		console.log('licenses:check: verified transitive metadata resolutions:');
		for (const item of resolvedMetadataGaps) {
			console.log(
				`- ${item.name}@${item.versions.join(',')} → ${item.license} | ${item.evidence}`
			);
		}
	}

	console.log(
		'licenses:check: OK (direct policy and transitive unresolved/nonfree guard satisfied)'
	);
}

main();
