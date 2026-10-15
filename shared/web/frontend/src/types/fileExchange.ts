/**
 * File Exchange System - Type Definitions
 *
 * Comprehensive type-safe definitions for the file exchange system,
 * including branded types, discriminated unions, and runtime validators.
 *
 * @module types/fileExchange
 */

// ============================================================================
// BRANDED TYPES
// ============================================================================

/**
 * Branded type for File IDs to prevent string confusion
 * @example
 * const fileId: FileId = "abc123" as FileId;
 */
export type FileId = string & { readonly __brand: 'FileId' };

/**
 * Creates a FileId from a string
 * @param id - The string identifier
 * @returns Branded FileId
 */
export const createFileId = (id: string): FileId => id as FileId;

/**
 * Branded type for MIME types
 */
export type MimeType = string & { readonly __brand: 'MimeType' };

/**
 * Creates a MimeType from a string
 */
export const createMimeType = (mime: string): MimeType => mime as MimeType;

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

/**
 * Content type categories for file classification
 */
export const ContentType = {
	DOCUMENT: 'document',
	IMAGE: 'image',
	VIDEO: 'video',
	AUDIO: 'audio',
	OTHER: 'other',
} as const;

export type ContentType = (typeof ContentType)[keyof typeof ContentType];

/**
 * File visibility levels
 */
export const VisibilityLevel = {
	PRIVATE: 'private',
	SHARED: 'shared',
	PUBLIC: 'public',
} as const;

export type VisibilityLevel =
	(typeof VisibilityLevel)[keyof typeof VisibilityLevel];

/**
 * Processing status for uploaded files
 */
export const ProcessingStatus = {
	PENDING: 'pending',
	PROCESSING: 'processing',
	COMPLETED: 'completed',
	FAILED: 'failed',
} as const;

export type ProcessingStatus =
	(typeof ProcessingStatus)[keyof typeof ProcessingStatus];

// ============================================================================
// CORE DATA TYPES
// ============================================================================

/**
 * Complete file metadata from Unified Content API
 *
 * @property id - Unique file identifier (branded)
 * @property name - Human-readable file name
 * @property content_type - File category (document, image, video, etc.)
 * @property file_size - Size in bytes
 * @property mime_type - MIME type (branded)
 * @property created_at - ISO 8601 timestamp
 * @property updated_at - ISO 8601 timestamp
 * @property thumbnail_url - Optional preview image URL
 * @property tags - Optional searchable tags
 * @property visibility - Access control level
 * @property processing_status - Current processing state
 * @property description - Optional file description
 */
export interface FileData {
	readonly id: FileId;
	readonly name: string;
	readonly content_type: ContentType;
	readonly file_size: number;
	readonly mime_type: MimeType;
	readonly created_at: string;
	readonly updated_at: string;
	readonly thumbnail_url?: string;
	readonly tags?: readonly string[];
	readonly visibility: VisibilityLevel;
	readonly processing_status?: ProcessingStatus;
	readonly description?: string;
}

/**
 * Lightweight file metadata for lists and previews
 */
export interface FileMetadata {
	readonly id: FileId;
	readonly name: string;
	readonly content_type: ContentType;
	readonly file_size: number;
	readonly mime_type: MimeType;
	readonly thumbnail_url?: string;
	readonly created_at: string;
}

/**
 * Upload result from the API
 */
