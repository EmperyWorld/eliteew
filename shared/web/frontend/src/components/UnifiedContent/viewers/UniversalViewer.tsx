/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Universal file content viewer for Unified Content catalog (text, office HTML, PDF preview).
 *
 * Invariants:
 * - Office HTML preview is sanitized via sanitizeUserHtml before render.
 *
 * Related:
 * - POST /api/v1/doc-editor/convert/upload (Stack4 Tika/Gotenberg)
 */
// UNIVERSAL VIEWER - Display file content for all file types
import * as React from 'react';
import { useState, useEffect } from 'react';
import { apiClient } from '@/services/api/client';
import { API_PATHS } from '@/services/api/config';
import { sanitizeUserHtml } from '@/utils/sanitizeUserHtml';

import { log } from '../../../utils/logger';
import type { Content } from '../types';
import {
	ArrowDownTrayIcon,
	DocumentTextIcon,
	ExclamationCircleIcon,
	MagnifyingGlassMinusIcon,
	MagnifyingGlassPlusIcon,
} from '@heroicons/react/24/outline';

interface UniversalViewerProps {
	content: Content;
	fileUrl: string;
	isFullscreen: boolean;
	onDownload: () => void;
}

const OFFICE_HTML_EXT = /\.(docx|doc|odt|rtf)$/i;
const OFFICE_PDF_EXT = /\.(xlsx|xls|pptx|ppt)$/i;

async function fetchOfficeConvertPreview(
	fileUrl: string,
	content: Content,
	targetFormat: 'html' | 'pdf'
): Promise<string> {
	const response = await fetch(fileUrl);
	const blob = await response.blob();
	const file = new File([blob], content.name ?? 'document', {
		type: content.mime_type ?? blob.type,
	});
	const fd = new FormData();
	fd.append('file', file);
	const { data } = await apiClient.post<{ content: string }>(
		`${API_PATHS.DOC_EDITOR}/convert/upload`,
		fd,
		{ params: { target_format: targetFormat } }
	);
	return data.content;
}

