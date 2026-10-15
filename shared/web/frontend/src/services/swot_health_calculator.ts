import { log } from '@utils/logger';
/**
 * SWOT Health Score Calculator
 *
 * Mathematically sound health score calculation for SWOT analyses with trend analysis.
 *
 * @module services/swot_health_calculator
 * @version 1.0.0
 * @date 2025-10-24
 *
 * @formula
 * Health Score = ((S + O - W - T) / Total × 50) + 50
 *
 * Where:
 * - S = number of strengths
 * - W = number of weaknesses
 * - O = number of opportunities
 * - T = number of threats
 * - Total = S + W + O + T
 *
 * @range 0-100
 * - 100 = Perfect (only S+O, no W+T)
 * - 50 = Neutral (perfect balance)
 * - 0 = Critical (only W+T, no S+O)
 *
 * @examples
 * ```typescript
 * const swot = { strengths: 5, weaknesses: 2, opportunities: 4, threats: 1 };
 * const result = calculateSWOTHealthScore(swot);
 * // result.score = 75 (excellent)
 * // result.level = 'excellent'
 * // result.color = '#10b981'
 *
 * // With trend analysis
 * const previousSwot = { strengths: 3, weaknesses: 3, opportunities: 2, threats: 2 };
 * const resultWithTrend = calculateSWOTHealthScore(swot, previousSwot);
 * // resultWithTrend.trend = 25 (improved by 25 points)
 * ```
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * SWOT metrics - counts of each category
 */
export interface SwotMetrics {
	/** Number of identified strengths */
	strengths: number;
	/** Number of identified weaknesses */
	weaknesses: number;
	/** Number of identified opportunities */
	opportunities: number;
	/** Number of identified threats */
	threats: number;
}

/**
 * Health score calculation result with all metadata
 */
