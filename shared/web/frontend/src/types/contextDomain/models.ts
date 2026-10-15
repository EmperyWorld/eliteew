/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Context system TypeScript interfaces and types (ContextData through ContextMetricsDashboard).
 *
 * Invariants:
 * - Public shape matches backend context builder and metrics pipeline contracts.
 *
 * Related:
 * - ../context.ts (stable facade barrel)
 * - ./enums.ts
 */

import type {
	AnalysisLanguage,
	CompanySize,
	DetailLevel,
	SubscriptionTier,
} from './enums';

export interface ContextData {
	// ========================================
	// COMPANY FIELDS
	// ========================================

	/** Company UUID (optional - may be integer in some deployments) */
	company_id?: string | number;

	/** Company name (required, min 1 char) */
	company_name: string;

	/** Industry sector (default: 'Unknown Industry') */
	industry: string;

	/** Company size category */
	company_size: CompanySize | string;

	/** Company description (optional, from metadata) */
	company_description?: string;

	/** Company website URL (optional) */
	company_website?: string;

	/** Company country (optional) */
	company_country?: string;

	/** Subscription tier level */
	subscription_tier: SubscriptionTier | string;

	// ========================================
	// PROJECT FIELDS
	// ========================================

	/** Project UUID (optional) */
	project_id?: string | number;

	/** Project name (optional) */
	project_name?: string;

	/** Project description (optional) */
	project_description?: string;

	/** Project goal/objective (optional, from metadata) */
	project_goal?: string;

	/** Project category (optional) */
	project_category?: string;

	/** Project tags (optional) */
	project_tags?: string[];

	// ========================================
	// BUSINESS CONTEXT
	// ========================================

	/** Target audience/customer segment (optional) */
	target_audience?: string;

	/** Business model (e.g., 'B2B SaaS', 'Marketplace', 'E-commerce') */
	business_model?: string;

	/** Key competitors list (optional) */
	key_competitors?: string[];

	/** Value proposition (optional) */
	value_proposition?: string;

	/** Market position (optional) */
	market_position?: string;

	// ========================================
	// ANALYSIS SETTINGS
	// ========================================

	/** Analysis language (default: 'russian') */
	language?: AnalysisLanguage | string;

	/** Detail level (default: 'detailed') */
	detail_level?: DetailLevel | string;

	// ========================================
	// DERIVED FIELDS (AUTO-CALCULATED)
	// ========================================

	/** Is enterprise company (large/enterprise size) */
	is_enterprise: boolean;

	/** Has premium subscription (professional/enterprise tier) */
	is_premium: boolean;

	/** Has associated project */
	has_project: boolean;

	/** Context completeness score (0-100) */
	context_quality_score: number;

	/** List of missing important fields */
	missing_fields: string[];

	// ========================================
	// TIMESTAMPS
	// ========================================

	/** Context creation timestamp (ISO 8601) */
	created_at: string;

	/** Additional metadata (allow extra fields) */
	[key: string]: unknown;
}

/**
 * Partial context data for updates
 */
export type ContextDataPartial = Partial<ContextData>;

/**
 * Context data for creation (minimal required fields)
 */
export interface ContextDataCreate {
	company_name: string;
	industry?: string;
	company_size?: CompanySize | string;
	subscription_tier?: SubscriptionTier | string;
}

// ============================================================================
// CONTEXT VALIDATION RESULT
// ============================================================================

/**
 * Context validation result
 *
 * Returned after validating context with ContextBuilder
 *
 * @example
 * ```typescript
 * const validation: ContextValidationResult = {
 *   valid: true,
 *   context: contextData,
 *   quality_score: 87.5,
 *   missing_fields: [],
 *   warnings: ['Target audience not specified'],
 *   errors: []
 * };
 * ```
 */
export interface ContextValidationResult {
	/** Validation passed */
	valid: boolean;

	/** Validated context data (if valid) */
	context?: ContextData;

	/** Context quality score (0-100) */
	quality_score: number;

