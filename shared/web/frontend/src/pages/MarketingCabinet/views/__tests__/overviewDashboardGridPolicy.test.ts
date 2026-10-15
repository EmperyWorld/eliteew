import { describe, expect, it } from 'vitest';

import {
	RGL_COMPACT_TYPE,
	RGL_PREVENT_COLLISION,
} from '../overviewDashboardGridPolicy';

describe('overviewDashboardGridPolicy', () => {
	it('keeps free vertical placement (no vertical compact) so tiles can move/grow downward', () => {
		expect(RGL_COMPACT_TYPE).toBeNull();
		expect(RGL_PREVENT_COLLISION).toBe(false);
	});
});
