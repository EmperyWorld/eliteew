import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('UGSDesktopContainer window shell contract', () => {
	it('keeps UGS inside the desktop shell with an in-window tab toolbar', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../UGSDesktopContainer.tsx'), 'utf8');

		expect(src).toContain('DesktopAppContentWrapper');
		expect(src).toContain('admin-v2/UGSAdminV2Panel');
		expect(src).not.toContain('features/ugs/admin/UGSAdminPanel');
		expect(src).toContain('role="tablist"');
		expect(src).toContain("keyPrefix: 'ugsDesktop'");
		expect(src).toContain('workspaceOverline');
		expect(src).toContain('singleWindowBadge');
	});
});
