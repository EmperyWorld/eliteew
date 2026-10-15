/**
 * ============================================
 * FILE: index.ts
 * ============================================
 *
 * Viewer Components - Central Export
 * Document viewer and unified content manager UI components
 *
 * @version 1.0.0
 * @date 2025-10-24
 * @author UI Designer Agent
 */

// Layout Components
export { default as ViewerContainer } from './ViewerContainer';
export type { ViewerContainerProps } from './ViewerContainer';

export { default as ViewerToolbar } from './ViewerToolbar';
export type { ViewerToolbarProps, ZoomLevel } from './ViewerToolbar';

// File Components
export { default as FileTypeIcon } from './FileTypeIcon';
export type { FileTypeIconProps, FileType, IconSize } from './FileTypeIcon';
export { getFileType, getFileTypeMetadata } from './FileTypeIcon';

export { default as FormatBadge } from './FormatBadge';
export type { FormatBadgeProps } from './FormatBadge';
export {
	SimpleFormatBadge,
	DetailedFormatBadge,
	formatFileSize,
} from './FormatBadge';

export { default as FileCard } from './FileCard';
export type { FileCardProps } from './FileCard';

export { default as UploadZone } from './UploadZone';
export type { UploadZoneProps, UploadFile } from './UploadZone';

// Design Tokens
export { default as viewerDesignTokens } from './designTokens';
export {
	viewerColors,
	viewerTypography,
	viewerSpacing,
	viewerComponents,
	viewerAnimations,
} from './designTokens';

// Translations
export { default as viewerTranslations } from './translations';
export type { ViewerTranslations } from './translations';
export {
	en as viewerTranslationsEn,
	ru as viewerTranslationsRu,
	getViewerTranslations,
} from './translations';
