/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local types for the UltimateDocEditor AI assistant panel atomization.
 *
 * Invariants:
 * - Panel props remain owned by editor.types (AIAssistantPanelProps).
 *
 * Related:
 * - ../types/editor.types.ts
 */

import type { ReactNode } from 'react';
import type {
	AIAssistantPanelProps,
	AIGenerationMeta,
} from '@/components/UltimateDocEditor/types/editor.types';

export type { AIAssistantPanelProps, AIGenerationMeta };

export type AIAssistantContextScope = 'selection' | 'section' | 'document';

export type AIAssistantActionMode =
	| 'rewrite'
	| 'expand'
	| 'summarize'
	| 'translate'
	| 'free';

export type AIAssistantChatMessage = {
	id: string;
	role: 'user' | 'ai';
	text: string;
	meta?: AIGenerationMeta | null;
};

export type AIAssistantSuggestion = {
	id: string;
	text: string;
	status: 'pending' | 'accepted' | 'rejected';
	createdAt: string;
};

export type AIAssistantReplaceDiffStats = {
	beforeLength: number;
	afterLength: number;
	delta: number;
	beforeSnippet: string;
	afterSnippet: string;
};

export type AIAssistantQuickActionItem = {
	action: string;
	label: string;
	/** Heroicon (or other) node — not emoji. */
	icon: ReactNode;
};
