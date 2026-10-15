/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock product Start channel preflight: W-transport gate on → SOCKS only.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { humanizeProductOpenFailure } from './productChannelPreflight';

const here = dirname(fileURLToPath(import.meta.url));
const clientSrc = join(here, '../..');

describe('productChannelPreflight', () => {
	it('humanizes opaque auth_policy_denied in Russian', () => {
		expect(
			humanizeProductOpenFailure(
				'auth_policy_denied',
				'Authentication could not be completed',
			),
		).toContain('Не удалось завершить вход');
		expect(
			humanizeProductOpenFailure(
				'auth_policy_denied',
				'Sign-in was cancelled or timed out',
			),
		).not.toMatch(/cancelled|Authentication/i);
	});

	it('Cloud and FoFline Start share channel preflight with recover', () => {
		const cloud = readFileSync(
			join(clientSrc, 'hooks/useCloudStart.ts'),
			'utf8'
		);
		const fofline = readFileSync(
			join(clientSrc, 'hooks/useFoflineStart.ts'),
			'utf8'
		);
		expect(cloud).toContain('assertProductChannelReadyWithRecover');
		expect(cloud).toContain('humanizeProductOpenFailure');
		expect(cloud).not.toContain('opened.url');
		expect(fofline).toContain('assertProductChannelReadyWithRecover');
		expect(fofline).not.toContain('wgStatus');
		expect(fofline).not.toMatch(/wTransportUp[\s\S]*wg\.unit_active/);
		const click = fofline.slice(fofline.indexOf('handleFoflineStartAttempt'));
		expect(click.indexOf('assertProductChannelReadyWithRecover')).toBeLessThan(
			click.indexOf('licensePreflight')
		);
	});

	it('userspace TunnelScreen disables SG skip continue', () => {
		const tunnel = readFileSync(
			join(clientSrc, 'features/tunnel/TunnelScreen.tsx'),
			'utf8'
		);
		expect(tunnel).toContain('(!userspace && allowSgSkip)');
		expect(tunnel).toContain('Пропуск канала недоступен');
	});
});
