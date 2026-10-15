/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Placeholder/fullscreen shells for Unified Content presentation payloads.
 *
 * Invariants:
 * - Slide thumbnails use authenticated `ContentThumbnail`, not bare `thumbnail_url` on `<img>`.
 *
 * Related:
 * - Presentation editor pipeline; Unified Content viewers.
 */
import * as React from 'react';
import { ContentThumbnail } from '../components/ContentThumbnail/ContentThumbnail';
import { useEffect, useRef } from 'react';
import {
	ArrowsPointingOutIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	PresentationChartBarIcon,
} from '@heroicons/react/24/outline';
import type { Content } from '../types';

interface PresentationViewerProps {
	content: Content;
	fileUrl: string;
	isFullscreen: boolean;
}

const PresentationViewer: React.FC<PresentationViewerProps> = ({
	content,
	fileUrl,
}) => {
	const iframeRef = useRef<HTMLIFrameElement>(null);

	useEffect(() => {
		// Initialize Reveal.js if embedded
		// This is a placeholder - actual implementation depends on presentation format
	}, []);

	// Check if it's a Reveal.js presentation (HTML)
	const isRevealJS =
		(content.metadata &&
		typeof content.metadata === 'object' &&
		'presentation_type' in content.metadata
			? (content.metadata as { presentation_type?: unknown })
					.presentation_type === 'revealjs'
			: false) ||
		(content.mime_type?.includes('html') ?? false);

	if (isRevealJS) {
		return (
			<div className="relative h-full bg-black">
				{/* Presentation info */}
				<div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-xs px-4 py-2 rounded-lg">
					<div className="flex items-center gap-2 text-white">
						<PresentationChartBarIcon className="w-5 h-5" />
						<span className="text-sm font-medium">{content.name}</span>
					</div>
				</div>

				{/* Fullscreen Toggle */}
				<div className="absolute top-4 right-4 z-10">
					<button
						type="button"
						onClick={() => {
							if (iframeRef.current) {
								iframeRef.current.requestFullscreen();
							}
						}}
						className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors backdrop-blur-xs"
						title="Fullscreen"
					>
						<ArrowsPointingOutIcon className="w-4 h-4" />
					</button>
				</div>

				{/* Presentation iframe */}
				<div data-desktop-iframe-host="" className="h-full min-h-0 w-full">
					<iframe
						ref={iframeRef}
						src={fileUrl}
						className="h-full w-full border-0"
						title={content.name}
						allow="fullscreen"
					/>
				</div>

				{/* Navigation Hint */}
				<div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black/60 backdrop-blur-xs px-4 py-2 rounded-lg">
					<div className="flex items-center gap-4 text-white text-sm">
						<div className="flex items-center gap-1">
							<ChevronLeftIcon className="w-4 h-4" />
							<span>Previous</span>
						</div>
						<div className="w-px h-4 bg-white/20" />
						<div className="flex items-center gap-1">
							<span>Next</span>
							<ChevronRightIcon className="w-4 h-4" />
						</div>
						<div className="w-px h-4 bg-white/20" />
						<span>Use arrow keys to navigate</span>
					</div>
				</div>
			</div>
		);
	}

	// Fallback for other presentation formats (PDF, PPTX)
	return (
		<div className="bg-gray-900 p-8 min-h-[400px]">
			<div className="max-w-4xl mx-auto text-center">
				<PresentationChartBarIcon className="w-16 h-16 mx-auto mb-4 text-purple-400" />
				<h3 className="text-xl font-semibold text-white mb-2">
					Presentation preview
				</h3>
				<p className="text-gray-400 mb-6">
					{content.mime_type} •{' '}
					{content.metadata &&
					typeof content.metadata === 'object' &&
					'slides_count' in content.metadata
						? String(
								(content.metadata as { slides_count?: unknown }).slides_count
							)
						: '?'}{' '}
					slides
				</p>

				{content.metadata &&
					typeof content.metadata === 'object' &&
					'slides_count' in content.metadata &&
					((): React.JSX.Element | null => {
						const metadata = content.metadata as {
							slides_count?: unknown;
							title?: unknown;
						};
						const slidesCount = metadata.slides_count;
						const title = metadata.title;
						if (slidesCount !== undefined && slidesCount !== null) {
							return (
								<div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6 mb-6">
									<p className="text-purple-400 mb-2">
										Presentation contains {String(slidesCount)} slides
									</p>
									{title !== undefined && title !== null && (
										<p className="text-white font-medium">{String(title)}</p>
									)}
								</div>
							);
						}
						return null;
					})()}

				<div className="mb-6">
					<div className="relative mx-auto max-w-3xl overflow-hidden rounded-lg border border-white/10">
						<div className="aspect-video bg-black/40">
							<ContentThumbnail
								contentId={content.id}
								fillParent
								alt={String(content.name)}
							/>
						</div>
					</div>
					<p className="mt-2 text-center text-sm text-gray-400">
						First slide preview
					</p>
				</div>

				<div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
					<p className="text-blue-400 text-sm">
						Download the presentation to view full content
					</p>
				</div>
			</div>
		</div>
	);
};

export default PresentationViewer;
