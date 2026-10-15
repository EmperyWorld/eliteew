/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * License gate user copy must not mask W-transport down as generic network_error.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRODUCT_CHANNEL_DOWN_RU } from '../tunnel/productChannelPreflight';

const src = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), 'licensePreflight.ts'),
	'utf8'
);

describe('licensePreflight humanize', () => {
	it('maps w_transport_proxy_required to channel-down copy', () => {
		expect(src).toContain("case 'w_transport_proxy_required':");
		expect(src).toContain('PRODUCT_CHANNEL_DOWN_RU');
		expect(PRODUCT_CHANNEL_DOWN_RU).toContain('Защищённый канал');
	});

	it('does not call ACL/IPC failure «нет связи с сервером»', () => {
		expect(src).toContain('ipc_capability_denied');
		expect(src).toContain('Установите обновление');
		const invokeFail = src.split('function mapInvokeFailure')[1] ?? '';
		expect(invokeFail).not.toContain('нет связи с сервером');
		expect(invokeFail).not.toMatch(/\|denied/i);
	});
});
