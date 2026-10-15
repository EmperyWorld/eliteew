/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Context system enums: company size, subscription tier, analysis language, detail level.
 *
 * Invariants:
 * - Enum string values synced with backend ContextSchema (Pydantic).
 *
 * Related:
 * - ../context.ts (stable facade barrel)
 * - ./models.ts, ./schemas.ts
 */

export enum CompanySize {
	SOLO = 'solo',
	STARTUP = 'startup',
	SMALL = 'small',
	MEDIUM = 'medium',
	LARGE = 'large',
	ENTERPRISE = 'enterprise',
	UNKNOWN = 'Unknown',
}

/**
 * Subscription tier levels
 */
export enum SubscriptionTier {
	FREE = 'free',
	STARTER = 'starter',
	PROFESSIONAL = 'professional',
	ENTERPRISE = 'enterprise',
}

/**
 * Analysis language
 */
export enum AnalysisLanguage {
	RUSSIAN = 'russian',
	ENGLISH = 'english',
}

/**
 * Detail level for analysis
 */
export enum DetailLevel {
	BRIEF = 'brief',
	STANDARD = 'standard',
	DETAILED = 'detailed',
}
