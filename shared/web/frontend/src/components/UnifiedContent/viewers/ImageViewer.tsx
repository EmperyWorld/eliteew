// IMAGE VIEWER - Lightbox with zoom and pan
import * as React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import {
	ArrowPathIcon,
	ArrowsPointingOutIcon,
	MagnifyingGlassMinusIcon,
	MagnifyingGlassPlusIcon,
} from '@heroicons/react/24/outline';
import type { Content } from '../types';

interface ImageViewerProps {
	content: Content;
	fileUrl: string;
	isFullscreen: boolean;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ content, fileUrl }) => {
	const [zoom, setZoom] = useState(1);
	const [rotation, setRotation] = useState(0);
	const imgRef = useRef<HTMLImageElement>(null);
	useLayoutEffect(() => {
		const el = imgRef.current;
		if (!el) return;
		el.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;
		el.style.transformOrigin = 'center';
	}, [zoom, rotation]);

	const handleZoomIn = (): void => setZoom((prev) => Math.min(prev + 0.25, 3));
	const handleZoomOut = (): void =>
		setZoom((prev) => Math.max(prev - 0.25, 0.5));
	const handleRotate = (): void => setRotation((prev) => (prev + 90) % 360);
	const handleReset = (): void => {
		setZoom(1);
		setRotation(0);
	};

	return (
		<div className="relative bg-black/40 h-full flex flex-col">
			{/* Image Controls */}
			<div className="absolute top-4 right-4 z-10 flex gap-2">
				<button
					type="button"
					onClick={handleZoomIn}
					className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors backdrop-blur-xs"
					title="Zoom In"
				>
					<MagnifyingGlassPlusIcon className="w-4 h-4" />
				</button>
				<button
					type="button"
					onClick={handleZoomOut}
					className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors backdrop-blur-xs"
					title="Zoom Out"
				>
					<MagnifyingGlassMinusIcon className="w-4 h-4" />
				</button>
				<button
					type="button"
					onClick={handleRotate}
					className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors backdrop-blur-xs"
					title="Rotate"
				>
					<ArrowPathIcon className="w-4 h-4" />
				</button>
				<button
					type="button"
					onClick={handleReset}
					className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors backdrop-blur-xs"
					title="Reset"
				>
					<ArrowsPointingOutIcon className="w-4 h-4" />
				</button>
			</div>

			{/* Image Display */}
			<button
				type="button"
				className="flex-1 flex items-center justify-center p-8 overflow-auto border-none bg-transparent text-left cursor-zoom-in"
				onClick={() => setZoom((prev) => (prev === 1 ? 2 : 1))}
				aria-label={`${content.name} — toggle zoom`}
			>
				<img
					ref={imgRef}
					src={fileUrl}
					alt={content.name}
					className="max-h-full max-w-full object-contain pointer-events-none transition-[transform] duration-300 motion-reduce:transition-none"
				/>
			</button>

			{/* Image Info */}
			<div className="p-4 bg-black/60 backdrop-blur-xs border-t border-white/10">
				<div className="flex items-center justify-between text-sm">
					<span className="text-gray-400">
						Zoom: <span className="text-white">{Math.round(zoom * 100)}%</span>
					</span>
					<span className="text-gray-400">
						Rotation: <span className="text-white">{rotation}°</span>
					</span>
					<span className="text-gray-400">
						Format:{' '}
						<span className="text-white">
							{content.mime_type?.split('/')[1]?.toUpperCase() ?? 'UNKNOWN'}
						</span>
					</span>
				</div>
			</div>
		</div>
	);
};

export default ImageViewer;
