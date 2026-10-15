/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Context validation helpers with null→undefined coercion for nullable fields.
 *
 * Invariants:
 * - validateContext / validateContextWithErrors coercion must remain byte-identical.
 *
 * Related:
 * - ../context.ts (stable facade barrel)
 * - ./models.ts, ./schemas.ts
 */

import { z } from 'zod';

import type { BuildContextRequest, CacheStats, ContextData } from './models';
import {
	BuildContextRequestSchema,
	CacheStatsSchema,
	ContextDataSchema,
} from './schemas';

export function validateContext(data: unknown): ContextData | null {
	const result = ContextDataSchema.safeParse(data);
	if (!result.success) {
		return null;
	}
	// Convert null to undefined for all nullable fields to match ContextData type
	const validatedData = {
		...result.data,
		company_website:
			result.data.company_website === null
				? undefined
				: result.data.company_website,
		company_country:
			result.data.company_country === null
				? undefined
				: result.data.company_country,
		project_id:
			result.data.project_id === null ? undefined : result.data.project_id,
		project_name:
			result.data.project_name === null ? undefined : result.data.project_name,
		project_description:
			result.data.project_description === null
				? undefined
				: result.data.project_description,
		project_goal:
			result.data.project_goal === null ? undefined : result.data.project_goal,
		project_category:
			result.data.project_category === null
				? undefined
				: result.data.project_category,
		target_audience:
			result.data.target_audience === null
				? undefined
				: result.data.target_audience,
		business_model:
			result.data.business_model === null
				? undefined
				: result.data.business_model,
		value_proposition:
			result.data.value_proposition === null
				? undefined
				: result.data.value_proposition,
		market_position:
			result.data.market_position === null
				? undefined
				: result.data.market_position,
	} as ContextData;
	return validatedData;
}

/**
 * Validate context with detailed errors
 *
 * @param data - Unknown data to validate
 * @returns Validation result with errors
 *
 * @example
 * ```typescript
 * const result = validateContextWithErrors(apiResponse);
 * if (result.valid) {
 *   log.info('Valid:', result.data);
 * } else {
 *   log.error('Errors:', result.errors);
 * }
 * ```
 */
export function validateContextWithErrors(
	data: unknown
): { valid: true; data: ContextData } | { valid: false; errors: z.ZodIssue[] } {
	const result = ContextDataSchema.safeParse(data);
	if (result.success) {
		// Convert null to undefined for all nullable fields to match ContextData type
		const validatedData = {
			...result.data,
			company_website:
				result.data.company_website === null
					? undefined
					: result.data.company_website,
			company_country:
				result.data.company_country === null
					? undefined
					: result.data.company_country,
			project_id:
				result.data.project_id === null ? undefined : result.data.project_id,
			project_name:
				result.data.project_name === null
					? undefined
					: result.data.project_name,
			project_description:
				result.data.project_description === null
					? undefined
					: result.data.project_description,
			project_goal:
				result.data.project_goal === null
					? undefined
					: result.data.project_goal,
			project_category:
				result.data.project_category === null
					? undefined
					: result.data.project_category,
			target_audience:
				result.data.target_audience === null
					? undefined
					: result.data.target_audience,
			business_model:
				result.data.business_model === null
					? undefined
					: result.data.business_model,
			value_proposition:
				result.data.value_proposition === null
					? undefined
					: result.data.value_proposition,
			market_position:
				result.data.market_position === null
					? undefined
					: result.data.market_position,
		} as ContextData;
		return { valid: true, data: validatedData };
	} else {
		return { valid: false, errors: result.error.issues };
	}
}

/**
 * Validate build context request
 *
 * @param data - Request data to validate
 * @returns Validated request or null
 */
export function validateBuildContextRequest(
	data: unknown
): BuildContextRequest | null {
	const result = BuildContextRequestSchema.safeParse(data);
	return result.success ? result.data : null;
}

/**
 * Validate cache statistics
 *
 * @param data - Cache stats data to validate
 * @returns Validated cache stats or null
 */
export function validateCacheStats(data: unknown): CacheStats | null {
	const result = CacheStatsSchema.safeParse(data);
	return result.success ? result.data : null;
}
