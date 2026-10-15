/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared types and supported-format catalog for DocumentImportPanel atomization.
 *
 * Invariants:
 * - SUPPORTED_FORMATS / SUPPORTED_EXTENSIONS stay aligned with dropzone accept list.
 *
 * Related:
 * - DocumentImportPanel.tsx, detectFileFormat.ts
 */

import type { ComponentType, SVGProps } from 'react';
import {
	CodeBracketIcon,
	DocumentTextIcon,
	HashtagIcon,
	PhotoIcon,
} from '@heroicons/react/24/outline';

import type { DocumentImportResult } from '@/components/UltimateDocEditor/types/editor.types';

/** Shape returned by editor store `importDocument` (upload + parse). */
export interface ImportDocumentApiPayload {
	id: string;
	title: string;
	content: string;
	word_count: number;
	character_count: number;
	mime_type: string;
	metadata?: Record<string, unknown>;
}

export type FileFormatDetection = {
	detectedFormat: string | null;
	confidence: number;
	extension: string;
};

export type ImportSupportedFormat = {
	ext: string;
	labelKey:
		| 'wordLegacy'
		| 'word'
		| 'pdf'
		| 'text'
		| 'markdown'
		| 'html'
		| 'rtf'
		| 'odt'
		| 'pngOcr'
		| 'jpegOcr';
	icon: ComponentType<SVGProps<SVGSVGElement>>;
	color: string;
	priority: number;
	isWord?: boolean;
};

export interface DocumentImportPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onImportComplete?: (results: DocumentImportResult[]) => void | Promise<void>;
}

export const SUPPORTED_EXTENSIONS = [
	'doc',
	'docx',
	'pdf',
	'txt',
	'md',
	'html',
	'rtf',
	'odt',
	'png',
	'jpg',
	'jpeg',
] as const;

export const SUPPORTED_FORMATS: ImportSupportedFormat[] = [
	{
		ext: '.doc',
		labelKey: 'wordLegacy',
		icon: DocumentTextIcon,
		color: 'blue',
		priority: 1,
		isWord: true,
	},
	{
		ext: '.docx',
		labelKey: 'word',
		icon: DocumentTextIcon,
		color: 'blue',
		priority: 2,
		isWord: true,
	},
	{
		ext: '.pdf',
		labelKey: 'pdf',
		icon: DocumentTextIcon,
		color: 'red',
		priority: 3,
	},
	{
		ext: '.txt',
		labelKey: 'text',
		icon: DocumentTextIcon,
		color: 'gray',
		priority: 4,
	},
	{
		ext: '.md',
		labelKey: 'markdown',
		icon: HashtagIcon,
		color: 'purple',
		priority: 5,
	},
	{
		ext: '.html',
		labelKey: 'html',
		icon: CodeBracketIcon,
		color: 'orange',
		priority: 6,
	},
	{
		ext: '.rtf',
		labelKey: 'rtf',
		icon: DocumentTextIcon,
		color: 'green',
		priority: 7,
	},
	{
		ext: '.odt',
		labelKey: 'odt',
		icon: DocumentTextIcon,
		color: 'teal',
		priority: 8,
	},
	{
		ext: '.png',
		labelKey: 'pngOcr',
		icon: PhotoIcon,
		color: 'green',
		priority: 9,
	},
	{
		ext: '.jpg',
		labelKey: 'jpegOcr',
		icon: PhotoIcon,
		color: 'green',
		priority: 10,
	},
	{
		ext: '.jpeg',
		labelKey: 'jpegOcr',
		icon: PhotoIcon,
		color: 'green',
		priority: 10,
	},
];
