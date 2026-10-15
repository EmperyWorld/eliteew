/**
 * Verify baked APP_BUILD_ID in dist matches app-build-version.txt (same deploy id).
 * Fails if vite-plugin-build-version ran appBuildId.ts after Rollup (regression).
 */
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'dist-build');
const versionPath = path.join(outDir, 'app-build-version.txt');
const assetsDir = path.join(outDir, 'assets');

if (!fs.existsSync(versionPath)) {
	console.error('[verify-app-build-id] Missing dist-build/app-build-version.txt — run build first.');
	process.exit(1);
}

const deployId = fs.readFileSync(versionPath, 'utf8').trim();
if (!deployId) {
	console.error('[verify-app-build-id] app-build-version.txt is empty.');
	process.exit(1);
}

const generatedPath = path.join(rootDir, '.build-artifacts', 'appBuildId.ts');
const legacyGeneratedPath = path.join(rootDir, 'src', 'generated', 'appBuildId.ts');
const appBuildIdPath = fs.existsSync(generatedPath)
	? generatedPath
	: legacyGeneratedPath;
if (fs.existsSync(appBuildIdPath)) {
	const generated = fs.readFileSync(appBuildIdPath, 'utf8');
	if (!generated.includes(deployId)) {
		console.error(
			`[verify-app-build-id] ${path.relative(rootDir, appBuildIdPath)} does not match app-build-version.txt`,
		);
		console.error(`  txt:       ${deployId}`);
		process.exit(1);
	}
}

const jsChunks = fs
	.readdirSync(assetsDir)
	.filter((name) => name.endsWith('.js'));
const staleChunks = jsChunks.filter((name) => name.startsWith('staleBundleReload-'));

if (jsChunks.length === 0) {
	console.error('[verify-app-build-id] No JS chunks in dist-build/assets.');
	process.exit(1);
}

const chunksWithDeployId = [];
for (const chunk of jsChunks) {
	const body = fs.readFileSync(path.join(assetsDir, chunk), 'utf8');
	if (body.includes(deployId)) {
		chunksWithDeployId.push(chunk);
	}
}

if (chunksWithDeployId.length === 0) {
	console.error('[verify-app-build-id] No JS chunk contains app-build-version.txt deploy id.');
	process.exit(1);
}

if (staleChunks.length > 0 && !chunksWithDeployId.some((chunk) => staleChunks.includes(chunk))) {
	console.error('[verify-app-build-id] Bundle deploy id mismatch (staleBundleReload chunk).');
	console.error(`  txt:    ${deployId}`);
	console.error(`  chunks with id: ${chunksWithDeployId.join(', ')}`);
	console.error('  Fix: vite-plugin-build-version must write .build-artifacts/appBuildId.ts in buildStart.');
	process.exit(1);
}

console.log(`[verify-app-build-id] OK — ${deployId} (${chunksWithDeployId.length} JS chunk(s))`);
