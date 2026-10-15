/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Context quality scoring, summary formatting, and template variable mapping.
 *
 * Invariants:
 * - Quality score formula and summary templates unchanged from monolith.
 *
 * Related:
 * - ../context.ts (stable facade barrel)
 * - ./models.ts
 */

import type { ContextData } from './models';

export function calculateContextQuality(context: Partial<ContextData>): number {
	const importantFields = [
		'company_name',
		'industry',
		'company_description',
		'project_name',
		'project_description',
		'target_audience',
		'business_model',
		'value_proposition',
	];

	const filledFields = importantFields.filter((field) => {
		const value = context[field as keyof ContextData];
		return value !== undefined && value !== null && value !== '';
	}).length;

	return Math.round((filledFields / importantFields.length) * 100 * 100) / 100;
}

/**
 * Get missing context fields
 *
 * Returns list of important fields that are missing
 *
 * @param context - Context data to check
 * @returns Array of missing field names
 *
 * @example
 * ```typescript
 * const missing = getMissingContextFields(context);
 * log.info('Missing:', missing); // ['target_audience', 'business_model']
 * ```
 */
export function getMissingContextFields(
	context: Partial<ContextData>
): string[] {
	const importantFields = [
		'company_name',
		'industry',
		'company_description',
		'project_name',
		'project_description',
		'target_audience',
		'business_model',
		'value_proposition',
	];

	return importantFields.filter((field) => {
		const value = context[field as keyof ContextData];
		return value === undefined || value === null || value === '';
	});
}

/**
 * Format context summary
 *
 * Creates human-readable context summary
 *
 * @param context - Context data
 * @param format - Output format ('markdown' | 'text')
 * @returns Formatted summary string
 *
 * @example
 * ```typescript
 * const summary = formatContextSummary(context, 'markdown');
 * log.info(summary);
 * // # Company Context
 * // - **Company:** TechCorp Inc.
 * // - **Industry:** SaaS
 * // - **Size:** medium
 * ```
 */
export function formatContextSummary(
	context: ContextData,
	format: 'markdown' | 'text' = 'markdown'
): string {
	if (format === 'markdown') {
		return `
# Context Summary

## Company
- **Name:** ${context.company_name}
- **Industry:** ${context.industry}
- **Size:** ${context.company_size}
${context.company_description ? `- **Description:** ${context.company_description}` : ''}
${context.company_website ? `- **Website:** ${context.company_website}` : ''}
${context.company_country ? `- **Country:** ${context.company_country}` : ''}

## Project
${context.project_name ? `- **Name:** ${context.project_name}` : '- No project specified'}
${context.project_description ? `- **Description:** ${context.project_description}` : ''}
${context.project_goal ? `- **Goal:** ${context.project_goal}` : ''}

## Business Context
${context.target_audience ? `- **Target Audience:** ${context.target_audience}` : ''}
${context.business_model ? `- **Business Model:** ${context.business_model}` : ''}
${context.value_proposition ? `- **Value Proposition:** ${context.value_proposition}` : ''}
${context.key_competitors?.length ? `- **Competitors:** ${context.key_competitors.join(', ')}` : ''}

## Metrics
- **Quality Score:** ${context.context_quality_score}%
${context.missing_fields.length ? `- **Missing Fields:** ${context.missing_fields.join(', ')}` : '- **Status:** Complete ?'}
    `.trim();
	} else {
		return `Context Summary:
- Company: ${context.company_name}
- Industry: ${context.industry}
- Size: ${context.company_size}
- Project: ${context.project_name || 'N/A'}
- Quality: ${context.context_quality_score}%
    `.trim();
	}
}

/**
 * Convert context to template variables map
 *
 * Creates key-value map for template rendering
 *
 * @param context - Context data
 * @returns Template variables object
 *
 * @example
 * ```typescript
 * const vars = contextToTemplateVariables(context);
 * // { company_name: 'TechCorp', industry: 'SaaS', ... }
 * ```
 */
export function contextToTemplateVariables(
	context: ContextData
): Record<string, string> {
	return {
		company_name: context.company_name || '',
		industry: context.industry || '',
		company_size: context.company_size || '',
		company_description: context.company_description || '',
		company_website: context.company_website || '',
		company_country: context.company_country || '',
		project_name: context.project_name || '',
		project_goal: context.project_goal || '',
		project_description: context.project_description || '',
		target_audience: context.target_audience || '',
		business_model: context.business_model || '',
		value_proposition: context.value_proposition || '',
		market_position: context.market_position || '',
	};
}
