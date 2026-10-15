/**
 * Common TypeScript Types
 *
 * Reusable types for replacing `any` and `Record<string, any>` throughout the codebase
 * to ensure type safety in strict mode.
 */

/**
 * JsonValue - Represents any valid JSON value
 * Used as a safe replacement for `any` in JSON structures
 */
export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

/**
 * JsonObject - Represents a JSON object
 * Used as a replacement for `Record<string, any>`
 * Compatible with Record<string, unknown> for API responses
 */
export type JsonObject = { [key: string]: JsonValue } | Record<string, unknown>;

/**
 * JsonArray - Represents a JSON array
 */
export type JsonArray = JsonValue[];

/**
 * Metadata - Generic metadata structure
 * Used for any metadata fields that previously used `any` or `Record<string, any>`
 */
export type Metadata = JsonObject;

/**
 * Settings - Generic settings structure
 * Used for widget settings and configuration objects
 */
export type Settings = JsonObject;

/**
 * Parameters - Generic parameters structure
 * Used for function parameters, API parameters, tool parameters, etc.
 */
export type Parameters = JsonObject;

/**
 * Result - Generic result structure
 * Used for API results, tool results, generation results, etc.
 */
export type Result = JsonValue;
