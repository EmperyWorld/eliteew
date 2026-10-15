/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed HTTP client for **`/api/v1/ewa/companion-plans/*`** — active plan bundle and light-write task
 * completion / overlay PATCH (server-first companion plans; no roadmap constructor on the client).
 *
 * Invariants:
 * - Uses `apiClient` + `API_OPTIONS` (same Bearer as companion profile/chat).
 * - **404** with `companion_plans_disabled` means the feature flag is OFF — callers should hide the strip.
 * - **200** with `plan: null` is the normal empty state when the feature is ON but no active plan exists.
 * - HTTP generics use OpenAPI aliases from `ewaOpenApi.ts`; `normalizeEwaCompanionPlanBundle` ensures required arrays.
 *
 * Related:
 * - shared/api/ewa_platform/gateways/routers/companion_plans.py
 * - documentation/product/ewa/EWA-COMPANION-SERVER-PLANS-ADR.md
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/services/ewa/ewaOpenApi.ts
 */
import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';
import { APIError, apiClient } from '@/services/api/client';
import {
	cacheCompanionPlansFeatureProbeState,
	readCompanionPlansFeatureProbeState,
} from '@/services/ewa/companionPlansFeatureProbe';
import { isAxiosError } from 'axios';

import type {
	CompanionPlanBundleOut,
	CompanionPlanGoalOut,
	CompanionPlanOut,
	CompanionPlanTaskOut,
} from './ewaOpenApi';

export const EWA_COMPANION_PLANS_ACTIVE_PATH =
	'/ewa/companion-plans/active' as const;

export type EwaCompanionPlan = CompanionPlanOut;
export type EwaCompanionPlanGoal = CompanionPlanGoalOut;
export type EwaCompanionPlanTask = CompanionPlanTaskOut;

/** Normalized bundle — `goals` and `tasks` always arrays after normalize. */
export type EwaCompanionPlanBundle = {
	plan: CompanionPlanOut | null;
	goals: CompanionPlanGoalOut[];
	tasks: CompanionPlanTaskOut[];
};

export const EMPTY_EWA_COMPANION_PLAN_BUNDLE: EwaCompanionPlanBundle = {
	plan: null,
	goals: [],
	tasks: [],
};

export type GetEwaCompanionActivePlanOptions = {
	cacheBust?: boolean;
};

function extractNestedDetailCode(payload: unknown): string | null {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return null;
	}
	const row = payload as {
		code?: unknown;
		detail?: unknown;
		error?: unknown;
	};
	if (typeof row.code === 'string' && row.code.trim()) {
		return row.code.trim();
	}
	const detail = row.detail;
	if (typeof detail === 'string' && detail.trim()) {
		return detail.trim();
	}
	if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
		const nested = detail as { code?: unknown };
		if (typeof nested.code === 'string' && nested.code.trim()) {
			return nested.code.trim();
		}
	}
	const errorField = row.error;
	if (
		errorField &&
		typeof errorField === 'object' &&
		!Array.isArray(errorField)
	) {
		const nested = errorField as { code?: unknown };
		if (typeof nested.code === 'string' && nested.code.trim()) {
			return nested.code.trim();
		}
	}
	return null;
}

function extractHttpStatus(error: unknown): number | undefined {
	if (error instanceof APIError) return error.statusCode;
	if (isAxiosError(error)) return error.response?.status;
	return undefined;
}

function extractDetailCode(error: unknown): string | null {
	if (error instanceof APIError) {
		const fromCode =
			typeof error.errorCode === 'string' ? error.errorCode.trim() : '';
		if (fromCode) return fromCode;
		const fromPayload = extractNestedDetailCode(error.details);
		if (fromPayload) return fromPayload;
		const detail = error.details;
		if (typeof detail === 'string') return detail.trim() || null;
	}
	if (isAxiosError(error)) {
		const fromPayload = extractNestedDetailCode(error.response?.data);
		if (fromPayload) return fromPayload;
	}
	return null;
}

/** Feature flag OFF (`EWA_COMPANION_PLAN_ENABLED=0`) — hide companion plan UI. */
export function isCompanionPlansFeatureDisabledError(error: unknown): boolean {
	if (extractHttpStatus(error) !== 404) return false;
	const code = extractDetailCode(error);
	return code === 'companion_plans_disabled';
}

