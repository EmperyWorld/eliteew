/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for companion embedded document editor (persona envelope, draft mappers).
 *
 * Invariants:
 * - No React imports; no side effects beyond pure transforms.
 *
 * Related:
 * - useCompanionDocumentEditorMode.ts
 * - documentation/product/ewa/EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md
 */

import type { CompanionDocumentSurfaceDraftSnapshot } from '@/features/ewa/companionOutputSurface/companionDocumentSurfaceDraftState';
import {
	DEFAULT_EWA_PERSONA_ID,
	getEwaPersonaById,
	normalizeEwaPersonaId,
} from '@/features/ewa/ewaPersonaCatalog';
import type {
	EwaCompanionDocumentAiAction,
	EwaCompanionDocumentServerDraft,
	EwaCompanionSurfaceDocument,
} from '@/services/ewa/ewaCompanionDocumentSurfaceApi';

import type { CompanionDocumentEditorModeProps, QuickAction } from './types';

export const STRUCTURE_AUTO_BUILD_DEBOUNCE_MS = 400;

export function actionModeFor(
	action: QuickAction
): EwaCompanionDocumentAiAction {
	if (action === 'fix') return 'rewrite';
	if (action === 'shorten') return 'summarize';
	return 'rewrite';
}

export function markdownFromDocumentRow(
	doc: EwaCompanionSurfaceDocument,
	fallback: string
): string {
	return doc.contentMarkdown || doc.plainText || doc.content || fallback;
}

export function recoverableSnapshotFromServerDraft(
	draft: EwaCompanionDocumentServerDraft,
	fallbackTitle: string
): CompanionDocumentSurfaceDraftSnapshot {
	return {
		title: fallbackTitle.trim() || 'Document',
		markdown: draft.content,
		updatedAt: draft.updatedAt || new Date().toISOString(),
		baseVersion: draft.baseDocumentVersion,
	};
}

function asRecord(raw: unknown): Record<string, unknown> | null {
	return raw && typeof raw === 'object' && !Array.isArray(raw)
		? (raw as Record<string, unknown>)
		: null;
}

function readFirstString(
	records: Array<Record<string, unknown> | null>,
	keys: string[]
): string | null {
	for (const rec of records) {
		if (!rec) continue;
		for (const key of keys) {
			const value = rec[key];
			if (typeof value === 'string' && value.trim()) {
				return value.trim();
			}
		}
	}
	return null;
}

function readFirstNumber(
	records: Array<Record<string, unknown> | null>,
	keys: string[]
): number | null {
	for (const rec of records) {
		if (!rec) continue;
		for (const key of keys) {
			const value = rec[key];
			if (typeof value === 'number' && Number.isFinite(value)) {
				return value;
			}
			if (typeof value === 'string' && value.trim()) {
				const parsed = Number(value);
				if (Number.isFinite(parsed)) return parsed;
			}
		}
	}
	return null;
}

function humanizePersonaId(seedPersonaId: string): string {
	const cleaned = seedPersonaId.replace(/[_-]+/g, ' ').trim();
	if (!cleaned) return 'Companion';
	return cleaned
		.split(/\s+/)
		.map((chunk) => chunk.slice(0, 1).toUpperCase() + chunk.slice(1))
		.join(' ');
}

export function resolveCompanionTransformEnvelope(
	companionProfile: CompanionDocumentEditorModeProps['companionProfile']
) {
	if (!companionProfile) {
		return {
			generationOptions: {},
			companionPersona: null,
		};
	}
	const baseline = asRecord(companionProfile.baseline);
	const styleParameters = asRecord(companionProfile.style_parameters);
	const characterState = asRecord(companionProfile.character_state);
	const records = [styleParameters, baseline, characterState];
	const model = readFirstString(records, [
		'doc_editor_model',
		'rewrite_model',
		'llm_model',
		'model',
	]);
	const temperatureRaw = readFirstNumber(records, [
		'doc_editor_temperature',
		'rewrite_temperature',
		'llm_temperature',
		'temperature',
	]);
	const maxTokensRaw = readFirstNumber(records, [
		'doc_editor_max_tokens',
		'rewrite_max_tokens',
		'llm_max_tokens',
		'max_tokens',
		'num_predict',
	]);
	const companionName =
		readFirstString(
			[baseline, characterState],
			['display_name', 'companion_name', 'persona_name', 'name']
		) || humanizePersonaId(companionProfile.seed_persona_id);
	return {
		generationOptions: {
			...(model ? { model } : {}),
			...(temperatureRaw != null
				? { temperature: Math.max(0, Math.min(1, temperatureRaw)) }
				: {}),
			...(maxTokensRaw != null
				? { maxTokens: Math.max(64, Math.trunc(maxTokensRaw)) }
				: {}),
		},
		companionPersona: {
			seedPersonaId: companionProfile.seed_persona_id,
			name: companionName,
			characterState,
			styleParameters,
			baseline,
		},
	};
}

export function resolveCompanionDisplayName(args: {
	companionProfile: CompanionDocumentEditorModeProps['companionProfile'];
	transformPersonaName: string | null | undefined;
	ru: boolean;
}): string {
	const profile = args.companionProfile;
	if (profile) {
		const explicitName = readFirstString(
			[asRecord(profile.baseline), asRecord(profile.character_state)],
			['display_name', 'companion_name', 'persona_name', 'name']
		);
		if (explicitName) return explicitName;
		const personaId =
			normalizeEwaPersonaId(profile.seed_persona_id) ?? DEFAULT_EWA_PERSONA_ID;
		const persona = getEwaPersonaById(personaId);
		return args.ru ? persona.displayNameRu : persona.displayNameEn;
	}
	const fromTransform = args.transformPersonaName?.trim();
	if (fromTransform) return fromTransform;
	return args.ru ? 'Компаньон' : 'Companion';
}
