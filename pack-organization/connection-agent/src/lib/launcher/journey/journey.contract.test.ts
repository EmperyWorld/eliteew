/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey v1 acceptance locks from DESKTOP-CLIENT-LAUNCHER-JOURNEY.md
 * (tests-from-requirements before Hub UI waves).
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	defaultHubTab,
	isIdentifyingComplete,
	mayShowActivationDropZone,
	mayShowHubTabs,
	phaseAfterIdentifying,
	phaseForUnlicensed,
} from './journeyPhase';
import {
	DEFERRED_HUB_TABS,
	HUB_PRIMARY_TABS,
	MORE_PANELS,
	isPrimaryHubTab,
	resolveEliteewPrimaryCta,
	resolveEliteewLauncherLayout,
} from './hubIa';
import {
	DEFAULT_AUTO_APPLY_POLICY,
	RELEASE_NOTES_SOURCES,
	maySilentAutoApplyUpdate,
	notesCopyLooksOpsJargon,
} from './releaseNotesPolicy';
import {
	connectionCopyLeaksInfra,
	connectionSignalFromPortalCode,
	connectionSignalHintRu,
	connectionSignalLabelRu,
} from './connectionSignal';
import {
	CRITICAL_FAIL_KEYS,
	CRITICAL_RESET_STEPS,
	EXTENDED_RESET_STEPS,
	FORBIDDEN_REVOKE_PATH_FRAGMENTS,
	RESET_KEEP,
	isIdempotentCleanReset,
	resetAllowsSuccessUi,
	urlLooksLikeServerRevoke,
	wipeConfirmAllowsUninstallCheckbox,
} from './licenseLocalReset';
import {
	ELITEEW_SITE_URL,
	ELITEEW_SOURCE_CODE_URL,
	LICENSE_CONTACT_EMAIL,
	LICENSE_MAILTO_URL,
	openerUrlFor,
} from './openerLinks';

describe('Journey W1 Identifying (no activation flash)', () => {
	it('stays identifying when only nativeReady (ping) is true', () => {
		const input = {
			nativeReady: true,
			channelRestoreDone: false,
			entitlementStatusDone: false,
			entitlementOk: true,
			bootFailed: false,
		};
		expect(isIdentifyingComplete(input)).toBe(false);
		expect(phaseAfterIdentifying(input)).toBe('identifying');
		expect(mayShowActivationDropZone('identifying')).toBe(false);
		expect(mayShowHubTabs('identifying')).toBe(false);
	});

	it('requires channel restore + entitlementStatus before exit', () => {
		expect(
			isIdentifyingComplete({
				nativeReady: true,
				channelRestoreDone: true,
				entitlementStatusDone: false,
				entitlementOk: true,
				bootFailed: false,
			})
		).toBe(false);
		expect(
			phaseAfterIdentifying({
				nativeReady: true,
				channelRestoreDone: true,
				entitlementStatusDone: true,
				entitlementOk: true,
				bootFailed: false,
			})
		).toBe('hub');
	});

	it('routes unlicensed seat to Welcome/Activation, not Hub', () => {
		const boot = {
			nativeReady: true,
			channelRestoreDone: true,
			entitlementStatusDone: true,
			entitlementOk: false,
			bootFailed: false,
		};
		expect(phaseAfterIdentifying(boot)).toBe('welcome');
		expect(
			phaseAfterIdentifying(boot, {
				onboardingCompleted: true,
				afterLocalReset: true,
			})
		).toBe('activation');
	});

	it('surfaces boot_error without drop-zone', () => {
		expect(
			phaseAfterIdentifying({
				nativeReady: false,
				channelRestoreDone: false,
				entitlementStatusDone: false,
				entitlementOk: false,
				bootFailed: true,
			})
		).toBe('boot_error');
		expect(mayShowActivationDropZone('boot_error')).toBe(false);
	});
});

describe('Journey W3 Welcome once + Activation', () => {
	it('shows Welcome only when onboarding not completed', () => {
		expect(
			phaseForUnlicensed({
				entitlementOk: false,
				onboardingCompleted: false,
				afterLocalReset: false,
			})
		).toBe('welcome');
		expect(
			phaseForUnlicensed({
				entitlementOk: false,
				onboardingCompleted: true,
				afterLocalReset: false,
			})
		).toBe('activation');
	});

	it('after local reset with onboarding done → Activation only', () => {
		expect(
			phaseForUnlicensed({
				entitlementOk: false,
				onboardingCompleted: true,
				afterLocalReset: true,
			})
		).toBe('activation');
		expect(mayShowActivationDropZone('activation')).toBe(true);
	});
});

