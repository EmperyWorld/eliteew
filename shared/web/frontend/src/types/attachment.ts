/**
 * Attachment Types
 *
 * Type definitions for file attachments and multimodal content
 * Used throughout EliteChatV3 and other components
 */

import type { Metadata, JsonValue } from './common';

/**
 * Attachment type enumeration
 */
export type AttachmentType = 'image' | 'document' | 'audio' | 'video' | 'file';

/**
 * Attachment interface
 * Represents a file attachment in messages, chats, and other contexts
 */
export interface Attachment {
	id: string;
	type: AttachmentType;
	url: string;
	filename: string;
	name?: string; // Alias for filename, for backward compatibility
	size?: number;
	mime_type?: string;
	metadata?: Metadata;
	// Additional fields used in some contexts
	file?: {
		size?: number;
		type?: string;
		name?: string;
	};
	data?: string | ArrayBuffer; // For audio/video data
}

/**
 * Attachment array type
 * Used for arrays of attachments
 */
export type AttachmentArray = Attachment[];

/**
 * Multimodal content type
 * Can be string content or structured data
 */
export type MultimodalContent = string | JsonValue;
