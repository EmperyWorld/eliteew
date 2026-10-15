/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * W2 source locks — HubShell tabs + EliteEW Start migration; App mounts Hub.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §4–§5 / wave W2
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HUB_PRIMARY_TABS } from '../../lib/launcher/journey';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const app = join(root, 'App.tsx');
const hubShell = join(root, 'features/hub/HubShell.tsx');
const eliteew = join(root, 'features/hub/tabs/EliteewTab.tsx');
const releases = join(root, 'features/hub/tabs/ReleasesTab.tsx');
const more = join(root, 'features/hub/tabs/MoreTab.tsx');

describe('Journey W2 Hub (source)', () => {
	it('App mounts HubShell on shell step with defaultHubTab seed', () => {
		const src = readFileSync(app, 'utf8');
		expect(src).toContain('HubShell');
		expect(src).toContain('defaultHubTab');
		expect(src).toContain('hubTab');
		expect(src).toContain('hubTabUserChosen');
		expect(src).toContain('updater.updaterAvailable');
		expect(src).toMatch(/step === 'shell'\s*\?\s*\([\s\S]*?<HubShell/);
		expect(src).not.toMatch(/from ['"].*ShellStep['"]/);
		expect(src).not.toMatch(/<ShellStep\b/);
		expect(src).toContain('otaAfterIdentifyRef');
		expect(src).toContain('handleCheckChannelAndLicense');
		expect(src).toContain('refreshLicensePreflight');
		expect(src).toContain('refreshFoflineLicensePreflight');
		expect(src).toContain('foflineGateDetail');
		expect(src).toContain('productChannelCode');
		expect(src).toContain('wTransportStatus');
		expect(src).toContain('launcherOpenExternal');
		expect(src).toContain('hideStepRail');
		expect(src).toMatch(/hideStepRail\s*\?\s*null\s*:\s*\([\s\S]*?<StepRail/);
	});

	it('HubShell exposes only HUB_PRIMARY_TABS', () => {
		const src = readFileSync(hubShell, 'utf8');
		expect(src).toContain('HUB_PRIMARY_TABS');
		expect(src).toContain('EliteewTab');
		expect(src).toContain('ReleasesTab');
		expect(src).toContain('MoreTab');
		expect(src).toMatch(/role="tablist"/);
		expect(src).toContain('onKeyDown');
		expect(src).toContain('ArrowRight');
		expect(src).toMatch(/hidden=\{tab !== id\}/);
		expect(src).not.toMatch(/tab === ['"]appeals['"]/);
		expect(src).not.toMatch(/from ['"].*brochure/i);
		expect([...HUB_PRIMARY_TABS]).toEqual(['eliteew', 'releases', 'more']);
	});

	it('EliteewTab keeps Start / OfflineShell / denylist / FoFline capability gate', () => {
		const src = readFileSync(eliteew, 'utf8');
		expect(src).toContain('resolveEliteewPrimaryCta');
		expect(src).toContain('resolveEliteewLauncherLayout');
		expect(src).toContain("primaryKind === 'fofline'");
		expect(src).toContain('showFoflineSecondary');
		expect(src).toContain('OfflineShell');
		expect(src).toContain('shouldBlockShellForDenylist');
		expect(src).toContain('FoflineSpaPackStatus');
		expect(src).toContain('canOnlineStart');
		expect(src).toContain('canFoflineStart');
		expect(src).toContain('canCheckUpdate={false}');
		expect(src).toContain('Проверить соединение и лицензию');
		expect(src).toContain('onCheckChannel');
		expect(src).toContain('startLabel={launch.primaryLabel}');
		expect(src).toContain('foflineStartLabel="Открыть FoFline"');
		expect(src).toContain("foflineSpaPack?.state === 'ready'");
		expect(src).toContain('foflinePackReady');
		expect(src).not.toContain('onFoflineStart ?? onStart');
		expect(src).toContain("primaryCta === 'open_offline'");
		expect(src).toMatch(/open_offline[\s\S]*?primary = offlineCatalog/);
	});

	it('Releases keeps updater; More mounts License + Connection + About panels', () => {
		const rel = readFileSync(releases, 'utf8');
		const mor = readFileSync(more, 'utf8');
		expect(rel).toContain('UpdaterStatus');
		expect(rel).toContain('Проверить обновления');
		expect(rel).toContain('BUNDLED_USER_RELEASE_NOTES');
		expect(mor).toContain('LicensePanel');
		expect(mor).toContain('ConnectionPanel');
		expect(mor).toContain('AboutContactsPanel');
		expect(mor).toContain('ProfileMenu');
	});
});