describe('Journey W2 Hub IA + EliteEW CTA', () => {
	it('primary tabs are EliteEW | Релизы | Ещё only', () => {
		expect([...HUB_PRIMARY_TABS]).toEqual(['eliteew', 'releases', 'more']);
		for (const deferred of DEFERRED_HUB_TABS) {
			expect(isPrimaryHubTab(deferred)).toBe(false);
		}
		expect([...MORE_PANELS]).toEqual([
			'license',
			'connection',
			'network',
			'about',
			'site',
			'source_code',
			'mailto',
		]);
	});

	it('default tab: Релизы once per available version, else EliteEW', () => {
		expect(
			defaultHubTab({
				updateAvailable: true,
				availableVersion: '0.5.0',
				updateNotesShownForVersion: null,
			})
		).toBe('releases');
		expect(
			defaultHubTab({
				updateAvailable: true,
				availableVersion: '0.5.0',
				updateNotesShownForVersion: '0.5.0',
			})
		).toBe('eliteew');
		expect(
			defaultHubTab({
				updateAvailable: false,
				availableVersion: null,
				updateNotesShownForVersion: null,
			})
		).toBe('eliteew');
	});

	it('gates Start by denylist / version / capabilities', () => {
		expect(
			resolveEliteewPrimaryCta({
				versionOk: true,
				entitlementOk: true,
				denylisted: true,
				allowOnline: true,
				allowFofline: false,
				offlineOnly: false,
			})
		).toBe('blocked_denylist');
		expect(
			resolveEliteewPrimaryCta({
				versionOk: false,
				entitlementOk: true,
				denylisted: false,
				allowOnline: true,
				allowFofline: false,
				offlineOnly: false,
			})
		).toBe('blocked_version');
		expect(
			resolveEliteewPrimaryCta({
				versionOk: true,
				entitlementOk: true,
				denylisted: false,
				allowOnline: true,
				allowFofline: false,
				offlineOnly: false,
			})
		).toBe('open_cloud');
		expect(
			resolveEliteewPrimaryCta({
				versionOk: true,
				entitlementOk: true,
				denylisted: false,
				allowOnline: false,
				allowFofline: true,
				offlineOnly: false,
			})
		).toBe('open_fofline');
		expect(
			resolveEliteewPrimaryCta({
				versionOk: true,
				entitlementOk: true,
				denylisted: false,
				allowOnline: false,
				allowFofline: false,
				offlineOnly: true,
			})
		).toBe('open_offline');
	});

	it('FoFline-only Hub layout uses FoFline as filled primary without Cloud secondary', () => {
		const layout = resolveEliteewLauncherLayout({
			primaryCta: 'open_fofline',
			allowOnline: false,
			allowFofline: true,
			canOnlineStart: false,
			canFoflineStart: false,
			preflightPending: false,
			denylisted: false,
			entitlementOk: true,
			hasCheckChannel: true,
			versionLabel: '0.4.61',
		});
		expect(layout.primaryKind).toBe('fofline');
		expect(layout.primaryLabel).toBe('Открыть FoFline');
		expect(layout.showFoflineSecondary).toBe(false);
		expect(layout.showChannelRecover).toBe(true);
		expect(layout.lead).toContain('FoFline');
		expect(layout.lead).not.toContain('облачный рабочий стол');
	});

	it('FoFline-only below min version still uses FoFline primary, not disabled Cloud', () => {
		const layout = resolveEliteewLauncherLayout({
			primaryCta: 'blocked_version',
			allowOnline: false,
			allowFofline: true,
			canOnlineStart: false,
			canFoflineStart: false,
			preflightPending: false,
			denylisted: false,
			entitlementOk: true,
			hasCheckChannel: true,
			versionLabel: '0.4.0',
		});
		expect(layout.primaryKind).toBe('fofline');
		expect(layout.primaryLabel).toBe('Открыть FoFline');
		expect(layout.showFoflineSecondary).toBe(false);
		expect(layout.lead).not.toContain('облачный рабочий стол');
	});

	it('FoFline-only pack-not-ready keeps recover off when preflight already ok', () => {
		const layout = resolveEliteewLauncherLayout({
			primaryCta: 'open_fofline',
			allowOnline: false,
			allowFofline: true,
			canOnlineStart: false,
			canFoflineStart: true,
			preflightPending: false,
			denylisted: false,
			entitlementOk: true,
			hasCheckChannel: true,
			versionLabel: '0.4.61',
		});
		expect(layout.primaryKind).toBe('fofline');
		expect(layout.showChannelRecover).toBe(false);
	});

	it('cloud+FoFline Hub keeps Cloud primary and FoFline secondary', () => {
		const layout = resolveEliteewLauncherLayout({
			primaryCta: 'open_cloud',
			allowOnline: true,
			allowFofline: true,
			canOnlineStart: true,
			canFoflineStart: true,
			preflightPending: false,
			denylisted: false,
			entitlementOk: true,
			hasCheckChannel: true,
			versionLabel: '0.4.61',
		});
		expect(layout.primaryKind).toBe('cloud');
		expect(layout.primaryLabel).toBe('Открыть EliteEW');
		expect(layout.showFoflineSecondary).toBe(true);
		expect(layout.showChannelRecover).toBe(false);
		expect(layout.lead).toContain('FoFline');
	});

	it('cloud-only Hub does not render FoFline secondary', () => {
		const layout = resolveEliteewLauncherLayout({
			primaryCta: 'open_cloud',
			allowOnline: true,
			allowFofline: false,
			canOnlineStart: false,
			canFoflineStart: false,
			preflightPending: false,
			denylisted: false,
			entitlementOk: true,
			hasCheckChannel: true,
			versionLabel: '0.4.61',
		});
		expect(layout.showFoflineSecondary).toBe(false);
		expect(layout.showChannelRecover).toBe(true);
		expect(layout.lead).toContain('облачный рабочий стол');
		expect(layout.lead).not.toMatch(/или FoFline/);
	});
});

