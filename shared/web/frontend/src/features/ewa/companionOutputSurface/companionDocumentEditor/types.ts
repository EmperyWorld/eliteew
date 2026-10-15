/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Types for embedded companion document editor mode (output surface).
 *
 * Invariants:
 * - Public Props shape matches CompanionDocumentEditorMode facade contract.
 *
 * Related:
 * - CompanionDocumentEditorMode.tsx
 * - documentation/product/ewa/EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md
 */

import type { EwaCompanionProfileOut } from '@/services/ewa/ewaCompanionProfileApi';

export type CompanionDocumentEditorModeProps = {
	payload?: Record<string, unknown>;
	companionProfile?: Pick<
		EwaCompanionProfileOut,
		'seed_persona_id' | 'baseline' | 'style_parameters' | 'character_state'
	>;
	companionPrincipalId?: string;
	externalActionsHost?: HTMLElement | null;
	onBackToChat: () => void;
	onDraftPrompt: (text: string) => void;
};

export type QuickAction = 'improve' | 'fix' | 'shorten' | 'custom';

export type PersistedDocumentSnapshot = {
	title: string;
	markdown: string;
	version: number | null;
};

export type RecoverableDraftSource = 'local' | 'server';
