/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Continuity W2 locks: SPA persistence copy ≠ Keycloak Remember Me.
 *
 * Invariants:
 * - desktopUi/desktopChrome loginFallback copy stays honest.
 * - eliteew Keycloak theme messages own the 14-day SSO wording.
 *
 * Related:
 * - `webSsoRememberMeHonesty.ts`
 * - `documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md` §W2
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	evaluateIdpRememberMeCopyHonesty,
	evaluateSpaPersistenceCopyHonesty,
} from '../webSsoRememberMeHonesty';
import { resolveTokenPersistence } from '../../keycloakTokenStorage';

const here = dirname(fileURLToPath(import.meta.url));
// __tests__ → auth → services → src → frontend → web → shared → repo root
const repoRoot = join(here, '../../../../../../../');

function readJson(rel: string): {
	loginFallback: { rememberMe: string; rememberMeHint: string };
} {
	return JSON.parse(readFileSync(join(repoRoot, rel), 'utf8')) as {
		loginFallback: { rememberMe: string; rememberMeHint: string };
	};
}

function readTheme(rel: string): Record<string, string> {
	const text = readFileSync(join(repoRoot, rel), 'utf8');
	const out: Record<string, string> = {};
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq <= 0) continue;
		out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
	}
	return out;
}

describe('Continuity W2 Remember Me honesty', () => {
	it('SPA desktopUi copy is persistence-only and points at Keycloak', () => {
		for (const rel of [
			'shared/web/frontend/src/i18n/locales/ru/desktopUi.json',
			'shared/web/frontend/src/i18n/locales/en/desktopUi.json',
			'shared/web/frontend/src/i18n/locales/ru/desktopChrome.json',
			'shared/web/frontend/src/i18n/locales/en/desktopChrome.json',
		]) {
			const { loginFallback } = readJson(rel);
			const result = evaluateSpaPersistenceCopyHonesty({
				label: loginFallback.rememberMe,
				hint: loginFallback.rememberMeHint,
			});
			expect(result, rel).toEqual({ ok: true });
		}
	});

	it('Keycloak eliteew theme owns 14-day Remember Me wording', () => {
		for (const rel of [
			'docker/keycloak/themes/eliteew/login/messages/messages_ru.properties',
			'docker/keycloak/themes/eliteew/login/messages/messages_en.properties',
		]) {
			const props = readTheme(rel);
			const result = evaluateIdpRememberMeCopyHonesty({
				label: props.rememberMe ?? '',
				help: props.eliteewRememberMeHelp ?? '',
			});
			expect(result, rel).toEqual({ ok: true });
		}
	});

	it('unchecked SPA persistence resolves to sessionStorage only', () => {
		expect(resolveTokenPersistence(false)).toBe('session');
		expect(resolveTokenPersistence(true)).toBe('local');
	});
});
