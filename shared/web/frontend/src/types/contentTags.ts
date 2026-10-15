/**
 * ============================================
 * FILE: web/frontend/src/types/contentTags.ts
 * ============================================
 *
 * CRITICAL INFO:
 * - Purpose: TypeScript types for content tagging system
 * - Dependencies: None (standalone types)
 * - Used by: UnifiedContentManager, Tag components
 * - Features: Tag input, autocomplete, filtering
 *
 * CHANGE LOG:
 * - 2025-10-24: Initial creation - Tag system types
 */

/**
 * Individual tag with usage statistics
 */
export interface Tag {
	tag: string;
	count: number;
}

/**
 * Tag input change event
 */
export interface TagInputEvent {
	tags: string[];
}

/**
 * Tag autocomplete suggestion
 */
export interface TagSuggestion {
	tag: string;
	count: number;
	matchScore?: number; // 0-100, for fuzzy matching
}

/**
 * Tag filter options
 */
export interface TagFilter {
	includeTags: string[]; // Files must have ALL these tags (AND)
	excludeTags: string[]; // Files must NOT have these tags
	anyTags: string[]; // Files must have ANY of these tags (OR)
}

/**
 * Tag operation types
 */
export type TagOperation = 'add' | 'remove' | 'replace';

/**
 * Tag update request
 */
export interface TagUpdateRequest {
	contentId: string;
	operation: TagOperation;
	tags: string[];
}

/**
 * Tag statistics
 */
export interface TagStats {
	topTags: Tag[]; // Most popular tags
	recentTags: string[]; // Recently used tags
	totalUniqueTags: number; // Total unique tags in system
	userTagCount: number; // Tags used by current user
}

/**
 * Tag validation result
 */
export interface TagValidation {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Tag input validation rules
 */
export const TAG_VALIDATION_RULES = {
	MIN_LENGTH: 2,
	MAX_LENGTH: 50,
	MAX_TAGS_PER_CONTENT: 20,
	ALLOWED_CHARS: /^[a-zA-Zа-яА-Я0-9\s\-_]+$/,
	RESERVED_WORDS: ['null', 'undefined', 'admin', 'system'],
} as const;

/**
 * Tag color schemes (for UI visualization)
 */
export const TAG_COLORS = [
	'purple',
	'pink',
	'blue',
	'green',
	'orange',
	'red',
	'yellow',
	'teal',
	'cyan',
	'indigo',
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

/**
 * Get consistent color for tag based on hash
 */
export function getTagColor(tag: string): TagColor {
	const hash = tag.split('').reduce((acc, char) => {
		return char.charCodeAt(0) + ((acc << 5) - acc);
	}, 0);

	const index = Math.abs(hash) % TAG_COLORS.length;
	return TAG_COLORS[index];
}

/**
 * Validate tag string
 */
export function validateTag(tag: string): TagValidation {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check length
	if (tag.length < TAG_VALIDATION_RULES.MIN_LENGTH) {
		errors.push(
			`Tag must be at least ${TAG_VALIDATION_RULES.MIN_LENGTH} characters`
		);
	}

	if (tag.length > TAG_VALIDATION_RULES.MAX_LENGTH) {
		errors.push(
			`Tag must not exceed ${TAG_VALIDATION_RULES.MAX_LENGTH} characters`
		);
	}

	// Check characters
	if (!TAG_VALIDATION_RULES.ALLOWED_CHARS.test(tag)) {
		errors.push(
			'Tag contains invalid characters (use letters, numbers, spaces, hyphens, underscores only)'
		);
	}

	// Check reserved words
	if (
		TAG_VALIDATION_RULES.RESERVED_WORDS.includes(
			tag.toLowerCase() as 'null' | 'undefined' | 'admin' | 'system'
		)
	) {
		errors.push('Tag uses a reserved keyword');
	}

	// Warnings
	if (tag.includes('  ')) {
		warnings.push('Tag contains multiple consecutive spaces');
	}

	if (tag !== tag.trim()) {
		warnings.push('Tag has leading/trailing whitespace');
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Normalize tag (trim, lowercase)
 */
export function normalizeTag(tag: string): string {
	return tag.trim().toLowerCase().replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

/**
 * Parse comma-separated tag string
 */
export function parseTags(tagString: string): string[] {
	return tagString
		.split(',')
		.map(normalizeTag)
		.filter((tag) => tag.length >= TAG_VALIDATION_RULES.MIN_LENGTH);
}

/**
 * Fuzzy match tags for autocomplete
 */
export function fuzzyMatchTag(input: string, tag: string): number {
	const normalizedInput = normalizeTag(input);
	const normalizedTag = normalizeTag(tag);

	// Exact match
	if (normalizedTag === normalizedInput) {
		return 100;
	}

	// Starts with match
	if (normalizedTag.startsWith(normalizedInput)) {
		return 90;
	}

	// Contains match
	if (normalizedTag.includes(normalizedInput)) {
		return 70;
	}

	// Fuzzy character match
	let matchCount = 0;
	let inputIndex = 0;

	for (
		let i = 0;
		i < normalizedTag.length && inputIndex < normalizedInput.length;
		i++
	) {
		if (normalizedTag[i] === normalizedInput[inputIndex]) {
			matchCount++;
			inputIndex++;
		}
	}

	if (matchCount === normalizedInput.length) {
		return 50; // All characters found in sequence
	}

	return (matchCount / normalizedInput.length) * 30; // Partial match
}
