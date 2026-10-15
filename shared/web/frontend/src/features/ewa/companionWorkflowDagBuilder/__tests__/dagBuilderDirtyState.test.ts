import { describe, expect, it } from 'vitest';

import {
	createDagBuilderDirtySnapshot,
	isDagBuilderDirty,
} from '@/features/ewa/companionWorkflowDagBuilder/state/dagBuilderDirtyState';

describe('dagBuilderDirtyState', () => {
	it('detects name change as dirty', () => {
		const baseline = createDagBuilderDirtySnapshot({
			name: 'A',
			triggerPhrase: 'go',
			nodes: [],
			edges: [],
		});
		const current = createDagBuilderDirtySnapshot({
			name: 'B',
			triggerPhrase: 'go',
			nodes: [],
			edges: [],
		});
		expect(isDagBuilderDirty(current, baseline)).toBe(true);
	});

	it('returns clean when snapshot matches baseline', () => {
		const baseline = createDagBuilderDirtySnapshot({
			name: ' Chain ',
			triggerPhrase: ' phrase ',
			nodes: [],
			edges: [],
		});
		const current = createDagBuilderDirtySnapshot({
			name: 'Chain',
			triggerPhrase: 'phrase',
			nodes: [],
			edges: [],
		});
		expect(isDagBuilderDirty(current, baseline)).toBe(false);
	});
});
