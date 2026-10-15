import { describe, expect, it } from 'vitest';
import {
	ewrpPipelineActiveStepIndex,
	ewrpPipelineFailedStepIndex,
	ewrpPipelineMode,
} from './ewrpPipelineStatusStep';

describe('ewrpPipelineMode', () => {
	it('maps terminal and running states', () => {
		expect(ewrpPipelineMode('completed')).toBe('completed');
		expect(ewrpPipelineMode('failed')).toBe('failed');
		expect(ewrpPipelineMode('queued')).toBe('running');
		expect(ewrpPipelineMode('generating_content')).toBe('running');
		expect(ewrpPipelineMode('generating_images')).toBe('running');
		expect(ewrpPipelineMode('building_pdf')).toBe('running');
		expect(ewrpPipelineMode('')).toBe('idle');
		expect(ewrpPipelineMode(undefined)).toBe('idle');
	});
});

describe('ewrpPipelineActiveStepIndex', () => {
	it('maps each running status to 0…3', () => {
		expect(ewrpPipelineActiveStepIndex('queued')).toBe(0);
		expect(ewrpPipelineActiveStepIndex('generating_content')).toBe(1);
		expect(ewrpPipelineActiveStepIndex('generating_images')).toBe(2);
		expect(ewrpPipelineActiveStepIndex('building_pdf')).toBe(3);
	});
});

describe('ewrpPipelineFailedStepIndex', () => {
	it('maps progress bands to a step', () => {
		expect(ewrpPipelineFailedStepIndex(0)).toBe(0);
		expect(ewrpPipelineFailedStepIndex(17)).toBe(0);
		expect(ewrpPipelineFailedStepIndex(18)).toBe(1);
		expect(ewrpPipelineFailedStepIndex(44)).toBe(1);
		expect(ewrpPipelineFailedStepIndex(45)).toBe(2);
		expect(ewrpPipelineFailedStepIndex(77)).toBe(2);
		expect(ewrpPipelineFailedStepIndex(78)).toBe(3);
		expect(ewrpPipelineFailedStepIndex(100)).toBe(3);
	});
});