export interface HealthScoreResult {
	/** Health score (0-100) */
	score: number;
	/** Categorical level based on score thresholds */
	level: 'excellent' | 'good' | 'fair' | 'poor';
	/** Color for UI visualization */
	color: string;
	/** Trend delta from previous analysis (if available) */
	trend?: number;
	/** Detailed breakdown of the calculation */
	breakdown: {
		/** Total positive factors (S + O) */
		positive: number;
		/** Total negative factors (W + T) */
		negative: number;
		/** Net balance (positive - negative) */
		balance: number;
		/** Total number of factors */
		total: number;
		/** Individual components */
		components: {
			strengths: number;
			weaknesses: number;
			opportunities: number;
			threats: number;
		};
	};
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
	/** Score change from previous analysis */
	scoreDelta: number;
	/** Percentage change from previous analysis */
	percentageChange: number;
	/** Human-readable interpretation */
	interpretation: string;
	/** Trend direction */
	direction: 'improving' | 'stable' | 'declining';
	/** Component-level changes */
	componentChanges: {
		strengths: number;
		weaknesses: number;
		opportunities: number;
		threats: number;
	};
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Health score thresholds and their visual representations
 */
export const HEALTH_THRESHOLDS = {
	excellent: {
		min: 70,
		color: '#10b981',
		description: 'Strong position with significant positive factors',
	},
	good: {
		min: 60,
		color: '#3b82f6',
		description: 'Favorable position with balanced factors',
	},
	fair: {
		min: 50,
		color: '#f59e0b',
		description: 'Neutral position requiring attention',
	},
	poor: {
		min: 0,
		color: '#ef4444',
		description: 'Challenging position needing immediate action',
	},
} as const;

/**
 * Trend interpretation thresholds
 */
const TREND_THRESHOLDS = {
	SIGNIFICANT_IMPROVEMENT: 10,
	SLIGHT_IMPROVEMENT: 5,
	STABLE: -5,
	SLIGHT_DECLINE: -10,
} as const;

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates SWOT metrics input
 *
 * @param swot - SWOT metrics to validate
 * @throws Error if validation fails
 */
function validateSwotMetrics(swot: SwotMetrics): void {
	const { strengths, weaknesses, opportunities, threats } = swot;

	// Check all values are numbers
	if (
		typeof strengths !== 'number' ||
		typeof weaknesses !== 'number' ||
		typeof opportunities !== 'number' ||
		typeof threats !== 'number'
	) {
		throw new Error('All SWOT metrics must be numbers');
	}

	// Check all values are non-negative
	if (strengths < 0 || weaknesses < 0 || opportunities < 0 || threats < 0) {
		throw new Error('All SWOT metrics must be non-negative');
	}

	// Check at least one value exists
	const total = strengths + weaknesses + opportunities + threats;
	if (total === 0) {
		throw new Error('SWOT analysis must have at least one factor');
	}

	// Check for reasonable limits (optional, prevents extreme values)
	if (total > 1000) {
		log.warn(
			'SwotHealth',
			'SWOT analysis has unusually high number of factors:',
			total
		);
	}
}

// ============================================================================
// CORE CALCULATION
// ============================================================================

/**
 * Calculates raw health score from SWOT metrics
 *
 * Formula: ((S + O - W - T) / Total × 50) + 50
 *
 * @param swot - SWOT metrics
 * @returns Score from 0 to 100
 */
function calculateRawScore(swot: SwotMetrics): number {
	const { strengths, weaknesses, opportunities, threats } = swot;

	const positive = strengths + opportunities;
	const negative = weaknesses + threats;
	const balance = positive - negative;
	const total = positive + negative;

	// Handle edge case: no factors
	if (total === 0) {
		return 50; // Neutral if no data
	}

	// Apply formula: (balance / total × 50) + 50
	const score = (balance / total) * 50 + 50;

	// Clamp to [0, 100] range for safety
	return Math.max(0, Math.min(100, score));
}

/**
 * Determines health level based on score
 *
 * @param score - Health score (0-100)
 * @returns Health level category
 */
function determineHealthLevel(
	score: number
): 'excellent' | 'good' | 'fair' | 'poor' {
	if (score >= HEALTH_THRESHOLDS.excellent.min) {
		return 'excellent';
	}
	if (score >= HEALTH_THRESHOLDS.good.min) {
		return 'good';
	}
	if (score >= HEALTH_THRESHOLDS.fair.min) {
		return 'fair';
	}
	return 'poor';
}

/**
 * Gets color for health level
 *
 * @param level - Health level
 * @returns Hex color code
 */
function getColorForLevel(
	level: 'excellent' | 'good' | 'fair' | 'poor'
): string {
	return HEALTH_THRESHOLDS[level].color;
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Calculates trend analysis between current and previous SWOT
 *
 * @param current - Current SWOT metrics
 * @param previous - Previous SWOT metrics
 * @returns Trend analysis result
 */
export function calculateTrend(
	current: SwotMetrics,
	previous: SwotMetrics
): TrendAnalysis {
	const currentScore = calculateRawScore(current);
	const previousScore = calculateRawScore(previous);
	const scoreDelta = currentScore - previousScore;

	// Calculate percentage change (avoid division by zero)
	const percentageChange =
		previousScore > 0 ? (scoreDelta / previousScore) * 100 : 0;

	// Determine direction
	let direction: 'improving' | 'stable' | 'declining';
	if (scoreDelta > TREND_THRESHOLDS.SLIGHT_IMPROVEMENT) {
		direction = 'improving';
	} else if (scoreDelta < TREND_THRESHOLDS.STABLE) {
		direction = 'declining';
	} else {
		direction = 'stable';
	}

	// Generate interpretation
	const interpretation = getInterpretation(scoreDelta);

	// Calculate component-level changes
	const componentChanges = {
		strengths: current.strengths - previous.strengths,
		weaknesses: current.weaknesses - previous.weaknesses,
		opportunities: current.opportunities - previous.opportunities,
		threats: current.threats - previous.threats,
	};

	return {
		scoreDelta,
		percentageChange,
		interpretation,
		direction,
		componentChanges,
	};
}

/**
 * Generates human-readable interpretation of score delta
 *
 * @param delta - Score change
 * @returns Interpretation string
 */
function getInterpretation(delta: number): string {
	if (delta >= TREND_THRESHOLDS.SIGNIFICANT_IMPROVEMENT) {
		return 'Significant improvement - strategic position strengthening rapidly';
	}
	if (delta >= TREND_THRESHOLDS.SLIGHT_IMPROVEMENT) {
		return 'Slight improvement - positive momentum in strategic position';
	}
	if (delta >= TREND_THRESHOLDS.STABLE) {
		return 'Stable position - strategic factors remain balanced';
	}
	if (delta >= TREND_THRESHOLDS.SLIGHT_DECLINE) {
		return 'Slight decline - some strategic challenges emerging';
	}
	return 'Significant decline - immediate strategic attention required';
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Calculates SWOT health score with optional trend analysis
 *
 * Main entry point for health score calculation. Validates input,
 * calculates score, determines level, and optionally analyzes trend.
 *
 * @param swot - Current SWOT metrics
 * @param previousSwot - Optional previous SWOT metrics for trend analysis
 * @returns Complete health score result
 *
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = calculateSWOTHealthScore({
 *   strengths: 5,
 *   weaknesses: 2,
 *   opportunities: 4,
 *   threats: 1
 * });
 * log.info(result.score); // 75
 * log.info(result.level); // 'excellent'
 *
 * // With trend analysis
 * const resultWithTrend = calculateSWOTHealthScore(
 *   { strengths: 5, weaknesses: 2, opportunities: 4, threats: 1 },
 *   { strengths: 3, weaknesses: 3, opportunities: 2, threats: 2 }
 * );
 * log.info(resultWithTrend.trend); // 25
 * ```
 */
export function calculateSWOTHealthScore(
	swot: SwotMetrics,
	previousSwot?: SwotMetrics
): HealthScoreResult {
	// Validate input
	validateSwotMetrics(swot);
	if (previousSwot) {
		validateSwotMetrics(previousSwot);
	}

	// Calculate raw score
	const score = calculateRawScore(swot);

	// Determine level and color
	const level = determineHealthLevel(score);
	const color = getColorForLevel(level);

	// Calculate breakdown
	const positive = swot.strengths + swot.opportunities;
	const negative = swot.weaknesses + swot.threats;
	const balance = positive - negative;
	const total = positive + negative;

	const breakdown = {
		positive,
		negative,
		balance,
		total,
		components: {
			strengths: swot.strengths,
			weaknesses: swot.weaknesses,
			opportunities: swot.opportunities,
			threats: swot.threats,
		},
	};

	// Calculate trend if previous data available
	const trend = previousSwot
		? calculateRawScore(swot) - calculateRawScore(previousSwot)
		: undefined;

	return {
		score: Math.round(score * 10) / 10, // Round to 1 decimal place
		level,
		color,
		trend: trend !== undefined ? Math.round(trend * 10) / 10 : undefined,
		breakdown,
	};
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extracts SWOT metrics from parsed analysis data
 *
 * Helper function to convert array-based SWOT data to metrics
 *
 * @param swotData - SWOT analysis with array data
 * @returns SWOT metrics
 *
 * @example
 * ```typescript
 * const swotData = {
 *   strengths: ['Strong team', 'Unique product', 'Market leader'],
 *   weaknesses: ['Limited budget'],
 *   opportunities: ['Growing market', 'New partnerships'],
 *   threats: ['Competition']
 * };
 *
 * const metrics = extractSwotMetrics(swotData);
 * // { strengths: 3, weaknesses: 1, opportunities: 2, threats: 1 }
 * ```
 */
export function extractSwotMetrics(swotData: {
	strengths: unknown[];
	weaknesses: unknown[];
	opportunities: unknown[];
	threats: unknown[];
}): SwotMetrics {
	return {
		strengths: Array.isArray(swotData.strengths)
			? swotData.strengths.length
			: 0,
		weaknesses: Array.isArray(swotData.weaknesses)
			? swotData.weaknesses.length
			: 0,
		opportunities: Array.isArray(swotData.opportunities)
			? swotData.opportunities.length
			: 0,
		threats: Array.isArray(swotData.threats) ? swotData.threats.length : 0,
	};
}

/**
 * Formats health score for display
 *
 * @param score - Health score
 * @returns Formatted score string
 *
 * @example
 * ```typescript
 * formatHealthScore(75.5); // "75.5"
 * formatHealthScore(100); // "100.0"
 * ```
 */
export function formatHealthScore(score: number): string {
	return score.toFixed(1);
}

/**
 * Gets description for health level
 *
 * @param level - Health level
 * @returns Description string
 */
export function getHealthDescription(
	level: 'excellent' | 'good' | 'fair' | 'poor'
): string {
	return HEALTH_THRESHOLDS[level].description;
}

/**
 * Calculates complete trend analysis
 *
 * Extended trend analysis with more detailed insights
 *
 * @param current - Current SWOT metrics
 * @param previous - Previous SWOT metrics
 * @returns Extended trend analysis
 */
export function calculateExtendedTrend(
	current: SwotMetrics,
	previous: SwotMetrics
): TrendAnalysis & { recommendations: string[] } {
	const trendAnalysis = calculateTrend(current, previous);
	const recommendations: string[] = [];

	// Generate recommendations based on changes
	if (trendAnalysis.componentChanges.strengths < 0) {
		recommendations.push(
			'Focus on maintaining and recovering lost competitive advantages'
		);
	}

	if (trendAnalysis.componentChanges.weaknesses > 0) {
		recommendations.push(
			'Address emerging weaknesses before they impact performance'
		);
	}

	if (trendAnalysis.componentChanges.opportunities < 0) {
		recommendations.push(
			'Proactively identify new market opportunities to replace lost ones'
		);
	}

	if (trendAnalysis.componentChanges.threats > 0) {
		recommendations.push(
			'Develop mitigation strategies for new threats in the market'
		);
	}

	if (recommendations.length === 0) {
		recommendations.push(
			'Continue current strategic approach while monitoring for changes'
		);
	}

	return {
		...trendAnalysis,
		recommendations,
	};
}
