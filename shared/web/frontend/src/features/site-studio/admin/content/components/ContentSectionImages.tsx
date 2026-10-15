import * as React from 'react';
import { useState, useRef, useLayoutEffect } from 'react';
import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	MagnifyingGlassPlusIcon,
	PhotoIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/atoms/Button';
import { getUploadedImageUrl } from '@utils/imageUrl';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';

function ContentUploadProgressFill({ pct }: { pct: number }) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.width = `${pct}%`;
	}, [pct]);
	return (
		<div
			ref={ref}
			className="h-full bg-white transition-[width] motion-reduce:transition-none rounded-full"
		/>
	);
}

interface ImageDef {
	key: string;
	name: string;
	hint?: string;
}

interface SectionBlockRef {
	key: string;
	name: string;
	maxLength?: number;
	hint?: string;
}

interface ContentSectionImagesProps {
	pageId: string;
	section: {
		id: string;
		blocks: SectionBlockRef[];
		images: ImageDef[];
	};
	uploading: string | null;
	uploadProgress: Record<string, number>;
	getImageUrl: (page: string, section: string, key: string) => string;
	onImageUpload: (
		page: string,
		section: string,
		key: string,
		file: File
	) => void;
	onImageDelete: (page: string, section: string, key: string) => void;
}

export const ContentSectionImages: React.FC<ContentSectionImagesProps> = ({
	pageId,
	section,
	uploading,
	uploadProgress,
	getImageUrl,
	onImageUpload,
	onImageDelete,
}) => {
	const { t } = useTranslation('siteStudio');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const [dragging, setDragging] = useState<string | null>(null);
	const [zoomImage, setZoomImage] = useState<string | null>(null);
	const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

	if (section.images.length === 0) return null;

	const handleDragOver = (e: React.DragEvent, key: string) => {
		e.preventDefault();
		setDragging(key);
	};

	const handleDragLeave = () => {
		setDragging(null);
	};

	const handleDrop = (e: React.DragEvent, key: string) => {
		e.preventDefault();
		setDragging(null);
		const file = e.dataTransfer.files[0];
		if (file?.type.startsWith('image/')) {
			onImageUpload(pageId, section.id, key, file);
		}
	};

	return (
		<>
			<div className="space-y-4">
				<h4 className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-slate-700">
					<PhotoIcon
						width={14}
						height={14}
						className="text-purple-500"
						aria-hidden
					/>
					{t('workspace.content.imagesHeading')}
				</h4>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{section.images.map((imageDef) => {
						const imageUrl = getImageUrl(pageId, section.id, imageDef.key);
						const uploadKey = `${pageId}-${section.id}-${imageDef.key}`;
						const isUploading = uploading === uploadKey;
						const progressPct = uploadProgress[uploadKey];
						const isDraggingOver = dragging === imageDef.key;

						return (
							<div
								key={imageDef.key}
								className="p-4 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:shadow-sm transition-[box-shadow,border-color] duration-200"
							>
								<div className="flex items-center justify-between mb-2">
									<span className="text-sm font-medium text-neutral-900 dark:text-white flex items-center gap-2">
										{imageDef.name}
										<span className="text-xs text-neutral-400 dark:text-slate-500 bg-neutral-100 dark:bg-slate-700 px-2 py-0.5 rounded font-mono">
											{imageDef.key}
										</span>
									</span>
								</div>
								{imageDef.hint && (
									<p className="text-xs text-neutral-500 dark:text-slate-400 mb-3 italic">
										{imageDef.hint}
									</p>
								)}
								{/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop target for image upload */}
								<div
									onDragOver={(e) => handleDragOver(e, imageDef.key)}
									onDragLeave={handleDragLeave}
									onDrop={(e) => handleDrop(e, imageDef.key)}
									className={`relative aspect-video bg-neutral-100 dark:bg-slate-700 rounded-xl overflow-hidden border-2 transition-colors motion-reduce:transition-none ${
										isDraggingOver
											? 'border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20'
											: 'border-neutral-200 dark:border-slate-600'
									} group`}
								>
									{imageUrl ? (
										<>
											<img
												src={getUploadedImageUrl(imageUrl)}
												alt={imageDef.name}
												className="w-full h-full object-cover group-hover:scale-105 motion-reduce:group-hover:scale-100 transition-transform duration-300 motion-reduce:transition-none"
											/>
											<div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
												<button
													type="button"
													onClick={() =>
														setZoomImage(getUploadedImageUrl(imageUrl))
													}
													className="min-h-11 min-w-11 p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-300 transition-colors motion-reduce:transition-none"
													aria-label={t('workspace.content.zoomOpen')}
												>
													<MagnifyingGlassPlusIcon width={20} height={20} />
												</button>
											</div>
										</>
									) : (
										<div className="w-full h-full flex flex-col items-center justify-center text-neutral-300 dark:text-slate-500 px-2">
											<PhotoIcon
												width={40}
												height={40}
												className="mb-2"
												aria-hidden
											/>
											<span className="text-xs text-center">
												{t('workspace.content.dragHint')}
											</span>
										</div>
									)}
									{isUploading && (
										<div
											className="absolute inset-0 bg-black/70 dark:bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm px-4 gap-3"
											role="status"
											aria-live="polite"
										>
											<ArrowPathIcon
												className="w-8 h-8 animate-spin text-white motion-reduce:animate-none shrink-0"
												aria-hidden
											/>
											<div className="w-full max-w-[220px] space-y-2">
												{progressPct !== undefined && progressPct > 0 ? (
													<>
														<div className="h-2 rounded-full bg-white/20 overflow-hidden">
															<ContentUploadProgressFill pct={progressPct} />
														</div>
														<span className="text-white text-sm block text-center">
															{t('workspace.content.uploadPercent', {
																percent: progressPct,
															})}
														</span>
													</>
												) : (
													<span className="text-white text-sm text-center block">
														{t('workspace.content.uploading')}
													</span>
												)}
											</div>
										</div>
									)}
								</div>
								<div className="flex gap-2 mt-3">
									<label className="flex-1">
										<input
											ref={(el) => {
												fileInputRefs.current[imageDef.key] = el;
											}}
											type="file"
											accept="image/*"
											className="hidden"
											onChange={(e) => {
												const file = e.target.files?.[0];
												if (file) {
													onImageUpload(pageId, section.id, imageDef.key, file);
												}
											}}
											aria-label={`${t('workspace.content.upload')}: ${imageDef.name}`}
										/>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="w-full border-neutral-200 dark:border-slate-600 text-neutral-700 dark:text-slate-300 hover:bg-neutral-50 dark:hover:bg-slate-700"
											disabled={isUploading}
											onClick={() =>
												fileInputRefs.current[imageDef.key]?.click()
											}
										>
											{isUploading ? (
												<>
													<ArrowPathIcon
														width={14}
														height={14}
														className="mr-1 animate-spin motion-reduce:animate-none"
													/>
													{t('workspace.content.uploading')}
												</>
											) : (
												<>
													<ArrowUpTrayIcon
														width={14}
														height={14}
														className="mr-1"
														aria-hidden
													/>
													{imageUrl
														? t('workspace.content.replace')
														: t('workspace.content.upload')}
												</>
											)}
										</Button>
									</label>
									{imageUrl && (
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
											onClick={() => {
												onImageDelete(pageId, section.id, imageDef.key);
											}}
											aria-label={t('workspace.content.deleteImage')}
										>
											<XMarkIcon width={14} height={14} />
										</Button>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Zoom Modal */}
			{zoomImage && (
				<div
					className="fixed inset-0 flex items-center justify-center p-4"
					style={{ zIndex: embeddedModalZ.backdrop }}
				>
					<button
						type="button"
						className="absolute inset-0 bg-black/80 dark:bg-black/90"
						onClick={() => setZoomImage(null)}
						aria-label={t('workspace.content.zoomClose')}
					/>
					<div
						className="relative max-w-7xl max-h-[90vh]"
						style={{ zIndex: embeddedModalZ.content }}
					>
						<img
							src={zoomImage}
							alt={t('workspace.content.zoomAlt')}
							className="max-w-full max-h-[90vh] rounded-xl shadow-2xl"
						/>
						<button
							type="button"
							onClick={() => setZoomImage(null)}
							className="absolute top-4 right-4 min-h-11 min-w-11 p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg hover:bg-white dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-300 transition-colors motion-reduce:transition-none"
							aria-label={t('workspace.content.zoomClose')}
						>
							<XMarkIcon width={24} height={24} />
						</button>
					</div>
				</div>
			)}
		</>
	);
};
