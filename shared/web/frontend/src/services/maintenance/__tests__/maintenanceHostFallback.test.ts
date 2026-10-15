/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guardrails for nginx host maintenance fallback HTML (502/503/504).
 *
 * Invariants:
 * - No product authorship footer; quotes rotate every 7s with visible author cite.
 *
 * Related:
 * - docker/host_conf/eliteew-maintenance.html
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MAINTENANCE_HTML = resolve(
	import.meta.dirname,
	'../../../../../../../docker/host_conf/eliteew-maintenance.html'
);

describe('eliteew-maintenance.html host fallback', () => {
	const html = readFileSync(MAINTENANCE_HTML, 'utf8');

	it('uses short copy without product footer', () => {
		expect(html).toContain(
			'Связь с сервером временно прервана. Окна и данные сохранены.'
		);
		expect(html).not.toContain('po&amp;T');
		expect(html).not.toContain('po&T && TZBrand');
		expect(html).not.toMatch(
			/Сервер временно недоступен\. Безраздельный мир восстановится автоматически, данные и раскладка сохранены\. Оставьте вкладку/
		);
	});

	it('rotates recovery quotes every 7 seconds with author cite', () => {
		expect(html).toContain('ROTATION_MS = 7000');
		expect(html).toContain('setInterval(renderQuote, ROTATION_MS)');
		expect(html).toContain('id="maintenance-quote-author"');
		expect(html).toContain('elite-quotes-inline.js');
	});
});
