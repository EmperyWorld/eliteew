/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * W6 source locks — Connection + About/contacts under Ещё.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.4–§5.6
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	connectionCopyLeaksInfra,
	connectionSignalFromPortalCode,
	connectionSignalHintRu,
	connectionSignalLabelRu,
	ELITEEW_SITE_URL,
	ELITEEW_SOURCE_CODE_URL,
	LICENSE_CONTACT_EMAIL,
	LICENSE_MAILTO_URL,
} from '../../../lib/launcher/journey';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const connection = join(root, 'features/hub/more/ConnectionPanel.tsx');
const about = join(root, 'features/hub/more/AboutContactsPanel.tsx');
const app = join(root, 'App.tsx');

describe('Journey W6 Connection + About (source)', () => {
	it('ConnectionPanel maps four levels without infra leaks', () => {
		const src = readFileSync(connection, 'utf8');
		expect(src).toContain('connectionSignalFromPortalCode');
		expect(src).toContain('Проверить соединение и лицензию');
		expect(src).toContain('Отключить защищённый канал');
		expect(src).toContain('connectionCopyLeaksInfra');
		expect(src).not.toMatch(/socks5?:\/\//i);
		expect(src).not.toMatch(/10\.77\.77/);
		expect(connectionSignalLabelRu('protected')).toBe('Защищено');
		expect(connectionSignalFromPortalCode('socks_listening')).toBe(
			'connecting'
		);
		expect(connectionCopyLeaksInfra(connectionSignalHintRu('protected'))).toBe(
			false
		);
	});

	it('AboutContactsPanel wires site, source code, and support mail', () => {
		const src = readFileSync(about, 'utf8');
		const appSrc = readFileSync(app, 'utf8');
		expect(src).toContain('Открыть сайт');
		expect(src).toContain('Исходный код');
		expect(src).toContain('Написать');
		expect(src).toContain('APP_VERSION');
		expect(src).toContain('Вернуть плавность');
		expect(src).toContain(LICENSE_CONTACT_EMAIL);
		expect(LICENSE_CONTACT_EMAIL).not.toMatch(/poet@/i);
		expect(ELITEEW_SITE_URL).toBe('https://eliteew.ru');
		expect(ELITEEW_SOURCE_CODE_URL).toBe(
			'https://github.com/EmperyWorld/eliteew'
		);
		expect(LICENSE_MAILTO_URL).toBe('mailto:license@eliteew.ru');
		expect(appSrc).toContain('onOpenSourceCode');
		expect(appSrc).toMatch(/["']source_code["']/);
		expect(appSrc).toContain('onOpenMailto');
		expect(appSrc).toMatch(/["']support_mail["']/);
	});
});
