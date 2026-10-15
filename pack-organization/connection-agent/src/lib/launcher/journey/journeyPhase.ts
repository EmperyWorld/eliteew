/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure Journey v1 phase FSM: Identifying gate, Welcome skip, Hub tab default.
 *
 * Invariants:
 * - Identifying waits for full boot (ping + channel + entitlement), not ping alone.
 * - Activation drop-zone never shown while Identifying.
 * - After local reset with onboarding_completed → Activation, skip Welcome.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §3–§4
 */

export type JourneyPhase =
	| 'identifying'
	| 'welcome'
	| 'activation'
	| 'hub'
	| 'boot_error';

export type HubPrimaryTab = 'eliteew' | 'releases' | 'more';

export type BootResolveInput = {
	/** Native ping succeeded. */
	nativeReady: boolean;
	/** Channel restore finished (success or fail-closed). */
	channelRestoreDone: boolean;
	/** entitlementStatus invoke finished. */
	entitlementStatusDone: boolean;
	entitlementOk: boolean;
	bootFailed: boolean;
};

export type WelcomeGateInput = {
	entitlementOk: boolean;
	onboardingCompleted: boolean;
	/** True when arriving after local factory-reset restart. */
	afterLocalReset: boolean;
};

export type HubDefaultTabInput = {
	updateAvailable: boolean;
	/** Version string already shown in Релизы for this update. */
	updateNotesShownForVersion: string | null;
	availableVersion: string | null;
};

/**
 * Identifying is complete only when native + channel restore + entitlement
 * status have all resolved. Ping-only (`nativeReady`) is too early.
 */
export function isIdentifyingComplete(input: BootResolveInput): boolean {
	if (input.bootFailed) return true;
	return (
		input.nativeReady &&
		input.channelRestoreDone &&
		input.entitlementStatusDone
	);
}

/** Next phase after Identifying resolves (or boot error). */
export function phaseAfterIdentifying(
	input: BootResolveInput,
	welcome: Omit<WelcomeGateInput, 'entitlementOk'> = {
		onboardingCompleted: false,
		afterLocalReset: false,
	}
): JourneyPhase {
	if (input.bootFailed) return 'boot_error';
	if (!isIdentifyingComplete(input)) return 'identifying';
	if (input.entitlementOk) return 'hub';
	return phaseForUnlicensed({
		entitlementOk: false,
		onboardingCompleted: welcome.onboardingCompleted,
		afterLocalReset: welcome.afterLocalReset,
	});
}

/**
 * Unlicensed path: Welcome once, then Activation.
 * After local reset with onboarding done → Activation only.
 */
export function phaseForUnlicensed(input: WelcomeGateInput): JourneyPhase {
	if (input.entitlementOk) return 'hub';
	if (input.afterLocalReset && input.onboardingCompleted) {
		return 'activation';
	}
	if (!input.onboardingCompleted) return 'welcome';
	return 'activation';
}

/** Cold Hub entry: open Релизы once per available version, else EliteEW. */
export function defaultHubTab(input: HubDefaultTabInput): HubPrimaryTab {
	if (
		input.updateAvailable &&
		input.availableVersion &&
		input.updateNotesShownForVersion !== input.availableVersion
	) {
		return 'releases';
	}
	return 'eliteew';
}

/** Drop-zone / Hub chrome must stay hidden during Identifying. */
export function mayShowActivationDropZone(phase: JourneyPhase): boolean {
	return phase === 'activation';
}

export function mayShowHubTabs(phase: JourneyPhase): boolean {
	return phase === 'hub';
}
