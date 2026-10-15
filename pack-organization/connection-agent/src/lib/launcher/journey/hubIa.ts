/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hub IA constants + EliteEW Start gating helpers for Journey v1.
 *
 * Invariants:
 * - Primary tabs are EliteEW | Релизы | Ещё only (no brochure / Appeals).
 * - Last-tab memory is out of v1.
 * - FoFline-only (including blocked_version / blocked_capability) → filled
 *   primary is FoFline, not disabled Cloud. Pack-not-ready does not swap chrome.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §4–§5.1
 */

import type { HubPrimaryTab } from './journeyPhase';

export const HUB_PRIMARY_TABS: readonly HubPrimaryTab[] = [
	'eliteew',
	'releases',
	'more',
] as const;

export type MorePanelId =
	| 'license'
	| 'connection'
	| 'network'
	| 'about'
	| 'site'
	| 'source_code'
	| 'mailto';

export const MORE_PANELS: readonly MorePanelId[] = [
	'license',
	'connection',
	'network',
	'about',
	'site',
	'source_code',
	'mailto',
] as const;

/** Deferred Journey surfaces — must not appear as Hub primary tabs. */
export const DEFERRED_HUB_TABS = [
	'brochure',
	'appeals',
	'notifications_inbox',
] as const;

export type EliteewStartInput = {
	versionOk: boolean;
	entitlementOk: boolean;
	denylisted: boolean;
	allowOnline: boolean;
	allowFofline: boolean;
	offlineOnly: boolean;
};

export type EliteewPrimaryCta =
	| 'open_cloud'
	| 'open_fofline'
	| 'open_offline'
	| 'blocked_denylist'
	| 'blocked_version'
	| 'blocked_capability';

export function resolveEliteewPrimaryCta(
	input: EliteewStartInput
): EliteewPrimaryCta {
	if (input.denylisted) return 'blocked_denylist';
	if (!input.versionOk) return 'blocked_version';
	if (!input.entitlementOk) return 'blocked_capability';
	if (input.offlineOnly) return 'open_offline';
	if (input.allowOnline) return 'open_cloud';
	if (input.allowFofline) return 'open_fofline';
	return 'blocked_capability';
}

export type EliteewLauncherPrimaryKind = 'cloud' | 'fofline';

export type EliteewLauncherLayout = {
	lead: string;
	primaryKind: EliteewLauncherPrimaryKind;
	primaryLabel: string;
	showFoflineSecondary: boolean;
	showChannelRecover: boolean;
};

export type EliteewLauncherLayoutInput = {
	primaryCta: EliteewPrimaryCta;
	allowOnline: boolean;
	allowFofline: boolean;
	canOnlineStart: boolean;
	canFoflineStart: boolean;
	preflightPending: boolean;
	denylisted: boolean;
	entitlementOk: boolean;
	hasCheckChannel: boolean;
	versionLabel: string;
};

function resolveLauncherPrimaryKind(
	primaryCta: EliteewPrimaryCta,
	allowOnline: boolean,
	allowFofline: boolean
): EliteewLauncherPrimaryKind {
	if (primaryCta === 'open_fofline') return 'fofline';
	if (primaryCta === 'open_cloud') return 'cloud';
	if (allowFofline && !allowOnline) return 'fofline';
	return 'cloud';
}

/** Hub EliteEW Start chrome: FoFline-only seats get FoFline as the filled primary. */
export function resolveEliteewLauncherLayout(
	input: EliteewLauncherLayoutInput
): EliteewLauncherLayout {
	const primaryKind = resolveLauncherPrimaryKind(
		input.primaryCta,
		input.allowOnline,
		input.allowFofline
	);
	const primaryLabel =
		primaryKind === 'fofline' ? 'Открыть FoFline' : 'Открыть EliteEW';
	const showFoflineSecondary =
		input.allowFofline && primaryKind === 'cloud' && !input.denylisted;
	const channelOrPreflightBlocked =
		(input.allowOnline && !input.canOnlineStart) ||
		(input.allowFofline && !input.canFoflineStart);
	const showChannelRecover =
		input.hasCheckChannel &&
		input.entitlementOk &&
		!input.denylisted &&
		!input.preflightPending &&
		channelOrPreflightBlocked;
	return {
		lead: eliteewLauncherLead(primaryKind, input.allowFofline, input.versionLabel),
		primaryKind,
		primaryLabel,
		showFoflineSecondary,
		showChannelRecover,
	};
}

function eliteewLauncherLead(
	primaryKind: EliteewLauncherPrimaryKind,
	allowFofline: boolean,
	versionLabel: string
): string {
	const v = `Клиент v${versionLabel}.`;
	if (primaryKind === 'fofline') {
		return `Откройте FoFline на этом устройстве. Офлайн-приложения справа. ${v}`;
	}
	if (allowFofline) {
		return `Откройте облачный рабочий стол или FoFline. Офлайн-приложения справа. ${v}`;
	}
	return `Откройте облачный рабочий стол или продолжите с офлайн-приложениями справа. ${v}`;
}

export function isPrimaryHubTab(id: string): id is HubPrimaryTab {
	return (HUB_PRIMARY_TABS as readonly string[]).includes(id);
}
