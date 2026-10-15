import { describe, expect, it } from 'vitest';
import { ewrpZIndexClass } from './ewrpZIndex';

describe('ewrpZIndexClass', () => {
	it('exports stable class strings for layering', () => {
		expect(ewrpZIndexClass.overlayModal).toContain('z-');
		expect(ewrpZIndexClass.radixPortal).toContain('z-');
		expect(ewrpZIndexClass.ugsModalBackdrop).toContain('z-');
		expect(ewrpZIndexClass.pdfViewer).toContain('z-');
	});
});
