/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read/merge structured Desktop AI Chat admin defaults form from JSONB blob.
 *
 * Related:
 * - documentation/product/DESKTOP-LLAMA-CHAT.md
 * - pages/Admin/kbsew/kbsewSearchSettings.ts
 * - api/services/desktop_chat/generation_budgets_settings.py
 */

import {
	countKbsewEnabledAgents,
	readKbsewSettingsFromDefaults,
	type KbsewSearchSettingsForm,
} from '../kbsew/kbsewSearchSettings';

export const DESKTOP_AI_CHAT_ROUTING_MODES = [
	'auto',
	'semi',
	'chat_only',
	'blueprint_only',
] as const;

export const DESKTOP_AI_CHAT_ENSEMBLE_ENGINES = [
	'blueprint',
	'legacy_freeform',
] as const;

export const DESKTOP_AI_CHAT_TOOL_ROUTER_MODES = [
	'shadow',
	'partial',
	'full',
] as const;

/** Align with api/services/desktop_chat/generation_budgets_settings.py */
export const GENERATION_BUDGET_LIMITS = {
	numPredict: { default: 98_304, lo: 256, hi: 131_072 },
	timeoutSec: { default: 300, lo: 30, hi: 600 },
	separateReply: { default: 32_768, lo: 128, hi: 98_304 },
	jointSection: { default: 40_960, lo: 128, hi: 98_304 },
	blueprintStep: { default: 40_960, lo: 512, hi: 98_304 },
} as const;

export type DesktopAiChatRoutingMode =
	(typeof DESKTOP_AI_CHAT_ROUTING_MODES)[number];
export type DesktopAiChatEnsembleEngine =
	(typeof DESKTOP_AI_CHAT_ENSEMBLE_ENGINES)[number];
export type DesktopAiChatToolRouterMode =
	(typeof DESKTOP_AI_CHAT_TOOL_ROUTER_MODES)[number];

export type DesktopAiChatDefaultsForm = {
	featureEnabled: boolean;
	voiceEnabled: boolean;
	toolsWebSearchEnabled: boolean;
	toolsFetchUrlEnabled: boolean;
	toolsImageEnabled: boolean;
	desktopToolRouterEnabled: boolean;
	defaultLlamaModel: string;
	desktopToolRouterMode: DesktopAiChatToolRouterMode;
	desktopEnsembleRoutingMode: DesktopAiChatRoutingMode;
	desktopEnsembleEngine: DesktopAiChatEnsembleEngine;
	fetchUrlAllowHosts: string;
	desktopChatNumPredict: number;
	desktopChatTimeoutSec: number;
	ensembleSeparateReplyMaxTokens: number;
	ensembleJointSectionMaxTokens: number;
	ensembleBlueprintStepMaxTokens: number;
};

function readBool(
	defaults: Record<string, unknown>,
	key: string,
	fallback: boolean
): boolean {
	if (!(key in defaults)) return fallback;
	return Boolean(defaults[key]);
}

function readString(
	defaults: Record<string, unknown>,
	key: string,
	fallback = ''
): string {
	const raw = defaults[key];
	return typeof raw === 'string' ? raw : fallback;
}

