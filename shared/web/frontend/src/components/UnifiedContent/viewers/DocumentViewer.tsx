// DOCUMENT VIEWER - PDF, DOCX, TXT, MD preview
import * as React from 'react';
import { useState, useEffect } from 'react';
import {
	DocumentTextIcon,
	MagnifyingGlassMinusIcon,
	MagnifyingGlassPlusIcon,
} from '@heroicons/react/24/outline';
import { log } from '../../../utils/logger';
import type { Content } from '../types';

interface DocumentViewerProps {
	content: Content;
	fileUrl: string;
	isFullscreen: boolean;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
	content,
	fileUrl,
	isFullscreen,
}) => {
	const [zoom, setZoom] = useState(100);
	const [extractedText, setExtractedText] = useState<string | null>(null);

	useEffect(() => {
		// Use extracted text if available, with proper decoding
		const extractedText: string | undefined =
			content.extracted_text ?? undefined;
		if (extractedText && typeof extractedText === 'string') {
			let text: string = extractedText;

			try {
				// Decode from base64 to get original bytes
				const bytes = new Uint8Array(
					atob(text)
						.split('')
						.map((c: string): number => c.charCodeAt(0))
				);

				// Try UTF-8 first
				text = new TextDecoder('utf-8').decode(bytes);

				// If text contains replacement characters (�), try Windows-1251
				if (text.includes('�')) {
					text = new TextDecoder('windows-1251').decode(bytes);
				}
			} catch (error: unknown) {
				// If decoding fails, use original text as fallback
				const err = error instanceof Error ? error : new Error(String(error));
				log.warn('DocumentViewer', 'Failed to decode extracted text', err);
				if (extractedText && typeof extractedText === 'string') {
					text = extractedText;
				}
			}

			setExtractedText(text);
		}
	}, [content.extracted_text]);

	const mimeType =
		typeof content.mime_type === 'string' ? content.mime_type : '';
	const isPDF = mimeType.includes('pdf');
	const isText = mimeType.includes('text') || mimeType.includes('markdown');
	const isDocument = mimeType.includes('document') || mimeType.includes('word');

	const handleZoomIn = (): void => setZoom((prev) => Math.min(prev + 25, 200));
	const handleZoomOut = (): void => setZoom((prev) => Math.max(prev - 25, 50));

	// PDF Viewer (using iframe)
	if (isPDF) {
		return (
			<div className="relative h-full bg-gray-900">
				{/* Zoom Controls */}
				<div className="absolute top-4 right-4 z-10 flex gap-2">
					<button
						type="button"
						onClick={handleZoomOut}
						className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors backdrop-blur-xs"
						title="Zoom Out"
					>
						<MagnifyingGlassMinusIcon className="w-4 h-4" />
					</button>
					<span className="px-3 py-2 bg-black/60 text-white rounded-lg backdrop-blur-xs">
						{zoom}%
					</span>
					<button
						type="button"
						onClick={handleZoomIn}
						className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors backdrop-blur-xs"
						title="Zoom In"
					>
						<MagnifyingGlassPlusIcon className="w-4 h-4" />
					</button>
				</div>

				{/* PDF Iframe */}
				<div data-desktop-iframe-host="" className="h-full min-h-0 w-full">
					<iframe
						src={`${fileUrl}#zoom=${zoom}`}
						className="h-full w-full border-0"
						title={content.name}
					/>
				</div>
			</div>
		);
	}

	// Text/Markdown Viewer (from extracted text or blob)
	if (isText || extractedText) {
		return (
			<div className="bg-gray-900 p-6 min-h-[400px]">
				<div className="max-w-4xl mx-auto">
					{/* Text Controls */}
					<div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
						<div className="flex items-center gap-2 text-gray-400">
							<DocumentTextIcon className="w-5 h-5" />
							<span className="text-sm">
								{extractedText ? 'Extracted Text' : 'Text Document'}
							</span>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={handleZoomOut}
								className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
								aria-label="Уменьшить масштаб"
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
								aria-label="Увеличить масштаб"
							>
								<MagnifyingGlassPlusIcon className="w-4 h-4" />
							</button>
						</div>
					</div>

					{/* Text Content */}
					<div
						className="prose prose-invert max-w-none"
						style={{ fontSize: `${zoom}%` }}
					>
						<pre
							className={`whitespace-pre-wrap font-mono text-sm text-gray-300 bg-black/40 p-6 rounded-lg border border-white/10 ${
								isFullscreen
									? 'max-h-none overflow-auto'
									: 'max-h-[60vh] overflow-auto'
							}`}
						>
							{extractedText || 'Loading text content...'}
						</pre>
					</div>
				</div>
			</div>
		);
	}

	// Document Viewer (DOCX, etc) - Show extracted text or download option
	if (isDocument) {
		return (
			<div className="bg-gray-900 p-8 min-h-[400px]">
				<div className="max-w-4xl mx-auto text-center">
					<DocumentTextIcon className="w-16 h-16 mx-auto mb-4 text-blue-400" />
					<h3 className="text-xl font-semibold text-white mb-2">
						Document Preview
					</h3>
					<p className="text-gray-400 mb-6">
						{content.mime_type ?? ''} •{' '}
						{((content.file_size ?? 0) / 1024).toFixed(2)} KB
					</p>

					{extractedText ? (
						<div className="text-left">
							<div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
								<span className="text-sm text-gray-400">
									{isFullscreen
										? 'Full Document Content'
										: 'Extracted Text Preview'}
								</span>
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={handleZoomOut}
										className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
										aria-label="Уменьшить масштаб"
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
										aria-label="Увеличить масштаб"
									>
										<MagnifyingGlassPlusIcon className="w-4 h-4" />
									</button>
								</div>
							</div>
							<pre
								className={`whitespace-pre-wrap font-mono text-sm text-gray-300 bg-black/40 p-6 rounded-lg border border-white/10 ${
									isFullscreen
										? 'max-h-none overflow-auto'
										: 'max-h-96 overflow-auto'
								}`}
								style={{ fontSize: `${zoom}%` }}
							>
								{isFullscreen
									? extractedText
									: extractedText.slice(0, 5000) +
										(extractedText.length > 5000
											? '\n\n... (truncated - use fullscreen for full content)'
											: '')}
							</pre>
						</div>
					) : (
						<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-6">
							<p className="text-yellow-400">
								Preview not available for this document type. Download to view
								full content.
							</p>
						</div>
					)}
				</div>
			</div>
		);
	}

	// Fallback
	return (
		<div className="bg-gray-900 p-8 min-h-[400px] flex items-center justify-center">
			<div className="text-center">
				<DocumentTextIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
				<p className="text-gray-400">Document preview not available</p>
			</div>
		</div>
	);
};

export default DocumentViewer;