describe('Journey W4 Релизы dual-flag', () => {
	it('default policy suppresses silent auto-apply while notes visible (Linux)', () => {
		expect(DEFAULT_AUTO_APPLY_POLICY).toBe('suppress_while_notes');
		expect(
			maySilentAutoApplyUpdate({
				policy: 'suppress_while_notes',
				updateAvailable: true,
				notesVisibleForAvailableVersion: true,
				platform: 'linux',
			})
		).toBe(false);
		expect(
			maySilentAutoApplyUpdate({
				policy: 'suppress_while_notes',
				updateAvailable: true,
				notesVisibleForAvailableVersion: false,
				platform: 'linux',
			})
		).toBe(true);
	});

	it('keep_auto_apply override still only applies on Linux when update available', () => {
		expect(
			maySilentAutoApplyUpdate({
				policy: 'keep_auto_apply',
				updateAvailable: true,
				notesVisibleForAvailableVersion: true,
				platform: 'linux',
			})
		).toBe(true);
		expect(
			maySilentAutoApplyUpdate({
				policy: 'keep_auto_apply',
				updateAvailable: true,
				notesVisibleForAvailableVersion: true,
				platform: 'windows',
			})
		).toBe(false);
	});

	it('locks notes source paths and rejects ops jargon in user notes', () => {
		expect(RELEASE_NOTES_SOURCES.userNotesRelPath).toBe(
			'docs/RELEASE-NOTES-user.ru.txt'
		);
		expect(notesCopyLooksOpsJargon('Что нового в EliteEW')).toBe(false);
		expect(notesCopyLooksOpsJargon('deploy bake_id STACK0_')).toBe(true);
	});

	it('useUpdater exposes maySilentAutoApply gate for Journey dual-flag', () => {
		const hook = readFileSync(
			join(
				dirname(fileURLToPath(import.meta.url)),
				'../../../hooks/useUpdater.ts'
			),
			'utf8'
		);
		expect(hook).toContain('maySilentAutoApply');
		expect(hook).toContain('Откройте раздел «Релизы»');
	});
});