	/** List of missing important fields */
	missing_fields: string[];

	/** Non-critical warnings */
	warnings: string[];

	/** Critical validation errors (if invalid) */
	errors: string[];
}

// ============================================================================
// TEMPLATE VARIABLES
// ============================================================================

/**
 * Template variable definition
 *
 * Represents a single variable that can be used in templates
 *
 * @example
 * ```typescript
 * const variable: TemplateVariable = {
 *   key: 'company_name',
 *   display_name: 'Company Name',
 *   description: 'Name of the company',
 *   example: 'TechCorp Inc.',
 *   required: true,
 *   category: 'company'
 * };
 * ```
 */
export interface TemplateVariable {
	/** Variable key (used in template: {{key}}) */
	key: string;

	/** Human-readable display name */
	display_name: string;

	/** Description of the variable */
	description?: string;

	/** Example value */
	example?: string;

	/** Is this variable required */
	required?: boolean;

	/** Variable category (company/project/business) */
	category?: 'company' | 'project' | 'business' | 'analysis' | 'derived';

	/** Data type */
	type?: 'string' | 'number' | 'boolean' | 'array' | 'object';

	/** Default value if not provided */
	default_value?: string;
}

/**
 * Template rendering options
 */
export interface TemplateRenderOptions {
	/** Escape HTML/script tags for security */
	safe?: boolean;

	/** Allow missing variables (replace with empty string) */
	allow_missing?: boolean;

	/** Strict mode (throw on missing required variables) */
	strict?: boolean;

	/** Custom helper functions */
	helpers?: Record<string, (value: unknown) => string>;
}

/**
 * Template rendering result
 */
export interface TemplateRenderResult {
	/** Rendered template string */
	rendered: string;

	/** Variables that were replaced */
	replaced_variables: string[];

	/** Variables that were missing */
	missing_variables: string[];

	/** Errors during rendering (if any) */
	errors?: string[];
}

// ============================================================================
// CONTEXT BUILDER API TYPES
// ============================================================================

/**
 * Request to build context from IDs
 *
 * @example
 * ```typescript
 * const request: BuildContextRequest = {
 *   company_id: 123,
 *   project_id: 456,
 *   additional_context: {
 *     custom_field: 'value'
 *   }
 * };
 * ```
 */
export interface BuildContextRequest {
	/** Company ID (integer or UUID string) */
	company_id?: number | string;

	/** Project ID (integer or UUID string) */
	project_id?: number | string;

	/** Additional context to merge (optional) */
	additional_context?: Record<string, unknown>;

	/** Force cache refresh (bypass Redis cache) */
	force_refresh?: boolean;
}

/**
 * Response from building context
 */
export interface BuildContextResponse {
	/** Context data */
	context: ContextData;

	/** Was result from cache */
	from_cache: boolean;

	/** Cache key used */
	cache_key?: string;

	/** Processing time (ms) */
	processing_time_ms: number;
}

/**
 * Context summary request
 */
export interface ContextSummaryRequest {
	/** Company ID */
	company_id?: number | string;

	/** Project ID */
	project_id?: number | string;

	/** Output format */
	format?: 'markdown' | 'text' | 'json';
}

/**
 * Context summary response
 */
export interface ContextSummaryResponse {
	/** Summary text (markdown or plain text) */
	summary: string;

	/** Format used */
	format: 'markdown' | 'text' | 'json';

	/** Context data (if format=json) */
	context?: ContextData;
}

// ============================================================================
// CONTEXT CACHE TYPES
// ============================================================================

/**
 * Cache configuration
 */
export interface CacheConfig {
	/** Cache TTL in seconds (default: 3600 = 1 hour) */
	ttl_seconds: number;

	/** Cache key prefix (default: 'bi_context') */
	key_prefix: string;

	/** Enable cache warmup */
	enable_warmup: boolean;

	/** Warmup top N companies */
	warmup_top_n: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
	/** Total cache keys */
	total_keys: number;

	/** Cache hit count */
	hits: number;

