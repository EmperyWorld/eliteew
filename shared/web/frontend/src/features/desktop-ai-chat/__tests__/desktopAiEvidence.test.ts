/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock the public evidence normalizer, derived-source semantics, and self-contained Markdown appendix.
 *
 * Invariants:
 * - Unsafe URLs and duplicate source records never reach the document surface.
 *
 * Related:
 * - src/features/desktop-ai-chat/desktopAiEvidence.ts
 */
import { describe, expect, it } from 'vitest';

import {
	appendDesktopAiEvidenceAppendix,
	formatDesktopAiQualityViolation,
	formatDesktopAiRequiredContextLabel,
	humanizeDesktopAiCitationMarkers,
	mergeDesktopAiEvidenceSources,
	normalizeDesktopAiContextSources,
	resolveDesktopAiArtifactQuality,
} from '../desktopAiEvidence';

const t = (key: string) => key;

describe('desktopAiEvidence', () => {
	it('normalizes public records and rejects unsafe or duplicate sources', () => {
		const sources = normalizeDesktopAiContextSources([
			{
				citation_id: 'p1',
				kind: 'project_document',
				authority: 'project_material',
				title: '  Project   research  ',
			},
			{
				citation_id: 'D1',
				kind: 'derived_ai_artifact',
				authority: 'derived',
				title: 'Earlier AI brief',
			},
			{
				citation_id: 'W1',
				kind: 'web',
				authority: 'external',
				title: 'Unsafe',
				url: 'https://user:pass@example.com/private',
			},
			{
				citation_id: 'P1',
				kind: 'project_document',
				title: 'Duplicate',
			},
			{ citation_id: 'raw-id', kind: 'project_document', title: 'Raw id' },
		]);

		expect(sources).toEqual([
			{
				citation_id: 'P1',
				kind: 'project_document',
				authority: 'project_material',
				title: 'Project research',
			},
			{
				citation_id: 'D1',
				kind: 'derived_ai_artifact',
				authority: 'derived',
				title: 'Earlier AI brief',
			},
		]);
	});

	it('humanizes citation markers when sources are known', () => {
		const out = humanizeDesktopAiCitationMarkers('Факт из 【D2】 и 【P1】.', [
			{
				citation_id: 'D2',
				kind: 'derived_ai_artifact',
				authority: 'derived',
				title: 'Brief v1',
			},
			{
				citation_id: 'P1',
				kind: 'project_document',
				authority: 'project_material',
				title: 'Research.pdf',
			},
		]);
		expect(out).toContain('«AI-материал: Brief v1»');
		expect(out).toContain('«документ проекта: Research.pdf»');
		expect(out).not.toContain('【D2】');
	});

	it('deduplicates persisted and live web evidence by safe URL', () => {
		const sources = mergeDesktopAiEvidenceSources(
			[
				{
					citation_id: 'W1',
					kind: 'web',
					authority: 'external',
					title: 'Primary',
					url: 'https://example.com/source',
				},
			],
			[
				{ url: 'https://example.com/source', title: 'Duplicate' },
				{ url: 'https://second.example/report', title: 'Second' },
				{ url: 'javascript:alert(1)', title: 'Unsafe' },
			]
		);

		expect(sources.map((source) => source.citation_id)).toEqual(['W1', 'W2']);
		expect(sources[1]?.url).toBe('https://second.example/report');
	});

	it('keeps finalization and grounding as independent trust axes', () => {
		expect(
			resolveDesktopAiArtifactQuality({
				status: 'repaired',
				grounding_status: 'derived_context',
				repair_attempted: true,
				repair_applied: true,
			})
		).toMatchObject({
			finalization: 'repaired',
			grounding: 'derived_context',
			repairAttempted: true,
			repairApplied: true,
		});
		expect(
			resolveDesktopAiArtifactQuality({ status: 'hypothesis_only' })
		).toMatchObject({
			finalization: 'unknown',
			grounding: 'hypothesis_only',
		});
	});

	it('adds a self-contained appendix and preserves derived lineage', () => {
		const output = appendDesktopAiEvidenceAppendix(
			'## Decision\n\nProceed carefully.',
			[
				{
					citation_id: 'D1',
					kind: 'derived_ai_artifact',
					authority: 'derived',
					title: 'Earlier AI brief',
				},
			],
			t as never
		);

		expect(output).toContain('## evidenceExportHeading');
		expect(output).toContain('【D1】');
		expect(output).toContain('evidenceKind.derived_ai_artifact');
		expect(output).not.toMatch(/\b(?:content_id|chunk_index|vault)\b/i);
	});

	it('humanizes Checks-tab required_context keys and violation codes', () => {
		expect(formatDesktopAiRequiredContextLabel('business_goal')).toBe(
			'Цель бизнеса'
		);
		expect(formatDesktopAiRequiredContextLabel('market_or_segment')).toBe(
			'Рынок / сегмент'
		);
		expect(formatDesktopAiQualityViolation('invented_brand:Ulov16')).toContain(
			'Ulov16'
		);
		expect(formatDesktopAiQualityViolation('ice_incomplete:30')).toContain(
			'I×C×E'
		);
		expect(
			formatDesktopAiQualityViolation('source_citation_missing')
		).toContain('【P1】');
		expect(
			formatDesktopAiRequiredContextLabel('target_surface_or_module')
		).toBe('Целевая поверхность / модуль');
		expect(
			formatDesktopAiQualityViolation('inventory_status_missing')
		).toContain('EXISTS');
		expect(formatDesktopAiQualityViolation('reinvents_existing')).toContain(
			'EXISTS'
		);
	});
});
