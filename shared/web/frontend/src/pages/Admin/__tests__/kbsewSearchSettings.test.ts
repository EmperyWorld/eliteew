/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	KBSEW_CHUNKS_PER_BARREL_DEFAULT,
	clampChunksPerBarrel,
	countKbsewEnabledAgents,
	kbsewAgentToolVisible,
	mergeKbsewSettingsIntoDefaults,
	normalizeKbsewRetrievalMode,
	readKbsewSettingsFromDefaults,
} from '../kbsew/kbsewSearchSettings';

describe('kbsewSearchSettings', () => {
	it('defaults chunks_per_barrel to 5 and clamps 1–20', () => {
		expect(KBSEW_CHUNKS_PER_BARREL_DEFAULT).toBe(5);
		expect(clampChunksPerBarrel(undefined)).toBe(5);
		expect(clampChunksPerBarrel(null)).toBe(5);
		expect(clampChunksPerBarrel('')).toBe(5);
		expect(clampChunksPerBarrel(0)).toBe(1);
		expect(clampChunksPerBarrel(99)).toBe(20);
		expect(clampChunksPerBarrel(7)).toBe(7);
		const unset = readKbsewSettingsFromDefaults({});
		expect(unset.chunksPerBarrel).toBe(5);
	});

	it('reads agents block and legacy enabled desktop fallback', () => {
		const fromAgents = readKbsewSettingsFromDefaults({
			kbsew_search_settings: {
				agents: { desktop: false, ewa: true },
				allowed_barrels: ['da11ce9f-1d46-4747-8112-7210ebf9f6f2'],
			},
		});
		expect(fromAgents.agents.ewa).toBe(true);
		expect(fromAgents.agents.desktop).toBe(false);
		expect(fromAgents.retrievalMode).toBe('dense');

		const fromLegacy = readKbsewSettingsFromDefaults({
			kbsew_search_settings: {
				enabled: true,
				allowed_barrels: ['da11ce9f-1d46-4747-8112-7210ebf9f6f2'],
			},
		});
		expect(fromLegacy.agents.desktop).toBe(true);
	});

	it('reads and merges retrieval_mode dense|hybrid without dropping siblings', () => {
		const form = readKbsewSettingsFromDefaults({
			kbsew_search_settings: {
				agents: { desktop: true },
				allowed_barrels: ['da11ce9f-1d46-4747-8112-7210ebf9f6f2'],
				retrieval_mode: 'hybrid',
				future_flag: true,
			},
		});
		expect(form.retrievalMode).toBe('hybrid');
		form.retrievalMode = 'dense';
		const merged = mergeKbsewSettingsIntoDefaults(
			{
				kbsew_search_settings: {
					future_flag: true,
					agents: { desktop: true },
				},
			},
			form
		);
		const block = merged.kbsew_search_settings as {
			retrieval_mode: string;
			future_flag?: boolean;
			rerank_enabled: boolean;
		};
		expect(block.retrieval_mode).toBe('dense');
		expect(block.future_flag).toBe(true);
		expect(block.rerank_enabled).toBe(false);
	});

	it('normalizes unknown retrieval_mode to dense', () => {
		expect(normalizeKbsewRetrievalMode('HYBRID')).toBe('hybrid');
		expect(normalizeKbsewRetrievalMode('sparse')).toBe('dense');
		expect(normalizeKbsewRetrievalMode(null)).toBe('dense');
	});

	it('merges agents into defaults block', () => {
		const form = readKbsewSettingsFromDefaults({});
		form.agents.desktop = true;
		form.agents.ewa = true;
		form.allowedBarrelIds = ['da11ce9f-1d46-4747-8112-7210ebf9f6f2'];
		form.chunksPerBarrel = 8;
		form.rerankEnabled = true;
		form.retrievalMode = 'hybrid';
		const merged = mergeKbsewSettingsIntoDefaults({}, form);
		const block = merged.kbsew_search_settings as {
			enabled: boolean;
			agents: { desktop: boolean; ewa: boolean };
			allowed_barrels: string[];
			chunks_per_barrel: number;
			rerank_enabled: boolean;
			retrieval_mode: string;
		};
		expect(block.enabled).toBe(true);
		expect(block.agents.desktop).toBe(true);
		expect(block.agents.ewa).toBe(true);
		expect(block.allowed_barrels).toHaveLength(1);
		expect(block.chunks_per_barrel).toBe(8);
		expect(block.rerank_enabled).toBe(true);
		expect(block.retrieval_mode).toBe('hybrid');
	});

	it('tool visible per surface requires agent toggle and barrels', () => {
		const base = {
			agents: {
				desktop: true,
				ewa: false,
				marketing: false,
				imperorg: false,
				ugs: false,
			},
			allowedBarrelIds: ['da11ce9f-1d46-4747-8112-7210ebf9f6f2'],
			chunksPerBarrel: 5,
			rerankEnabled: false,
			retrievalMode: 'dense' as const,
		};
		expect(kbsewAgentToolVisible(base, 'desktop')).toBe(true);
		expect(kbsewAgentToolVisible(base, 'ewa')).toBe(false);
		expect(countKbsewEnabledAgents(base)).toBe(1);
	});
});