function readEnum<T extends string>(
	defaults: Record<string, unknown>,
	key: string,
	allowed: readonly T[],
	fallback: T
): T {
	const raw = readString(defaults, key, fallback).trim().toLowerCase();
	return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function readInt(
	defaults: Record<string, unknown>,
	key: string,
	fallback: number,
	lo: number,
	hi: number
): number {
	const raw = defaults[key];
	const n =
		typeof raw === 'number'
			? raw
			: typeof raw === 'string'
				? Number(raw)
				: Number.NaN;
	if (!Number.isFinite(n)) return fallback;
	return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

function readAllowHosts(defaults: Record<string, unknown>): string {
	const raw = defaults.fetch_url_allow_hosts;
	if (Array.isArray(raw)) {
		return raw
			.map((h) => String(h).trim())
			.filter(Boolean)
			.join('\n');
	}
	if (typeof raw === 'string') {
		return raw;
	}
	return '';
}

export function emptyDesktopAiChatDefaultsForm(): DesktopAiChatDefaultsForm {
	return {
		featureEnabled: true,
		voiceEnabled: true,
		toolsWebSearchEnabled: false,
		toolsFetchUrlEnabled: false,
		toolsImageEnabled: false,
		desktopToolRouterEnabled: false,
		defaultLlamaModel: '',
		desktopToolRouterMode: 'partial',
		desktopEnsembleRoutingMode: 'auto',
		desktopEnsembleEngine: 'blueprint',
		fetchUrlAllowHosts: '',
		desktopChatNumPredict: GENERATION_BUDGET_LIMITS.numPredict.default,
		desktopChatTimeoutSec: GENERATION_BUDGET_LIMITS.timeoutSec.default,
		ensembleSeparateReplyMaxTokens:
			GENERATION_BUDGET_LIMITS.separateReply.default,
		ensembleJointSectionMaxTokens:
			GENERATION_BUDGET_LIMITS.jointSection.default,
		ensembleBlueprintStepMaxTokens:
			GENERATION_BUDGET_LIMITS.blueprintStep.default,
	};
}

export function readDefaultsForm(
	defaults: Record<string, unknown>
): DesktopAiChatDefaultsForm {
	const g = GENERATION_BUDGET_LIMITS;
	return {
		featureEnabled: readBool(defaults, 'feature_enabled', true),
		voiceEnabled: readBool(defaults, 'voice_enabled', true),
		toolsWebSearchEnabled: readBool(
			defaults,
			'tools_web_search_enabled',
			false
		),
		toolsFetchUrlEnabled: readBool(defaults, 'tools_fetch_url_enabled', false),
		toolsImageEnabled: readBool(defaults, 'tools_image_enabled', false),
		desktopToolRouterEnabled: readBool(
			defaults,
			'desktop_tool_router_enabled',
			false
		),
		defaultLlamaModel: readString(defaults, 'default_llama_model'),
		desktopToolRouterMode: readEnum(
			defaults,
			'desktop_tool_router_mode',
			DESKTOP_AI_CHAT_TOOL_ROUTER_MODES,
			'partial'
		),
		desktopEnsembleRoutingMode: readEnum(
			defaults,
			'desktop_ensemble_routing_mode',
			DESKTOP_AI_CHAT_ROUTING_MODES,
			'auto'
		),
		desktopEnsembleEngine: readEnum(
			defaults,
			'desktop_ensemble_engine',
			DESKTOP_AI_CHAT_ENSEMBLE_ENGINES,
			'blueprint'
		),
		fetchUrlAllowHosts: readAllowHosts(defaults),
		desktopChatNumPredict: readInt(
			defaults,
			'desktop_chat_num_predict',
			g.numPredict.default,
			g.numPredict.lo,
			g.numPredict.hi
		),
		desktopChatTimeoutSec: readInt(
			defaults,
			'desktop_chat_timeout_sec',
			g.timeoutSec.default,
			g.timeoutSec.lo,
			g.timeoutSec.hi
		),
		ensembleSeparateReplyMaxTokens: readInt(
			defaults,
			'ensemble_separate_reply_max_tokens',
			g.separateReply.default,
			g.separateReply.lo,
			g.separateReply.hi
		),
		ensembleJointSectionMaxTokens: readInt(
			defaults,
			'ensemble_joint_section_max_tokens',
			g.jointSection.default,
			g.jointSection.lo,
			g.jointSection.hi
		),
		ensembleBlueprintStepMaxTokens: readInt(
			defaults,
			'ensemble_blueprint_step_max_tokens',
			g.blueprintStep.default,
			g.blueprintStep.lo,
			g.blueprintStep.hi
		),
	};
}

export function mergeDefaultsForm(
	base: Record<string, unknown>,
	form: DesktopAiChatDefaultsForm
): Record<string, unknown> {
	const hosts = form.fetchUrlAllowHosts
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
	const g = GENERATION_BUDGET_LIMITS;
	const clamp = (n: number, lo: number, hi: number) =>
		Math.min(hi, Math.max(lo, Math.trunc(n)));
	return {
		...base,
		feature_enabled: form.featureEnabled,
		voice_enabled: form.voiceEnabled,
		tools_web_search_enabled: form.toolsWebSearchEnabled,
		tools_fetch_url_enabled: form.toolsFetchUrlEnabled,
		tools_image_enabled: form.toolsImageEnabled,
		desktop_tool_router_enabled: form.desktopToolRouterEnabled,
		default_llama_model: form.defaultLlamaModel.trim() || undefined,
		desktop_tool_router_mode: form.desktopToolRouterMode,
		desktop_ensemble_routing_mode: form.desktopEnsembleRoutingMode,
		desktop_ensemble_engine: form.desktopEnsembleEngine,
		fetch_url_allow_hosts: hosts,
		desktop_chat_num_predict: clamp(
			form.desktopChatNumPredict,
			g.numPredict.lo,
			g.numPredict.hi
		),
		desktop_chat_timeout_sec: clamp(
			form.desktopChatTimeoutSec,
			g.timeoutSec.lo,
			g.timeoutSec.hi
		),
		ensemble_separate_reply_max_tokens: clamp(
			form.ensembleSeparateReplyMaxTokens,
			g.separateReply.lo,
			g.separateReply.hi
		),
		ensemble_joint_section_max_tokens: clamp(
			form.ensembleJointSectionMaxTokens,
			g.jointSection.lo,
			g.jointSection.hi
		),
		ensemble_blueprint_step_max_tokens: clamp(
			form.ensembleBlueprintStepMaxTokens,
			g.blueprintStep.lo,
			g.blueprintStep.hi
		),
	};
}

export function parseAdvancedDefaultsJson(
	text: string
): Record<string, unknown> {
	const parsed = JSON.parse(text) as unknown;
	if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new TypeError('defaults must be a JSON object');
	}
	return parsed as Record<string, unknown>;
}

export function readKbsewSummaryFromDefaults(
	defaults: Record<string, unknown>
): { form: KbsewSearchSettingsForm; enabledCount: number } {
	const form = readKbsewSettingsFromDefaults(defaults);
	return { form, enabledCount: countKbsewEnabledAgents(form) };
}
