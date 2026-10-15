import { describe, expect, it } from 'vitest';

import { createDocEditorGenerationController } from './docEditorEditGeneration';

describe('docEditorEditGeneration', () => {
	it('bump increments monotonically', () => {
		const gen = createDocEditorGenerationController();
		expect(gen.current).toBe(0);
		expect(gen.bump()).toBe(1);
		expect(gen.bump()).toBe(2);
		expect(gen.current).toBe(2);
	});

	it('isStale detects generation drift', () => {
		const gen = createDocEditorGenerationController();
		const captured = gen.bump();
		expect(gen.isStale(captured)).toBe(false);
		gen.bump();
		expect(gen.isStale(captured)).toBe(true);
	});

	it('reset clears generation for document switch', () => {
		const gen = createDocEditorGenerationController();
		gen.bump();
		gen.bump();
		expect(gen.reset(0)).toBe(0);
		expect(gen.current).toBe(0);
	});
});