	/** Cache miss count */
	misses: number;

	/** Cache hit rate percentage (0-100) */
	hit_rate: number;

	/** Average query time (cache hits, ms) */
	avg_cache_query_ms: number;

	/** Average query time (cache misses, ms) */
	avg_db_query_ms: number;

	/** Time saved by cache (seconds) */
	time_saved_seconds: number;

	/** Cache effectiveness rating */
	effectiveness: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Cache invalidation request
 */
export interface CacheInvalidateRequest {
	/** Company ID to invalidate */
	company_id?: number | string;

	/** Project ID to invalidate */
	project_id?: number | string;

	/** Invalidate all company contexts */
	invalidate_all_companies?: boolean;

	/** Invalidate all project contexts */
	invalidate_all_projects?: boolean;
}

/**
 * Cache invalidation response
 */
export interface CacheInvalidateResponse {
	/** Number of keys invalidated */
	keys_invalidated: number;

	/** Invalidation successful */
	success: boolean;

	/** Error message (if failed) */
	error?: string;
}

// ============================================================================
// CONTEXT METRICS TYPES
// ============================================================================

/**
 * Query metrics for monitoring
 */
export interface QueryMetrics {
	/** Query name/type */
	query_name: string;

	/** Total executions */
	total_executions: number;

	/** Total duration (ms) */
	total_duration_ms: number;

	/** Minimum duration (ms) */
	min_duration_ms: number;

	/** Maximum duration (ms) */
	max_duration_ms: number;

	/** Average duration (ms) */
	avg_duration_ms: number;

	/** P50 percentile (ms) */
	p50_duration_ms: number;

	/** P95 percentile (ms) */
	p95_duration_ms: number;

	/** P99 percentile (ms) */
	p99_duration_ms: number;

	/** Error count */
	error_count: number;

	/** Cache hits */
	cache_hits: number;

	/** Cache misses */
	cache_misses: number;

	/** Cache hit rate (%) */
	cache_hit_rate: number;

	/** Error rate (%) */
	error_rate: number;

	/** Last execution timestamp */
	last_execution_at?: string;
}

/**
 * Pipeline health metrics
 */
export interface PipelineHealthMetrics {
	/** Total queries executed */
	total_queries: number;

	/** Average query time (ms) */
	avg_query_time_ms: number;

	/** Cache hit rate (%) */
	cache_hit_rate: number;

	/** Error rate (%) */
	error_rate: number;

	/** Uptime (seconds) */
	uptime_seconds: number;

	/** Pipeline status */
	status: 'healthy' | 'degraded' | 'critical';

	/** Active alerts */
	alerts: string[];

	/** Started at timestamp */
	started_at: string;
}

/**
 * Context metrics dashboard data
 */
export interface ContextMetricsDashboard {
	/** Pipeline health */
	pipeline_health: PipelineHealthMetrics;

	/** Query metrics (by query name) */
	query_metrics: Record<string, QueryMetrics>;

	/** Redis metrics */
	redis_metrics: {
		connected_clients: number;
		used_memory_mb: number;
		total_keys: number;
		keyspace_hits: number;
		keyspace_misses: number;
		hit_rate: number;
		uptime_seconds: number;
	};

	/** Database metrics */
	database_metrics: {
		pool_stats: {
			size: number;
			free: number;
			in_use: number;
		};
		table_sizes: Array<{
			tablename: string;
			size: string;
		}>;
		active_queries: number;
	};

	/** Slow queries (top 5) */
	slow_queries: Array<{
		query_name: string;
		p95_duration_ms: number;
		avg_duration_ms: number;
		executions: number;
		cache_hit_rate: number;
	}>;

	/** Cache statistics */
	cache_statistics: {
		total_cache_hits: number;
		total_cache_misses: number;
		cache_hit_rate: number;
		time_saved_ms: number;
		time_saved_seconds: number;
		effectiveness: 'excellent' | 'good' | 'fair' | 'poor';
	};

	/** Dashboard generation timestamp */
	timestamp: string;
}
