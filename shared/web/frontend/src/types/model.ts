/**
 * Model Types
 *
 * Type definitions for AI models and model information
 * Used throughout EliteChatV3 and other components
 */

/**
 * ModelInfo interface
 * Represents information about an AI model
 */
export interface ModelInfo {
	name: string;
	size?: string;
	description?: string;
	provider?: string;
	capabilities?: string[];
}

/**
 * Model array type
 * Used for arrays of models
 */
export type ModelArray = ModelInfo[];
