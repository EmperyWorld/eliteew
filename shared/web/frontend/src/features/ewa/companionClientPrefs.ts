/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified facade for companion client preference keys (UX map §4) — stable getters/setters without changing storage key strings.
 *
 * Invariants:
 * - Re-exports only; key prefixes remain owned by underlying modules for backward compatibility.
 * - UI-only preferences; server orchestration is unaffected.
 *
 * Related:
 * - documentation/product/ewa/EWA-COMPANION-USER-UX-MAP.md §4
 * - src/features/ewa/companionTools/companionPinnedToolsStorage.ts
 */

export {
	readPinnedToolIds,
	writePinnedToolIds,
	togglePinnedToolId,
	COMPANION_PINNED_TOOLS_MAX,
} from '@/features/ewa/companionTools/companionPinnedToolsStorage';

export {
	readRecentToolIds,
	recordRecentToolId,
	COMPANION_RECENT_TOOLS_MAX,
} from '@/features/ewa/companionTools/companionRecentToolsStorage';

export {
	loadCompanionOutputSurfaceState,
	saveCompanionOutputSurfaceState,
} from '@/features/ewa/companionOutputSurface/companionOutputSurfaceState';

export {
	loadEwaCompanionChatDraft,
	saveEwaCompanionChatDraft,
	clearEwaCompanionChatDraft,
	EWA_COMPANION_CHAT_DRAFT_MAX_LEN,
} from '@/services/ewa/ewaCompanionChatApi';

export {
	readLocalObservationTriggerPrefs,
	writeLocalObservationTriggerPrefs,
	loadObservationTriggerPrefs,
	saveObservationTriggerPrefs,
	DEFAULT_COMPANION_OBSERVATION_TRIGGER_PREFS,
	type CompanionObservationTriggerPrefs,
} from '@/features/ewa/companionObservationTriggerPrefs';

export {
	isProactiveSnoozedToday,
	snoozeProactiveUntilEndOfDay,
} from '@/features/ewa/companionUx/companionProactiveSnoozeStorage';

export {
	readMyPhraseIconOverrides,
	writeMyPhraseIconOverride,
	COMPANION_MY_PHRASE_ICON_OPTIONS,
	type MyPhraseIconOverride,
} from '@/features/ewa/companionOutputSurface/companionMyPhraseIconsStorage';
