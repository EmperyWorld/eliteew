/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared types for the companion **actions tray** undo cards (U8.3 slice 6 extract).
 *
 * Invariants:
 * - ``taskRunId`` mirrors optional ``task_run_id`` on wire actions after stamping.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionActionsTray.tsx
 * - src/features/ewa/companionUx/useCompanionChatSubmit.ts
 */

import type { CompanionActionOutcome } from '@/features/ewa/companionActionsTray';
import type { ContentManagerInitialFilterSnapshot } from '@/pages/Desktop/types/desktop.types';
import type { CompanionWebSearchResult } from '@/services/ewa/ewaCompanionChatApi';

export type CompanionActionKind =
	| 'open'
	| 'close'
	| 'focus'
	| 'minimize'
	| 'web_search'
	| 'notice';

export type CompanionActionRecord = {
	id: string;
	kind: CompanionActionKind;
	appComponent: string;
	rationale?: string;
	closed: boolean;
	outcome?: CompanionActionOutcome;
	unifiedContentId?: string;
	contentManagerFocusUnifiedContentId?: string;
	contentManagerInitialFilter?: ContentManagerInitialFilterSnapshot;
	taskRunId?: string;
	webSearchResult?: CompanionWebSearchResult;
};