const UniversalViewer: React.FC<UniversalViewerProps> = ({
	content,
	fileUrl,
	isFullscreen,
	onDownload,
}) => {
	const [textContent, setTextContent] = useState<string | null>(null);
	const [htmlContent, setHtmlContent] = useState<string | null>(null);
	const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
	const pdfPreviewUrlRef = React.useRef<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [zoom, setZoom] = useState(100);

	const handleZoomIn = (): void => setZoom((prev) => Math.min(prev + 25, 200));
	const handleZoomOut = (): void => setZoom((prev) => Math.max(prev - 25, 50));

	useEffect(() => {
		return () => {
			if (pdfPreviewUrlRef.current) {
				URL.revokeObjectURL(pdfPreviewUrlRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const loadContent = async (): Promise<void> => {
			setLoading(true);
			setError(null);
			setHtmlContent(null);
			setTextContent(null);
			if (pdfPreviewUrlRef.current) {
				URL.revokeObjectURL(pdfPreviewUrlRef.current);
				pdfPreviewUrlRef.current = null;
				setPdfPreviewUrl(null);
			}

			try {
				const nameLower = content.name?.toLowerCase() ?? '';
				const isDocxFile =
					nameLower.endsWith('.docx') ||
					content.mime_type ===
						'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

				const isOfficeHtml =
					isDocxFile ||
					OFFICE_HTML_EXT.test(nameLower) ||
					content.mime_type === 'application/msword' ||
					content.mime_type === 'application/vnd.oasis.opendocument.text' ||
					content.mime_type === 'application/rtf';

				const isOfficePdf =
					OFFICE_PDF_EXT.test(nameLower) ||
					content.mime_type ===
						'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
					content.mime_type === 'application/vnd.ms-excel' ||
					content.mime_type ===
						'application/vnd.openxmlformats-officedocument.presentationml.presentation';

				const isTextFile =
					(content.mime_type?.startsWith('text/') ?? false) ||
					(content.mime_type?.includes('javascript') ?? false) ||
					(content.mime_type?.includes('json') ?? false) ||
					(content.mime_type?.includes('xml') ?? false) ||
					nameLower.endsWith('.txt') ||
					nameLower.endsWith('.md') ||
					nameLower.endsWith('.log') ||
					nameLower.endsWith('.csv') ||
					nameLower.endsWith('.json') ||
					nameLower.endsWith('.xml') ||
					nameLower.endsWith('.html') ||
					nameLower.endsWith('.css') ||
					nameLower.endsWith('.js') ||
					nameLower.endsWith('.ts') ||
					nameLower.endsWith('.py') ||
					nameLower.endsWith('.sh') ||
					nameLower.endsWith('.yml') ||
					nameLower.endsWith('.yaml');

				if (isOfficeHtml) {
					const html = await fetchOfficeConvertPreview(
						fileUrl,
						content,
						'html'
					);
					setHtmlContent(sanitizeUserHtml(html));
				} else if (isOfficePdf) {
					const b64 = await fetchOfficeConvertPreview(fileUrl, content, 'pdf');
					const binary = atob(b64);
					const bytes = new Uint8Array(binary.length);
					for (let i = 0; i < binary.length; i += 1) {
						bytes[i] = binary.charCodeAt(i);
					}
					const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
					const objectUrl = URL.createObjectURL(pdfBlob);
					pdfPreviewUrlRef.current = objectUrl;
					setPdfPreviewUrl(objectUrl);
				} else if (isTextFile) {
					// Try to load as text with proper encoding handling
					const response = await fetch(fileUrl);
					const buffer = await response.arrayBuffer();

					// Try UTF-8 first
					let text = new TextDecoder('utf-8').decode(buffer);

					// If text contains replacement characters (�), try other encodings
					if (text.includes('�')) {
						// Try Windows-1251 (common for Russian)
						try {
							text = new TextDecoder('windows-1251').decode(buffer);
						} catch {
							// Fallback to UTF-8 if decoding fails
						}
					}

					setTextContent(text);
					setHtmlContent(null);
				} else {
					// For other binary files, show download option
					setTextContent(null);
					setHtmlContent(null);
				}
			} catch (err: unknown) {
				const loadError = err instanceof Error ? err : new Error(String(err));
				log.error('UniversalViewer', 'Failed to load file content', loadError);
				setError('Preview unavailable — download the file or try again later.');
			} finally {
				setLoading(false);
			}
		};

		if (fileUrl) {
			loadContent();
		}
	}, [fileUrl, content]);

	if (loading) {
		return (
			<div className="bg-gray-900 p-8 min-h-[400px] flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
					<p className="text-gray-400">Loading file content...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-gray-900 p-8 min-h-[400px] flex items-center justify-center">
				<div className="text-center">
					<ExclamationCircleIcon className="w-16 h-16 mx-auto mb-4 text-red-400" />
					<h3 className="text-xl font-semibold text-white mb-2">
						Error Loading Content
					</h3>
					<p className="text-gray-400 mb-6">{error}</p>
					<button
						type="button"
						onClick={onDownload}
						className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto"
					>
						<ArrowDownTrayIcon className="w-5 h-5" />
						ArrowDownTrayIcon File
					</button>
				</div>
			</div>
		);
	}

	if (pdfPreviewUrl) {
		return (
			<div className="bg-gray-900 p-6 min-h-[400px]">
				<div className="max-w-6xl mx-auto">
					<div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
						<div className="flex items-center gap-2 text-gray-400">
							<DocumentTextIcon className="w-5 h-5" />
							<span className="text-sm">Office preview (PDF)</span>
						</div>
					</div>
					<div data-desktop-iframe-host="" className="w-full">
						<iframe
							title={`Preview ${content.name}`}
							src={pdfPreviewUrl}
							className={`w-full bg-white rounded-lg border border-white/10 ${
								isFullscreen ? 'min-h-[80vh]' : 'min-h-[60vh]'
							}`}
						/>
					</div>
				</div>
			</div>
		);
	}

	if (htmlContent !== null) {
		const htmlPreview = (
			<div
				className="prose prose-gray max-w-none text-black"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: trusted HTML preview of fetched document body
				dangerouslySetInnerHTML={{ __html: htmlContent }}
			/>
		);
		// Display as HTML (for DOCX)
		return (
			<div className="bg-gray-900 p-6 min-h-[400px]">
				<div className="max-w-6xl mx-auto">
					{/* Controls */}
					<div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
						<div className="flex items-center gap-2 text-gray-400">
							<DocumentTextIcon className="w-5 h-5" />
							<span className="text-sm">Document Content</span>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={handleZoomOut}
								className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
								title="Zoom Out"
							>
								<MagnifyingGlassMinusIcon className="w-4 h-4" />
							</button>
							<span className="px-3 py-1 bg-black/40 text-white rounded-lg text-sm">
								{zoom}%
							</span>
							<button
								type="button"
								onClick={handleZoomIn}
								className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
								title="Zoom In"
							>
								<MagnifyingGlassPlusIcon className="w-4 h-4" />
							</button>
						</div>
					</div>

					{/* HTML Content */}
					<div
						className={`overflow-auto bg-white p-6 rounded-lg border border-white/10 ${
							isFullscreen ? 'max-h-none' : 'max-h-[60vh]'
						}`}
						style={{ fontSize: `${zoom}%` }}
					>
						{htmlPreview}
					</div>
				</div>
			</div>
		);
	}

	if (textContent !== null) {
		// Display as text
		return (
			<div className="bg-gray-900 p-6 min-h-[400px]">
				<div className="max-w-6xl mx-auto">
					{/* Controls */}
					<div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
						<div className="flex items-center gap-2 text-gray-400">
							<DocumentTextIcon className="w-5 h-5" />
							<span className="text-sm">File Content</span>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={handleZoomOut}
								className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
								title="Zoom Out"
							>
								<MagnifyingGlassMinusIcon className="w-4 h-4" />
							</button>
							<span className="px-3 py-1 bg-black/40 text-white rounded-lg text-sm">
								{zoom}%
							</span>
							<button
								type="button"
								onClick={handleZoomIn}
								className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
								title="Zoom In"
							>
								<MagnifyingGlassPlusIcon className="w-4 h-4" />
							</button>
						</div>
					</div>

					{/* Text Content */}
					<div
						className={`overflow-auto bg-black/40 p-6 rounded-lg border border-white/10 ${
							isFullscreen ? 'max-h-none' : 'max-h-[60vh]'
						}`}
						style={{ fontSize: `${zoom}%` }}
					>
						<pre className="whitespace-pre-wrap font-mono text-sm text-gray-300">
							{textContent}
						</pre>
					</div>
				</div>
			</div>
		);
	}

	// For binary files, show download option
	return (
		<div className="bg-gray-900 p-8 min-h-[400px] flex items-center justify-center">
			<div className="max-w-md w-full text-center">
				{/* File Icon */}
				<div className="mb-6">
					<div className="w-24 h-24 mx-auto bg-linear-to-br from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center relative">
						<DocumentTextIcon className="w-12 h-12 text-white" />
						<div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-blue-500 rounded-sm text-xs font-bold text-white">
							{content.name.split('.').pop()?.toUpperCase() ?? 'FILE'}
						</div>
					</div>
				</div>

				{/* File Info */}
				<h3 className="text-xl font-semibold text-white mb-2">
					{content.name}
				</h3>
				<p className="text-gray-400 mb-6">
					{content.content_type} • {content.mime_type ?? 'Unknown type'}
				</p>

				{/* Content Info */}
				<div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
					<p className="text-blue-400">
						This is a binary file. Content cannot be displayed in the browser.
						ArrowDownTrayIcon the file to view its contents.
					</p>
				</div>

				{/* ArrowDownTrayIcon Button */}
				<button
					type="button"
					onClick={onDownload}
					className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
				>
					<ArrowDownTrayIcon className="w-5 h-5" />
					ArrowDownTrayIcon File
				</button>
			</div>
		</div>
	);
};

export default UniversalViewer;