/** Feature ON but the principal has no active plan yet. */
export function isCompanionPlansNoActivePlanError(error: unknown): boolean {
	if (extractHttpStatus(error) !== 404) return false;
	const code = extractDetailCode(error);
	return code === 'no_active_plan' || code === 'plan_not_found';
}

/** Opaque prod 404 (route drift / nginx) — not an empty active plan. */
export function isCompanionPlansOpaque404Error(error: unknown): boolean {
	if (extractHttpStatus(error) !== 404) return false;
	if (isCompanionPlansNoActivePlanError(error)) return false;
	if (isCompanionPlansFeatureDisabledError(error)) return false;
	return true;
}

export async function getEwaCompanionActivePlan(
	options?: GetEwaCompanionActivePlanOptions
): Promise<EwaCompanionPlanBundle> {
	if (readCompanionPlansFeatureProbeState() === 'disabled') {
		return EMPTY_EWA_COMPANION_PLAN_BUNDLE;
	}
	try {
		const res = await apiClient.get<CompanionPlanBundleOut>(
			EWA_COMPANION_PLANS_ACTIVE_PATH,
			{
				...API_OPTIONS,
				...(options?.cacheBust
					? {
							params: { _ewa_plan: Date.now() },
							headers: {
								'Cache-Control': 'no-cache',
								Pragma: 'no-cache',
							},
						}
					: {}),
			}
		);
		const bundle = normalizeEwaCompanionPlanBundle(res.data);
		cacheCompanionPlansFeatureProbeState('enabled');
		return bundle;
	} catch (error) {
		if (isCompanionPlansNoActivePlanError(error)) {
			cacheCompanionPlansFeatureProbeState('enabled');
			return EMPTY_EWA_COMPANION_PLAN_BUNDLE;
		}
		if (
			isCompanionPlansFeatureDisabledError(error) ||
			isCompanionPlansOpaque404Error(error)
		) {
			cacheCompanionPlansFeatureProbeState('disabled');
			return EMPTY_EWA_COMPANION_PLAN_BUNDLE;
		}
		throw error;
	}
}

export function normalizeEwaCompanionPlanBundle(
	raw: CompanionPlanBundleOut | unknown
): EwaCompanionPlanBundle {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return EMPTY_EWA_COMPANION_PLAN_BUNDLE;
	}
	const row = raw as CompanionPlanBundleOut;
	if (!row.plan) return EMPTY_EWA_COMPANION_PLAN_BUNDLE;
	return {
		plan: row.plan,
		goals: Array.isArray(row.goals) ? row.goals : [],
		tasks: Array.isArray(row.tasks) ? row.tasks : [],
	};
}

export async function completeEwaCompanionPlanTask(
	taskId: string
): Promise<EwaCompanionPlanBundle> {
	const res = await apiClient.post<CompanionPlanBundleOut>(
		`/ewa/companion-plans/tasks/${encodeURIComponent(taskId)}/complete`,
		{},
		API_OPTIONS
	);
	return normalizeEwaCompanionPlanBundle(res.data);
}

export const EWA_COMPANION_PLANS_TASK_PATH =
	'/ewa/companion-plans/tasks' as const;

export type EwaCompanionPlanTaskPatch = {
	title?: string;
	description?: string | null;
	due_date?: string | null;
	due_time?: string | null;
	due_duration_minutes?: number | null;
	all_day?: boolean;
};

export async function updateEwaCompanionPlanTask(
	taskId: string,
	patch: EwaCompanionPlanTaskPatch
): Promise<EwaCompanionPlanBundle> {
	const res = await apiClient.patch<CompanionPlanBundleOut>(
		`${EWA_COMPANION_PLANS_TASK_PATH}/${encodeURIComponent(taskId)}`,
		patch,
		API_OPTIONS
	);
	return normalizeEwaCompanionPlanBundle(res.data);
}

export async function archiveEwaCompanionActivePlan(): Promise<EwaCompanionPlanBundle> {
	const res = await apiClient.post<CompanionPlanBundleOut>(
		'/ewa/companion-plans/active/archive',
		{},
		API_OPTIONS
	);
	return normalizeEwaCompanionPlanBundle(res.data);
}