export interface UploadResult {
	readonly id: FileId;
	readonly name: string;
	readonly file_size: number;
	readonly content_type: ContentType;
	readonly mime_type: MimeType;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Options for file upload
 *
 * @example
 * const options: UploadOptions = {
 *   tags: ['invoice', 'Q4-2024'],
 *   visibility: VisibilityLevel.PRIVATE,
 *   contentType: ContentType.DOCUMENT,
 *   description: 'Monthly financial report'
 * };
 */
export interface UploadOptions {
	readonly tags?: readonly string[];
	readonly visibility?: VisibilityLevel;
	readonly contentType?: ContentType;
	readonly description?: string;
}

/**
 * Pagination parameters for list queries
 */
export interface PaginationParams {
	readonly limit?: number;
	readonly offset?: number;
}

/**
 * Filter parameters for file queries
 */
export interface FileFilterParams extends PaginationParams {
	readonly content_type?: ContentType;
	readonly tags?: readonly string[];
	readonly search?: string;
	readonly visibility?: VisibilityLevel;
}

/**
 * Paginated response from the API
 */
export interface PaginatedResponse<T> {
	readonly items: readonly T[];
	readonly total: number;
	readonly limit: number;
	readonly offset: number;
}

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

/**
 * Return type for useFileData hook
 *
 * @template TData - The type of data being fetched (defaults to FileData)
 */
export interface UseFileDataResult<TData = FileData> {
	readonly data: TData | null;
	readonly loading: boolean;
	readonly error: string | null;
	readonly refetch: () => void;
}

/**
 * Return type for useFileUpload hook
 */
export interface UseFileUploadResult {
	readonly uploadFile: (
		file: File,
		options?: UploadOptions
	) => Promise<UploadResult>;
	readonly uploading: boolean;
	readonly progress: number;
	readonly error: string | null;
	readonly reset: () => void;
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

/**
 * Props for FileVisualizer component
 *
 * @example
 * Basic usage (auto-fetch):
 * <FileVisualizer
 *   fileId={fileId}
 *   onRemove={() => handleRemove(fileId)}
 *   showThumbnail={true}
 *   compact={false}
 * />
 *
 * @example
 * Batch mode with cached data (6.25x faster):
 * const { data: filesData } = useFileDataBatch(fileIds);
 * <FileVisualizer
 *   fileId={fileId}
 *   cachedData={filesData[fileId]}
 *   onRemove={() => handleRemove(fileId)}
 * />
 */
export interface FileVisualizerProps {
	readonly fileId: FileId;
	readonly cachedData?: FileData;
	readonly onRemove?: () => void;
	readonly showThumbnail?: boolean;
	readonly compact?: boolean;
}

/**
 * Props for FileGrabber component
 *
 * @example
 * <FileGrabber
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSelect={(fileIds) => handleSelect(fileIds)}
 *   multiSelect={true}
 *   fileTypes={[ContentType.IMAGE, ContentType.VIDEO]}
 *   maxFiles={5}
 * />
 */
export interface FileGrabberProps {
	readonly isOpen: boolean;
	readonly onClose: () => void;
	readonly onSelect: (fileIds: readonly FileId[]) => void;
	readonly multiSelect?: boolean;
	readonly fileTypes?: readonly ContentType[];
	readonly maxFiles?: number;
	readonly embedded?: boolean; // If true, renders without modal wrapper
}

// ============================================================================
// STATE TYPES (Discriminated Unions)
// ============================================================================

/**
 * Loading state - operation in progress
 */
export interface LoadingState {
	readonly status: 'loading';
	readonly progress?: number;
}

/**
 * Success state - operation completed successfully
 */
export interface SuccessState<T> {
	readonly status: 'success';
	readonly data: T;
}

/**
 * Error state - operation failed
 */
export interface ErrorState {
	readonly status: 'error';
	readonly error: string;
	readonly code?: string;
}

/**
 * Idle state - no operation in progress
 */
export interface IdleState {
	readonly status: 'idle';
}

/**
 * Discriminated union for async operations
 * Type-safe state machine for loading states
 *
 * @template T - The type of data in success state
 *
 * @example
 * const [state, setState] = useState<AsyncState<FileData>>({ status: 'idle' });
 *
 * // Type narrowing with discriminated union
 * if (state.status === 'success') {
 *   log.info(state.data.name); // TypeScript knows 'data' exists
 * }
 */
export type AsyncState<T> =
	| IdleState
	| LoadingState
	| SuccessState<T>
	| ErrorState;

// ============================================================================
// CACHE TYPES
// ============================================================================

/**
 * Cache entry with timestamp
 */
export interface CacheEntry<T> {
	readonly data: T;
	readonly timestamp: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
	readonly ttl: number; // Time to live in milliseconds
	readonly maxSize?: number; // Maximum number of entries
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * File exchange specific error
 */
export class FileExchangeError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
		public readonly details?: unknown
	) {
		super(message);
		this.name = 'FileExchangeError';
	}
}

/**
 * Upload error with additional context
 */
export class UploadError extends FileExchangeError {
	constructor(
		message: string,
		public readonly fileName: string,
		code?: string,
		details?: unknown
	) {
		super(message, code, details);
		this.name = 'UploadError';
	}
}

/**
 * API error response structure
 */
export interface ApiErrorResponse {
	readonly detail: string;
	readonly code?: string;
	readonly field?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Make specific properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific properties optional
 */
export type PartialFields<T, K extends keyof T> = Omit<T, K> &
	Partial<Pick<T, K>>;

/**
 * File data with required thumbnail
 */
export type FileDataWithThumbnail = RequireFields<FileData, 'thumbnail_url'>;

/**
 * File data for creation (without server-generated fields)
 */
export type FileDataCreate = Omit<FileData, 'id' | 'created_at' | 'updated_at'>;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if value is a valid FileId
 *
 * @param value - Value to check
 * @returns True if value is a non-empty string
 *
 * @example
 * if (isFileId(value)) {
 *   const fileId = createFileId(value);
 * }
 */
export function isFileId(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if value is valid FileData
 *
 * @param data - Data to validate
 * @returns True if data conforms to FileData interface
 *
 * @example
 * const response = await fetch('/api/v1/content/123');
 * const data = await response.json();
 * if (isFileData(data)) {
 *   // TypeScript knows data is FileData
 *   log.info(data.name);
 * }
 */
export function isFileData(data: unknown): data is FileData {
	if (!data || typeof data !== 'object') {
		return false;
	}

	const obj = data as Record<string, unknown>;

	return (
		typeof obj.id === 'string' &&
		typeof obj.name === 'string' &&
		typeof obj.content_type === 'string' &&
		typeof obj.file_size === 'number' &&
		typeof obj.mime_type === 'string' &&
		typeof obj.created_at === 'string' &&
		typeof obj.updated_at === 'string' &&
		typeof obj.visibility === 'string'
	);
}

/**
 * Type guard to check if value is a valid ContentType
 *
 * @param value - Value to check
 * @returns True if value is a valid ContentType
 */
export function isContentType(value: unknown): value is ContentType {
	return (
		typeof value === 'string' &&
		Object.values(ContentType).includes(value as ContentType)
	);
}

/**
 * Type guard to check if value is a valid VisibilityLevel
 *
 * @param value - Value to check
 * @returns True if value is a valid VisibilityLevel
 */
export function isVisibilityLevel(value: unknown): value is VisibilityLevel {
	return (
		typeof value === 'string' &&
		Object.values(VisibilityLevel).includes(value as VisibilityLevel)
	);
}

/**
 * Type guard to check if value is a valid ProcessingStatus
 *
 * @param value - Value to check
 * @returns True if value is a valid ProcessingStatus
 */
export function isProcessingStatus(value: unknown): value is ProcessingStatus {
	return (
		typeof value === 'string' &&
		Object.values(ProcessingStatus).includes(value as ProcessingStatus)
	);
}

/**
 * Type guard for UploadResult
 *
 * @param data - Data to validate
 * @returns True if data conforms to UploadResult interface
 */
export function isUploadResult(data: unknown): data is UploadResult {
	if (!data || typeof data !== 'object') {
		return false;
	}

	const obj = data as Record<string, unknown>;

	return (
		typeof obj.id === 'string' &&
		typeof obj.name === 'string' &&
		typeof obj.file_size === 'number' &&
		typeof obj.content_type === 'string' &&
		typeof obj.mime_type === 'string'
	);
}

/**
 * Type guard to check if error is an ApiErrorResponse
 *
 * @param error - Error to check
 * @returns True if error conforms to ApiErrorResponse
 */
export function isApiErrorResponse(error: unknown): error is ApiErrorResponse {
	if (!error || typeof error !== 'object') {
		return false;
	}

	const obj = error as Record<string, unknown>;
	return typeof obj.detail === 'string';
}

// ============================================================================
// VALIDATORS
// ============================================================================

/**
 * Validates file size against maximum allowed
 *
 * @param file - File to validate
 * @param maxSizeInBytes - Maximum allowed size in bytes
 * @returns True if file size is valid
 *
 * @example
 * const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
 * if (!validateFileSize(file, MAX_SIZE)) {
 *   throw new Error('File too large');
 * }
 */
export function validateFileSize(file: File, maxSizeInBytes: number): boolean {
	return file.size <= maxSizeInBytes;
}

/**
 * Validates file type against allowed MIME types
 *
 * @param file - File to validate
 * @param allowedTypes - Array of allowed MIME types
 * @returns True if file type is allowed
 *
 * @example
 * const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
 * if (!validateFileType(file, allowedTypes)) {
 *   throw new Error('Invalid file type');
 * }
 */
export function validateFileType(
	file: File,
	allowedTypes: readonly string[]
): boolean {
	return allowedTypes.includes(file.type);
}

/**
 * Validates file extension
 *
 * @param fileName - File name to validate
 * @param allowedExtensions - Array of allowed extensions (without dot)
 * @returns True if extension is allowed
 *
 * @example
 * if (!validateFileExtension(file.name, ['jpg', 'png', 'gif'])) {
 *   throw new Error('Invalid file extension');
 * }
 */
export function validateFileExtension(
	fileName: string,
	allowedExtensions: readonly string[]
): boolean {
	const extension = fileName.split('.').pop()?.toLowerCase();
	return extension ? allowedExtensions.includes(extension) : false;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats file size in human-readable format
 *
 * @param bytes - Size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted size string
 *
 * @example
 * formatFileSize(1536) // "1.50 KB"
 * formatFileSize(1048576) // "1.00 MB"
 */
export function formatFileSize(bytes: number, decimals = 2): string {
	if (bytes === 0) {
		return '0 Bytes';
	}

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'] as const;
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${(bytes / k ** i).toFixed(decimals)} ${sizes[i]}`;
}

/**
 * Gets display color for content type
 *
 * @param contentType - Content type
 * @returns Tailwind color class
 *
 * @example
 * const color = getContentTypeColor(ContentType.IMAGE);
 * <div className={`text-${color}-400`}>Image</div>
 */
export function getContentTypeColor(contentType: ContentType): string {
	switch (contentType) {
		case ContentType.DOCUMENT:
			return 'blue';
		case ContentType.IMAGE:
			return 'green';
		case ContentType.VIDEO:
			return 'purple';
		case ContentType.AUDIO:
			return 'orange';
		default:
			return 'gray';
	}
}

/**
 * Converts API response to FileData with branded types
 *
 * @param response - Raw API response
 * @returns Typed FileData object
 * @throws {FileExchangeError} If response is invalid
 */
export function toFileData(response: unknown): FileData {
	if (!isFileData(response)) {
		throw new FileExchangeError('Invalid file data response');
	}

	return {
		...response,
		id: createFileId(response.id),
		mime_type: createMimeType(response.mime_type),
		tags: response.tags ? Object.freeze([...response.tags]) : undefined,
	};
}

/**
 * Converts API response to UploadResult with branded types
 *
 * @param response - Raw API response
 * @returns Typed UploadResult object
 * @throws {FileExchangeError} If response is invalid
 */
export function toUploadResult(response: unknown): UploadResult {
	if (!isUploadResult(response)) {
		throw new FileExchangeError('Invalid upload result response');
	}

	return {
		...response,
		id: createFileId(response.id),
		mime_type: createMimeType(response.mime_type),
	};
}
