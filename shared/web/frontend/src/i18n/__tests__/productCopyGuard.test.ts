/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Guard user-facing product copy touched by the global UX/UI wave against raw
 * support terminology leaking into shared states and next-action prompts.
 *
 * Invariants:
 * - The guarded paths are customer-facing UI copy, not admin/operator consoles.
 * - Support-only namespaces are documented as explicit exceptions.
 *
 * Related:
 * - documentation/product/UX-UI-COPY-GLOSSARY-2026-05.md
 */

import { describe, expect, it } from 'vitest';
import enContentManager from '../locales/en/contentManager.json';
import enDesktopChrome from '../locales/en/desktopChrome.json';
import enDesktopUi from '../locales/en/desktopUi.json';
import enMarketing from '../locales/en/marketing.json';
import enProfessionalWorlds from '../locales/en/professionalWorlds.json';
import enSiteStudio from '../locales/en/siteStudio.json';
import ruContentManager from '../locales/ru/contentManager.json';
import ruDesktopChrome from '../locales/ru/desktopChrome.json';
import ruDesktopUi from '../locales/ru/desktopUi.json';
import ruMarketing from '../locales/ru/marketing.json';
import ruProfessionalWorlds from '../locales/ru/professionalWorlds.json';
import ruSiteStudio from '../locales/ru/siteStudio.json';

const SUPPORT_ONLY_COPY_EXCEPTIONS = [
	'desktopUi.adminPresence',
	'desktopUi.ugsHub',
	'desktopUi.ewaCompanionAdmin',
	'desktopUi.ewDeskAdmin',
	'marketing.amkaDebug',
	'marketing.pipeline',
	'professionalWorlds.adminAudit',
	'professionalWorlds.runtime',
	'siteStudio.ops',
] as const;

