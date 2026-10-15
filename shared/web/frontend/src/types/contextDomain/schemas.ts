/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod runtime validation schemas for context system API payloads.
 *
 * Invariants:
 * - Schema defaults and nullable fields match validateContext null→undefined coercion.
 *
 * Related:
 * - ../context.ts (stable facade barrel)
 * - ./enums.ts (parallel enum literals in z.enum)
 */

import { z } from 'zod';

export const CompanySizeSchema = z.enum([
	'solo',
	'startup',
	'small',
	'medium',
	'large',
	'enterprise',
	'Unknown',
]);

/**
 * Subscription tier validation schema
 */
export const SubscriptionTierSchema = z.enum([
	'free',
	'starter',
	'professional',
	'enterprise',
]);

/**
 * Analysis language validation schema
 */
export const AnalysisLanguageSchema = z.enum(['russian', 'english']);

/**
 * Detail level validation schema
 */
export const DetailLevelSchema = z.enum(['brief', 'standard', 'detailed']);

/**
 * Context data validation schema
 *
 * Validates complete context structure at runtime
 *
 * @example
 * ```typescript
 * const result = ContextDataSchema.safeParse(apiResponse);
 * if (result.success) {
 *   log.info('Valid context:', result.data.company_name);
 *   log.info('Quality:', result.data.context_quality_score);
 * } else {
 *   log.error('Validation errors:', result.error.issues);
 * }
 * ```
 */
export const ContextDataSchema = z
	.object({
		// Company fields
		company_id: z.union([z.string(), z.number()]).optional(),
		company_name: z.string().min(1).default('Unknown Company'),
		industry: z.string().default('Unknown Industry'),
		company_size: z.union([CompanySizeSchema, z.string()]).default('Unknown'),
		company_description: z.string().optional(),
		company_website: z.string().url().optional().nullable(),
		company_country: z.string().optional().nullable(),
		subscription_tier: z
			.union([SubscriptionTierSchema, z.string()])
			.default('free'),

		// Project fields
		project_id: z.union([z.string(), z.number()]).optional().nullable(),
		project_name: z.string().optional().nullable(),
		project_description: z.string().optional().nullable(),
		project_goal: z.string().optional().nullable(),
		project_category: z.string().optional().nullable(),
		project_tags: z.array(z.string()).optional().default([]),

		// Business context
		target_audience: z.string().optional().nullable(),
		business_model: z.string().optional().nullable(),
		key_competitors: z.array(z.string()).optional().default([]),
		value_proposition: z.string().optional().nullable(),
		market_position: z.string().optional().nullable(),

		// Analysis settings
		language: z
			.union([AnalysisLanguageSchema, z.string()])
			.optional()
			.default('russian'),
		detail_level: z
			.union([DetailLevelSchema, z.string()])
			.optional()
			.default('detailed'),

		// Derived fields
		is_enterprise: z.boolean().default(false),
		is_premium: z.boolean().default(false),
		has_project: z.boolean().default(false),
		context_quality_score: z.number().min(0).max(100).default(0),
		missing_fields: z.array(z.string()).default([]),

		// Timestamps
		created_at: z.string().datetime(),
	})
	.passthrough(); // Allow additional fields

/**
 * Context validation result schema
 */
export const ContextValidationResultSchema = z.object({
	valid: z.boolean(),
	context: ContextDataSchema.optional(),
	quality_score: z.number().min(0).max(100),
	missing_fields: z.array(z.string()),
	warnings: z.array(z.string()),
	errors: z.array(z.string()),
});

/**
 * Build context request schema
 */
export const BuildContextRequestSchema = z.object({
	company_id: z.union([z.number(), z.string()]).optional(),
	project_id: z.union([z.number(), z.string()]).optional(),
	additional_context: z.record(z.string(), z.unknown()).optional(),
	force_refresh: z.boolean().optional().default(false),
});

/**
 * Build context response schema
 */
export const BuildContextResponseSchema = z.object({
	context: ContextDataSchema,
	from_cache: z.boolean(),
	cache_key: z.string().optional(),
	processing_time_ms: z.number().min(0),
});

/**
 * Template variable schema
 */
export const TemplateVariableSchema = z.object({
	key: z.string().min(1),
	display_name: z.string().min(1),
	description: z.string().optional(),
	example: z.string().optional(),
	required: z.boolean().optional(),
	category: z
		.enum(['company', 'project', 'business', 'analysis', 'derived'])
		.optional(),
	type: z.enum(['string', 'number', 'boolean', 'array', 'object']).optional(),
	default_value: z.string().optional(),
});

/**
 * Cache statistics schema
 */
export const CacheStatsSchema = z.object({
	total_keys: z.number().min(0),
	hits: z.number().min(0),
	misses: z.number().min(0),
	hit_rate: z.number().min(0).max(100),
	avg_cache_query_ms: z.number().min(0),
	avg_db_query_ms: z.number().min(0),
	time_saved_seconds: z.number().min(0),
	effectiveness: z.enum(['excellent', 'good', 'fair', 'poor']),
});

/**
 * Pipeline health metrics schema
 */
export const PipelineHealthMetricsSchema = z.object({
	total_queries: z.number().min(0),
	avg_query_time_ms: z.number().min(0),
	cache_hit_rate: z.number().min(0).max(100),
	error_rate: z.number().min(0).max(100),
	uptime_seconds: z.number().min(0),
	status: z.enum(['healthy', 'degraded', 'critical']),
	alerts: z.array(z.string()),
	started_at: z.string().datetime(),
});
