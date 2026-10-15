/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Canonical TEMPLATE_VARIABLES metadata array for context template rendering.
 *
 * Invariants:
 * - Variable keys match contextToTemplateVariables and backend template engine.
 *
 * Related:
 * - ../context.ts (stable facade barrel)
 * - ./models.ts (TemplateVariable type)
 */

import type { TemplateVariable } from './models';

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
	// Company variables
	{
		key: 'company_name',
		display_name: 'Company Name',
		description: 'Name of the company',
		example: 'TechCorp Inc.',
		required: true,
		category: 'company',
		type: 'string',
		default_value: 'Unknown Company',
	},
	{
		key: 'industry',
		display_name: 'Industry',
		description: 'Industry sector',
		example: 'SaaS',
		required: false,
		category: 'company',
		type: 'string',
		default_value: 'Unknown Industry',
	},
	{
		key: 'company_size',
		display_name: 'Company Size',
		description: 'Size category (solo/small/medium/large/enterprise)',
		example: 'medium',
		required: false,
		category: 'company',
		type: 'string',
		default_value: 'Unknown',
	},
	{
		key: 'company_description',
		display_name: 'Company Description',
		description: 'Brief description of the company',
		example: 'Leading B2B SaaS provider for enterprise IT management',
		required: false,
		category: 'company',
		type: 'string',
	},
	{
		key: 'company_website',
		display_name: 'Company Website',
		description: 'Company website URL',
		example: 'https://techcorp.com',
		required: false,
		category: 'company',
		type: 'string',
	},
	{
		key: 'company_country',
		display_name: 'Company Country',
		description: 'Country where company is located',
		example: 'United States',
		required: false,
		category: 'company',
		type: 'string',
	},

	// Project variables
	{
		key: 'project_name',
		display_name: 'Project Name',
		description: 'Name of the project',
		example: 'Product Launch Q1 2025',
		required: false,
		category: 'project',
		type: 'string',
	},
	{
		key: 'project_goal',
		display_name: 'Project Goal',
		description: 'Project objective or goal',
		example: 'Launch new enterprise product to capture Fortune 500 market',
		required: false,
		category: 'project',
		type: 'string',
	},
	{
		key: 'project_description',
		display_name: 'Project Description',
		description: 'Detailed project description',
		example: 'Development and launch of AI-powered analytics platform',
		required: false,
		category: 'project',
		type: 'string',
	},

	// Business context variables
	{
		key: 'target_audience',
		display_name: 'Target Audience',
		description: 'Target customer segment or audience',
		example: 'Enterprise IT managers in Fortune 500 companies',
		required: false,
		category: 'business',
		type: 'string',
	},
	{
		key: 'business_model',
		display_name: 'Business Model',
		description: 'How the business makes money',
		example: 'Subscription-based SaaS with tiered pricing',
		required: false,
		category: 'business',
		type: 'string',
	},
	{
		key: 'value_proposition',
		display_name: 'Value Proposition',
		description: 'Unique value offered to customers',
		example: 'Reduce IT operational costs by 40% through automation',
		required: false,
		category: 'business',
		type: 'string',
	},
	{
		key: 'market_position',
		display_name: 'Market Position',
		description: 'Position in the market',
		example: 'Market leader in enterprise IT management',
		required: false,
		category: 'business',
		type: 'string',
	},

	// Derived variables
	{
		key: 'is_enterprise',
		display_name: 'Is Enterprise',
		description: 'Whether company is enterprise-scale',
		example: 'true',
		required: false,
		category: 'derived',
		type: 'boolean',
	},
	{
		key: 'is_premium',
		display_name: 'Is Premium',
		description: 'Whether company has premium subscription',
		example: 'true',
		required: false,
		category: 'derived',
		type: 'boolean',
	},
];
