/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Type guards for ContextData and derived context predicates.
 *
 * Invariants:
 * - Guards delegate to ContextDataSchema.safeParse for runtime checks.
 *
 * Related:
 * - ../context.ts (stable facade barrel)
 * - ./models.ts, ./schemas.ts
 */

import type { ContextData } from './models';
import { ContextDataSchema } from './schemas';

export function isContextData(data: unknown): data is ContextData {
	const result = ContextDataSchema.safeParse(data);
	return result.success;
}

/**
 * Type guard for high-quality context (score >= 80)
 *
 * @example
 * ```typescript
 * if (isHighQualityContext(context)) {
 *   log.info('High quality context:', context.context_quality_score);
 * }
 * ```
 */
export function isHighQualityContext(
	context: ContextData
): context is ContextData & { context_quality_score: number } {
	return context.context_quality_score >= 80;
}

/**
 * Type guard for enterprise company
 *
 * @example
 * ```typescript
 * if (isEnterpriseCompany(context)) {
 *   log.info('Enterprise customer:', context.company_name);
 * }
 * ```
 */
export function isEnterpriseCompany(
	context: ContextData
): context is ContextData & { is_enterprise: true } {
	return context.is_enterprise === true;
}

/**
 * Type guard for premium subscription
 *
 * @example
 * ```typescript
 * if (isPremiumSubscription(context)) {
 *   log.info('Premium tier:', context.subscription_tier);
 * }
 * ```
 */
export function isPremiumSubscription(
	context: ContextData
): context is ContextData & { is_premium: true } {
	return context.is_premium === true;
}

/**
 * Type guard for context with project
 *
 * @example
 * ```typescript
 * if (hasProject(context)) {
 *   log.info('Project:', context.project_name);
 *   log.info('Goal:', context.project_goal);
 * }
 * ```
 */
export function hasProject(context: ContextData): context is ContextData & {
	has_project: true;
	project_id: string | number;
	project_name: string;
} {
	return (
		context.has_project === true &&
		!!context.project_id &&
		!!context.project_name
	);
}