const USER_FACING_COPY_PATHS = [
	['desktopUi', ruDesktopUi, enDesktopUi, 'taskSwitcher.emptyTitle'],
	['desktopUi', ruDesktopUi, enDesktopUi, 'taskSwitcher.emptyDescription'],
	['desktopUi', ruDesktopUi, enDesktopUi, 'taskSwitcher.emptyAction'],
	['desktopUi', ruDesktopUi, enDesktopUi, 'workspace.syncFailed'],
	['desktopUi', ruDesktopUi, enDesktopUi, 'workspace.syncServerUnavailable'],
	['desktopUi', ruDesktopUi, enDesktopUi, 'workspace.persistPatchFlushFailed'],
	['desktopChrome', ruDesktopChrome, enDesktopChrome, 'syncStatus.offline'],
	['desktopChrome', ruDesktopChrome, enDesktopChrome, 'syncStatus.error'],
	['desktopChrome', ruDesktopChrome, enDesktopChrome, 'syncStatus.errorDetail'],
	[
		'desktopChrome',
		ruDesktopChrome,
		enDesktopChrome,
		'syncStatus.persistQueued',
	],
	[
		'desktopChrome',
		ruDesktopChrome,
		enDesktopChrome,
		'syncStatus.persistQueuedTitle',
	],
	[
		'desktopChrome',
		ruDesktopChrome,
		enDesktopChrome,
		'syncStatus.staleShellConflict',
	],
	[
		'desktopChrome',
		ruDesktopChrome,
		enDesktopChrome,
		'syncStatus.shellDebouncing',
	],
	[
		'desktopChrome',
		ruDesktopChrome,
		enDesktopChrome,
		'syncStatus.shellFlushing',
	],
	[
		'desktopChrome',
		ruDesktopChrome,
		enDesktopChrome,
		'syncStatus.ariaStaleShellConflict',
	],
	[
		'desktopChrome',
		ruDesktopChrome,
		enDesktopChrome,
		'syncStatus.serverRecoveringTitle',
	],
	[
		'desktopUi',
		ruDesktopUi,
		enDesktopUi,
		'feedbackHub.guide.steps.preview.body',
	],
	['desktopUi', ruDesktopUi, enDesktopUi, 'ewDesk.guide.steps.intro.body'],
	['desktopUi', ruDesktopUi, enDesktopUi, 'atomicAuth.genericDeny'],
	['desktopUi', ruDesktopUi, enDesktopUi, 'atomicAuth.retry'],
	['desktopUi', ruDesktopUi, enDesktopUi, 'atomicAuth.recovery'],
	[
		'desktopUi',
		ruDesktopUi,
		enDesktopUi,
		'notificationHub.guide.steps.feed.body',
	],
	['marketing', ruMarketing, enMarketing, 'ewaCompanion.gateNoDbTitle'],
	['marketing', ruMarketing, enMarketing, 'ewaCompanion.gateNoDb'],
	['marketing', ruMarketing, enMarketing, 'ewaCompanion.gateAuthErrorTitle'],
	['marketing', ruMarketing, enMarketing, 'ewaCompanion.gateAuthError'],
	['marketing', ruMarketing, enMarketing, 'ewaCompanion.chatEmpty'],
	['marketing', ruMarketing, enMarketing, 'ewaCompanion.chatEmptyHint'],
	['marketing', ruMarketing, enMarketing, 'ewaCompanion.chatEmptyShowTools'],
	['marketing', ruMarketing, enMarketing, 'ewaCompanion.gateLoading'],
	['marketing', ruMarketing, enMarketing, 'ewaCompanion.gateLoadTimeoutTitle'],
	['marketing', ruMarketing, enMarketing, 'ewaCompanion.gateLoadTimeout'],
	['siteStudio', ruSiteStudio, enSiteStudio, 'app.panelErrorTitle'],
	[
		'contentManager',
		ruContentManager,
		enContentManager,
		'friends.socialHubOverviewNextActionTitle',
	],
	[
		'contentManager',
		ruContentManager,
		enContentManager,
		'friends.socialHubOverviewOpenInbox',
	],
	[
		'professionalWorlds',
		ruProfessionalWorlds,
		enProfessionalWorlds,
		'properties.postCreateTitle',
	],
	[
		'professionalWorlds',
		ruProfessionalWorlds,
		enProfessionalWorlds,
		'properties.postCreateBody',
	],
] as const;

function readPath(resource: unknown, path: string): string {
	const value = path
		.split('.')
		.reduce<unknown>(
			(current, key) =>
				current && typeof current === 'object'
					? (current as Record<string, unknown>)[key]
					: undefined,
			resource
		);

	if (typeof value !== 'string') {
		throw new Error(`Expected string copy at ${path}`);
	}
	return value;
}

describe('product copy guard', () => {
	it('keeps newly shared product states free of support-only raw terms', () => {
		const forbidden =
			/\b(runtime|pipeline|payload|endpoint|driver|schema|socket|redis|uuid|ugs|reconcile|shell_state|etag|412)\b/i;
		const guardedCopy = USER_FACING_COPY_PATHS.flatMap(
			([namespace, ruResource, enResource, path]) => [
				`${namespace}.${path}: ${readPath(ruResource, path)}`,
				`${namespace}.${path}: ${readPath(enResource, path)}`,
			]
		).join('\n');

		expect(guardedCopy).not.toMatch(forbidden);
	});

	it('documents support-only namespaces excluded from the user copy guard', () => {
		expect(SUPPORT_ONLY_COPY_EXCEPTIONS).toContain('marketing.pipeline');
		expect(SUPPORT_ONLY_COPY_EXCEPTIONS).toContain(
			'professionalWorlds.runtime'
		);
		expect(SUPPORT_ONLY_COPY_EXCEPTIONS).toContain('desktopUi.adminPresence');
		expect(SUPPORT_ONLY_COPY_EXCEPTIONS).toContain('desktopUi.ugsHub');
	});
});
