/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source lock: Hub Start runs native interactive OIDC before product_open.
 * Wave 7: native failure must not open the product.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §9.9 / §9.13
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cloud = join(root, 'hooks/useCloudStart.ts');
const fofline = join(root, 'hooks/useFoflineStart.ts');
const helper = join(root, 'lib/launcher/nativeOidcHubSession.ts');

describe('Hub native OIDC before product_open (source)', () => {
	it('helper fails closed on native failure (no soft-continue)', () => {
		const src = readFileSync(helper, 'utf8');
		expect(src).toContain('nativeOidcInteractiveLogin');
		expect(src).toContain('HUB_NATIVE_REQUIRED_RU');
		expect(src).toContain('ensureNativeOidcBeforeProductOpen');
		expect(src).not.toContain('softContinue');
		expect(src).not.toContain('HUB_NATIVE_SOFT_CONTINUE_RU');
	});

	it('Cloud/FoFline do not open product when native login fails', () => {
		const cloudSrc = readFileSync(cloud, 'utf8');
		const foflineSrc = readFileSync(fofline, 'utf8');
		expect(cloudSrc).toContain('if (!native.nativeOk)');
		expect(foflineSrc).toContain('if (!native.nativeOk)');
		expect(cloudSrc).not.toContain(
			'Открыт облачный стол — войдите в окне приложения, если вход ещё не завершён',
		);
		expect(foflineSrc).not.toContain(
			'Открыт FoFline — войдите в окне приложения, если вход ещё не завершён',
		);
	});

	it('Cloud Start calls ensure before productOpen', () => {
		const src = readFileSync(cloud, 'utf8');
		expect(src).toContain('ensureNativeOidcBeforeProductOpen');
		expect(src).toContain("client: 'emperyDesktop'");
		const ensureIdx = src.indexOf('ensureNativeOidcBeforeProductOpen');
		const openIdx = src.indexOf('productOpen({');
		expect(ensureIdx).toBeGreaterThan(0);
		expect(openIdx).toBeGreaterThan(ensureIdx);
	});

	it('FoFline Start calls ensure before productOpen', () => {
		const src = readFileSync(fofline, 'utf8');
		expect(src).toContain('ensureNativeOidcBeforeProductOpen');
		expect(src).toContain("client: 'emperyFofline'");
		const ensureIdx = src.indexOf('ensureNativeOidcBeforeProductOpen');
		const openIdx = src.indexOf("kind: 'foflineLocal'");
		expect(ensureIdx).toBeGreaterThan(0);
		expect(openIdx).toBeGreaterThan(ensureIdx);
	});

	it('product_open denies without native session (Wave 7 enforce)', () => {
		const productRs = readFileSync(
			join(root, '../src-tauri/src/commands/product.rs'),
			'utf8',
		);
		const prod = productRs.split('#[cfg(test)]')[0] ?? productRs;
		expect(prod).toContain('product_open native_oidc_session_required');
		expect(prod).toContain('refresh_access_token');
		expect(prod).not.toContain('prepare_for_product_open');
		expect(prod).not.toContain('native_oidc_prepare_soft_skip');
		expect(prod).toContain('"auth_policy_denied"');
		expect(prod).toContain('generic_user_message()');
	});

	it('prepare fails closed when PAR fails after ticket', () => {
		const prepareRs = readFileSync(
			join(root, '../src-tauri/src/native_oidc/prepare.rs'),
			'utf8',
		);
		expect(prepareRs).toContain('native_oidc_prepare_deny reason=par_fail');
		expect(prepareRs).not.toContain('native_oidc_par_soft_skip');
	});

	it('PAR and token DPoP iat align to Keycloak HTTP Date (26.7.1 active window)', () => {
		const dpopIat = readFileSync(
			join(root, '../src-tauri/src/native_oidc/dpop_iat.rs'),
			'utf8',
		);
		const parRs = readFileSync(
			join(root, '../src-tauri/src/native_oidc/par.rs'),
			'utf8',
		);
		const tokenRs = readFileSync(
			join(root, '../src-tauri/src/native_oidc/token.rs'),
			'utf8',
		);
		expect(dpopIat).toContain('KC_DPOP_PROOF_LIFETIME_SECS');
		expect(dpopIat).toContain('resolve_dpop_iat');
		expect(dpopIat).toContain('BAKED_ISSUER');
		expect(parRs).toContain('resolve_dpop_iat');
		expect(parRs).toContain('prompt_login');
		expect(parRs).toContain('("prompt", "login")');
		expect(tokenRs).toContain('resolve_dpop_iat');
		expect(parRs).not.toMatch(/sign_dpop_proof\([\s\S]*now_unix\(\)/);
		expect(tokenRs).not.toMatch(/sign_dpop_proof\([\s\S]*now_unix\(\)/);
	});

	it('oidc-auth destroys leftover window and allows Tauri IPC bootstrap', () => {
		const hub = readFileSync(
			join(root, '../src-tauri/src/native_oidc/hub_login.rs'),
			'utf8',
		);
		expect(hub).toContain('native_oidc_auth_window_replace');
		expect(hub).toContain('ipc.localhost');
		expect(hub).toContain('tauri.localhost');
		expect(hub).toContain('.incognito(true)');
		expect(hub).toContain('proxy_url');
		expect(hub).toContain('oidc_auth_nav_deny');
		expect(hub).toContain('reason=product_without_code');
		expect(hub).toContain('oidc_auth_window_rebuild');
		expect(hub).toContain('attach_oidc_auth_native_form_gate');
		expect(hub).toContain('oidc_auth_manual_login_script');
		expect(hub).toContain('HTMLFormElement.prototype.submit');
		expect(hub).toContain('PublicKeyCredential');
		expect(hub).toContain('isWebAuthnForm');
		expect(hub).toContain('.initialization_script');
		const prod = hub.split('#[cfg(test)]')[0] ?? hub;
		expect(prod).not.toContain('oidc_auth_nav_retry');
		expect(prod).not.toContain('oidc_auth_nav_repar');
		expect(prod).not.toContain('auto_retry=0');
		expect(prod).not.toContain('location.replace');
		expect(hub).toContain('is_baked_product_host');
		expect(hub).toContain('AUTH_GENERATION');
		expect(hub).not.toContain('CloseRequested { .. }');
	});
});
