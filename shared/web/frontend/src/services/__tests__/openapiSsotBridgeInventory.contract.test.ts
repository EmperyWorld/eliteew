/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock: every regenerable lite OpenAPI pilot has ≥1 FE import path (thin bridge
 * or domain client). Prevents adoption theatre where pilots exist but nobody imports them.
 * Wave 7: program-domain `as unknown as` must stay empty (allowlist for regressions).
 *
 * Invariants:
 * - Paths are relative to `shared/web/frontend/src/`.
 * - Does not require hot-path clients to finish migration (Waves 1–6 Done); only that the
 *   bridge/importer exists and references `@/generated/<module>`.
 * - WAVE7_RESIDUAL_PROGRAM_CASTS stays empty unless a documented exception is re-opened.
 *
 * Related:
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption
 * - .cursor/rules/openapi-ssot-bridge.mdc
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(__dirname, '../..');

/**
 * Wave 7: intentional residual `as unknown as` inside SSOT program domain trees
 * (non-test). Cleared 2026-08-06 — keep empty; grow only with backlog note.
 */
const WAVE7_RESIDUAL_PROGRAM_CASTS: ReadonlyArray<{
	rel: string;
	reason: string;
}> = [];

/** Lite / required pilots → importer that must pull `@/generated/<module>`. */
const PILOT_BRIDGE_INVENTORY: ReadonlyArray<{
	generatedModule: string;
	importerRel: string;
}> = [
	{
		generatedModule: 'friends-openapi',
		importerRel: 'features/friends/api/friendsApi.ts',
	},
	{
		generatedModule: 'gaf-chat-openapi',
		importerRel: 'pages/Desktop/components/GAFChat/api/gafChatApi.ts',
	},
	{
		generatedModule: 'marketing-cabinet-openapi',
		importerRel:
			'pages/MarketingCabinet/marketingCabinetApi/marketingCabinetApiZod.ts',
	},
	{
		generatedModule: 'marketing-cabinet-rag-openapi',
		importerRel: 'services/api/marketingProjectRagApi.ts',
	},
	{
		generatedModule: 'content-openapi',
		importerRel: 'services/contentApi/types.ts',
	},
	{
		generatedModule: 'desktop-openapi',
		importerRel: 'pages/Desktop/services/desktopApi/types.ts',
	},
	{
		generatedModule: 'ugs-openapi',
		importerRel: 'services/api/ugs/schemas.ts',
	},
	{
		generatedModule: 'product-desktop-openapi',
		importerRel: 'pages/Desktop/services/productDesktopApi/news.ts',
	},
	{
		generatedModule: 'voice-gateway-openapi',
		importerRel: 'voice-core/api/sttClient.ts',
	},
	{
		generatedModule: 'doc-editor-v2-openapi',
		importerRel: 'services/documentEditorV2Api.ts',
	},
	{
		generatedModule: 'professional-worlds-openapi',
		importerRel:
			'features/professional-worlds/desktop/professionalWorldsOpenApi.ts',
	},
	{
		generatedModule: 'ewa-companion-admin-openapi',
		importerRel: 'features/ewa/admin/ewaCompanionAdminApi.ts',
	},
	{
		generatedModule: 'ewa-companion-chat-openapi',
		importerRel: 'services/ewa/ewaCompanionChatStreamApi.ts',
	},
	{
		generatedModule: 'ewa-desktop-orchestration-openapi',
		importerRel: 'services/ewa/ewaDesktopOrchestrationOpenApi.ts',
	},
	{ generatedModule: 'ewa-openapi', importerRel: 'services/ewa/ewaOpenApi.ts' },
	{
		generatedModule: 'music-forge-openapi',
		importerRel: 'services/musicForge/musicForgeOpenApi.ts',
	},
	{
		generatedModule: 'ebrowser-openapi',
		importerRel: 'features/ebrowser/ebrowserOpenApi.ts',
	},
	{
		generatedModule: 'kbsew-openapi',
		importerRel: 'pages/Admin/kbsewOpenApi.ts',
	},
	{
		generatedModule: 'projects-members-openapi',
		importerRel:
			'pages/MarketingCabinet/marketingCabinetApi/marketingCabinetApiCoreEntityTypes.ts',
	},
	{
		generatedModule: 'companies-projects-openapi',
		importerRel:
			'pages/MarketingCabinet/marketingCabinetApi/marketingCabinetOpenApi.ts',
	},
	{
		generatedModule: 'live-jobs-summary-openapi',
		importerRel:
			'pages/MarketingCabinet/marketingCabinetApi/marketingCabinetApiZod.ts',
	},
];