describe('Journey W5 local factory-reset', () => {
	it('defines critical / extended / keep inventories', () => {
		expect(CRITICAL_RESET_STEPS).toContain('entitlement');
		expect(CRITICAL_RESET_STEPS).toContain('bind');
		expect(CRITICAL_RESET_STEPS).toContain('peer');
		expect(EXTENDED_RESET_STEPS).toContain('fofline_spa');
		expect(EXTENDED_RESET_STEPS).toContain('product_webview');
		expect(RESET_KEEP).toContain('device_identity');
		expect(RESET_KEEP).toContain('import_folder');
	});

	it('blocks success UI when entitlement|bind|peer failed', () => {
		for (const key of CRITICAL_FAIL_KEYS) {
			expect(
				resetAllowsSuccessUi({
					ok: true,
					cleared: [],
					skipped: [],
					failed: [key],
					requires_restart: true,
				})
			).toBe(false);
		}
		expect(
			resetAllowsSuccessUi({
				ok: true,
				cleared: ['entitlement', 'bind', 'peer'],
				skipped: ['clipboard_history'],
				failed: [],
				requires_restart: true,
			})
		).toBe(true);
	});

	it('requires requires_restart on success path', () => {
		expect(
			resetAllowsSuccessUi({
				ok: true,
				cleared: ['entitlement'],
				skipped: [],
				failed: [],
				requires_restart: false,
			})
		).toBe(false);
	});

	it('treats clean idempotent reset as ok', () => {
		expect(
			isIdempotentCleanReset({
				ok: true,
				cleared: [],
				skipped: ['entitlement', 'bind'],
				failed: [],
				requires_restart: true,
			})
		).toBe(true);
	});

	it('forbids server revoke URL fragments', () => {
		expect(FORBIDDEN_REVOKE_PATH_FRAGMENTS.length).toBeGreaterThan(0);
		expect(urlLooksLikeServerRevoke('/api/v1/license/revoke')).toBe(true);
		expect(urlLooksLikeServerRevoke('/api/v1/desktop/bind/clear')).toBe(false);
	});

	it('v1 confirm must not offer uninstall checkbox', () => {
		expect(wipeConfirmAllowsUninstallCheckbox({ showUninstall: false })).toBe(
			true
		);
		expect(wipeConfirmAllowsUninstallCheckbox({ showUninstall: true })).toBe(
			false
		);
	});

	it('W5a Core exposes entitlement delete + all-edition peer clear + orchestrator', () => {
		const root = resolve(
			dirname(fileURLToPath(import.meta.url)),
			'../../../..'
		);
		const entitlement = readFileSync(
			resolve(root, 'src-tauri/src/entitlement.rs'),
			'utf8'
		);
		const capsule = readFileSync(
			resolve(root, 'src-tauri/src/capsule_store.rs'),
			'utf8'
		);
		const reset = readFileSync(
			resolve(root, 'src-tauri/src/commands/license_reset.rs'),
			'utf8'
		);
		const lib = readFileSync(resolve(root, 'src-tauri/src/lib.rs'), 'utf8');
		const bridge = readFileSync(
			resolve(root, 'src/lib/tauri-bridge/commands.ts'),
			'utf8'
		);
		const fe = readFileSync(
			resolve(root, 'src/lib/launcher/journey/runLicenseLocalFactoryReset.ts'),
			'utf8'
		);
		expect(entitlement).toContain('pub fn delete_document');
		expect(capsule).toContain('clear_peer_conf_all_editions');
		expect(capsule).toContain('FOFLINE_SERVICE');
		expect(capsule).toContain('CONNECTED_SERVICE');
		expect(capsule).toContain('LEGACY_SERVICE');
		expect(reset).toContain('license_local_factory_reset');
		expect(reset).toContain('delete_document');
		expect(reset).toContain('clear_peer_conf_all_editions');
		expect(reset).toContain('device_bind::clear');
		expect(reset).not.toMatch(/license\/revoke|licenses\/revoke|seat\/revoke/);
		expect(lib).toContain('license_local_factory_reset');
		expect(bridge).toMatch(
			/invoke<LicenseLocalFactoryResetView>\(["']license_local_factory_reset["']/
		);
		expect(fe).toContain('licenseLocalFactoryReset');
		expect(fe).toContain('clearPersistedBindIds');
		expect(fe).toContain('clearPersistedLicenseCapabilities');
		expect(fe).toContain('markAfterLocalResetForRestart');
		expect(fe).toContain('appRestart');
		expect(fe).not.toMatch(/license\/revoke|licenses\/revoke/);
	});

	it('W5a FE clear helpers remove bind + capabilities keys', () => {
		const root = resolve(
			dirname(fileURLToPath(import.meta.url)),
			'../../../..'
		);
		const bind = readFileSync(
			resolve(root, 'src/lib/launcher/bindSession.ts'),
			'utf8'
		);
		const caps = readFileSync(
			resolve(root, 'src/lib/launcher/licenseCapabilities.ts'),
			'utf8'
		);
		expect(bind).toContain('clearPersistedBindIds');
		expect(bind).toContain('removeItem(BIND_LICENSE_STORAGE_KEY)');
		expect(caps).toContain('clearPersistedLicenseCapabilities');
		expect(caps).toContain('removeItem(LICENSE_CAPABILITIES_STORAGE_KEY)');
	});

	it('W5b Core extended wipe + FE product_webview_wipe bridge', () => {
		const root = resolve(
			dirname(fileURLToPath(import.meta.url)),
			'../../../..'
		);
		const reset = readFileSync(
			resolve(root, 'src-tauri/src/commands/license_reset.rs'),
			'utf8'
		);
		const spa = readFileSync(
			resolve(root, 'src-tauri/src/spa_pack.rs'),
			'utf8'
		);
		const denylist = readFileSync(
			resolve(root, 'src-tauri/src/denylist.rs'),
			'utf8'
		);
		const bridge = readFileSync(
			resolve(root, 'src/lib/tauri-bridge/commands.ts'),
			'utf8'
		);
		const fe = readFileSync(
			resolve(root, 'src/lib/launcher/journey/runLicenseLocalFactoryReset.ts'),
			'utf8'
		);
		expect(spa).toContain('pub fn remove_pack_tree');
		expect(denylist).toContain('pub fn clear_cache');
		expect(reset).toContain('remove_pack_tree');
		expect(reset).toContain('clear_cache');
		expect(reset).toContain('wipe_product_webview');
		expect(reset.indexOf('wipe_product_webview')).toBeLessThan(
			reset.indexOf('w_transport_stop_for_app')
		);
		expect(reset).toContain('view.wiped');
		expect(reset).toContain('clipboard_history::clear_all');
		expect(reset).toContain('notifications_store::clear');
		expect(reset).toContain('ai_third_party');
		expect(reset).not.toMatch(/license\/revoke|licenses\/revoke/);
		expect(bridge).toMatch(
			/invoke<ProductWebviewWipeView>\(["']product_webview_wipe["']\)/
		);
		expect(fe).toContain('disableOpsDebugUi');
	});
});

describe('Journey W6 connection + opener contacts', () => {
	it('maps portal codes to four user levels', () => {
		expect(connectionSignalFromPortalCode('protected')).toBe('protected');
		expect(connectionSignalFromPortalCode('socks_listening')).toBe(
			'connecting'
		);
		expect(connectionSignalFromPortalCode('socks_up')).toBe('connecting');
		expect(connectionSignalFromPortalCode('reconnecting')).toBe(
			'connecting'
		);
		expect(connectionSignalFromPortalCode('channel_unconfirmed')).toBe(
			'unstable'
		);
		expect(connectionSignalFromPortalCode('channel_unstable')).toBe(
			'unstable'
		);
		expect(connectionSignalFromPortalCode('down')).toBe('down');
		expect(connectionSignalFromPortalCode('idle')).toBe('down');
		expect(connectionSignalFromPortalCode(null)).toBe('down');
	});

	it('rejects peer IP / SOCKS leaks in connection copy', () => {
		expect(connectionCopyLeaksInfra('Канал защищён')).toBe(false);
		expect(connectionCopyLeaksInfra('socks5://127.0.0.1:1080')).toBe(true);
		expect(connectionCopyLeaksInfra('peer 10.77.77.2')).toBe(true);
	});

	it('locks site, source code, and license@eliteew.ru mailto', () => {
		expect(ELITEEW_SITE_URL).toBe('https://eliteew.ru');
		expect(ELITEEW_SOURCE_CODE_URL).toBe(
			'https://github.com/EmperyWorld/eliteew'
		);
		expect(LICENSE_CONTACT_EMAIL).toBe('license@eliteew.ru');
		expect(LICENSE_MAILTO_URL).toBe('mailto:license@eliteew.ru');
		expect(openerUrlFor('site')).toBe(ELITEEW_SITE_URL);
		expect(openerUrlFor('source_code')).toBe(ELITEEW_SOURCE_CODE_URL);
		expect(openerUrlFor('mailto')).toBe(LICENSE_MAILTO_URL);
		expect(LICENSE_CONTACT_EMAIL).not.toMatch(/poet@/i);
	});

	it('exposes RU labels for four connection levels without infra leaks', () => {
		expect(connectionSignalLabelRu('protected')).toBe('Защищено');
		expect(connectionSignalLabelRu('connecting')).toContain('Подключение');
		expect(connectionSignalLabelRu('unstable')).toBe('Нестабильно');
		expect(connectionSignalLabelRu('down')).toContain('Нет');
		expect(connectionSignalHintRu('protected')).toBe(
			'Защищённый канал активен.'
		);
		expect(connectionSignalHintRu('protected')).not.toContain(
			'Можно открывать'
		);
		for (const level of [
			'protected',
			'connecting',
			'unstable',
			'down',
		] as const) {
			expect(connectionCopyLeaksInfra(connectionSignalHintRu(level))).toBe(
				false
			);
		}
	});
});