describe('openapi SSOT bridge inventory', () => {
	it('every required pilot has a FE importer referencing @/generated', () => {
		const failures: string[] = [];
		for (const row of PILOT_BRIDGE_INVENTORY) {
			const genPath = join(SRC_ROOT, 'generated', `${row.generatedModule}.ts`);
			const importerPath = join(SRC_ROOT, row.importerRel);
			if (!existsSync(genPath)) {
				failures.push(`missing generated: ${row.generatedModule}.ts`);
				continue;
			}
			if (!existsSync(importerPath)) {
				failures.push(`missing importer: ${row.importerRel}`);
				continue;
			}
			const text = readFileSync(importerPath, 'utf8');
			const aliasNeedle = `@/generated/${row.generatedModule}`;
			const relativeNeedle = `generated/${row.generatedModule}`;
			if (!text.includes(aliasNeedle) && !text.includes(relativeNeedle)) {
				failures.push(
					`${row.importerRel} must import '${aliasNeedle}' or relative '.../${relativeNeedle}' (pilot ${row.generatedModule})`
				);
			}
		}
		expect(failures, failures.join('\n')).toEqual([]);
	});

	it('thin MusicForge, EWA, and Marketing Cabinet bridges exist', () => {
		expect(
			existsSync(join(SRC_ROOT, 'services/musicForge/musicForgeOpenApi.ts'))
		).toBe(true);
		expect(existsSync(join(SRC_ROOT, 'services/ewa/ewaOpenApi.ts'))).toBe(true);
		expect(
			existsSync(
				join(
					SRC_ROOT,
					'pages/MarketingCabinet/marketingCabinetApi/marketingCabinetOpenApi.ts'
				)
			)
		).toBe(true);
	});

	it('Wave 7: program-domain residual as-unknown-as matches allowlist', () => {
		const hits: string[] = [];

		const walk = (dirRel: string) => {
			const abs = join(SRC_ROOT, dirRel);
			if (!existsSync(abs)) return;
			for (const name of readdirSync(abs)) {
				if (
					name === 'generated' ||
					name === '__tests__' ||
					name === 'node_modules'
				) {
					continue;
				}
				const childRel = `${dirRel}/${name}`;
				const childAbs = join(SRC_ROOT, childRel);
				const st = statSync(childAbs);
				if (st.isDirectory()) {
					walk(childRel);
					continue;
				}
				if (
					!(name.endsWith('.ts') || name.endsWith('.tsx')) ||
					name.endsWith('.test.ts') ||
					name.endsWith('.test.tsx') ||
					name.endsWith('.spec.ts') ||
					name.endsWith('.spec.tsx')
				) {
					continue;
				}
				const text = readFileSync(childAbs, 'utf8');
				if (/as unknown as/.test(text)) hits.push(childRel);
			}
		};

		for (const root of [
			'services/musicForge',
			'services/ewa',
			'features/ewa',
			'pages/Admin/musicForge',
			'pages/Desktop/services',
			'pages/MarketingCabinet/marketingCabinetApi',
			'services/api/ugs',
		]) {
			walk(root);
		}
		for (const file of [
			'pages/Admin/kbsewAdminApi.ts',
			'pages/Admin/kbsewOpenApi.ts',
		]) {
			const abs = join(SRC_ROOT, file);
			if (existsSync(abs) && /as unknown as/.test(readFileSync(abs, 'utf8'))) {
				hits.push(file);
			}
		}

		const allowed = new Set(WAVE7_RESIDUAL_PROGRAM_CASTS.map((r) => r.rel));
		const unexpected = hits.filter((h) => !allowed.has(h));
		const missing = [...allowed].filter((a) => !hits.includes(a));
		expect(
			unexpected,
			`new program-domain as-unknown-as (document or remove):\n${unexpected.join('\n')}`
		).toEqual([]);
		expect(
			missing,
			`allowlist entry missing cast (update WAVE7_RESIDUAL_PROGRAM_CASTS):\n${missing.join('\n')}`
		).toEqual([]);
		expect(WAVE7_RESIDUAL_PROGRAM_CASTS.every((r) => r.reason.length > 8)).toBe(
			true
		);
	});
});
