/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Site Studio admin page for creating and editing presentations (slide deck editor).
 *
 * Invariants:
 * - export const PresentationEditPage remains the route entry on this path.
 *
 * Related:
 * - presentationEdit/* atomized modules
 * - presentations/index.ts barrel
 */

import { Button } from '@components/atoms/Button';
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { PresentationEditBasicInfoCard } from './presentationEdit/PresentationEditBasicInfoCard';
import { PresentationEditHeader } from './presentationEdit/PresentationEditHeader';
import { PresentationEditModals } from './presentationEdit/PresentationEditModals';
import { PresentationEditPublishingPanel } from './presentationEdit/PresentationEditPublishingPanel';
import { PresentationEditSlideEditorChrome } from './presentationEdit/PresentationEditSlideEditorChrome';
import { PresentationEditSlidePreview } from './presentationEdit/PresentationEditSlidePreview';
import { PresentationEditSlideSettingsBasicTab } from './presentationEdit/PresentationEditSlideSettingsBasicTab';
import { PresentationEditSlideSettingsColorsTab } from './presentationEdit/PresentationEditSlideSettingsColorsTab';
import { PresentationEditSlideSettingsImageTab } from './presentationEdit/PresentationEditSlideSettingsImageTab';
import { PresentationEditSlideSettingsTypographyTab } from './presentationEdit/PresentationEditSlideSettingsTypographyTab';
import { PresentationEditSlidesSidebar } from './presentationEdit/PresentationEditSlidesSidebar';
import { PresentationEditStatisticsPanel } from './presentationEdit/PresentationEditStatisticsPanel';
import { usePresentationEditorCompose } from './presentationEdit/usePresentationEditorCompose';
import './presentation.css';

export const PresentationEditPage: React.FC = () => {
	const editor = usePresentationEditorCompose();

	if (editor.isLoadingPresentation && !editor.isNew) {
		return (
			<div className="flex flex-col items-center justify-center h-[60vh] gap-4">
				<div className="relative">
					<div className="w-16 h-16 rounded-2xl bg-linear-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 flex items-center justify-center">
						<ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
					</div>
				</div>
				<p className="text-neutral-500 dark:text-slate-400 text-sm">
					Загрузка презентации...
				</p>
			</div>
		);
	}

	const { selectedSlide } = editor;

	return (
		<>
			<form onSubmit={editor.handleSubmit} className="pb-12">
				<div className="mb-2">
					<Button
						variant="ghost"
						type="button"
						className="gap-2 -ml-2 text-neutral-600 dark:text-slate-300 hover:text-neutral-900 dark:hover:text-white"
						onClick={() => editor.navigate('/admin/presentations')}
					>
						<ArrowLeftIcon width={18} height={18} aria-hidden />
						{editor.t('adminCatalog.common.backToList')}
					</Button>
				</div>

				<PresentationEditHeader
					isNew={editor.isNew}
					isSaving={editor.isSaving}
					presentationData={editor.presentationData}
					autoSaveStatus={editor.autoSaveStatus}
					onNavigateList={() => editor.navigate('/admin/presentations')}
					onRequestDuplicate={editor.requestDuplicatePresentation}
				/>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<div className="lg:col-span-2 space-y-6">
						<PresentationEditBasicInfoCard
							presentationFieldId={editor.presentationFieldId}
							title={editor.title}
							format={editor.format}
							onTitleChange={editor.setTitle}
							onFormatChange={editor.setFormat}
						/>

						<div className="flex items-center gap-3 py-1">
							<hr className="h-px min-h-px flex-1 border-0 bg-neutral-200 dark:bg-slate-600" />
							<span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-slate-400">
								Слайды
							</span>
							<hr className="h-px min-h-px flex-1 border-0 bg-neutral-200 dark:bg-slate-600" />
						</div>

						{selectedSlide && (
							<PresentationEditSlidePreview
								selectedSlide={selectedSlide}
								slides={editor.slides}
								isFullscreenPreview={editor.isFullscreenPreview}
								previewSlideIndex={editor.previewSlideIndex}
								embeddedModalZ={editor.embeddedModalZ}
								onToggleFullscreen={editor.toggleFullscreenPreview}
								onCloseFullscreen={() => editor.setIsFullscreenPreview(false)}
								onPreviewSlideIndexChange={editor.setPreviewSlideIndex}
							/>
						)}

						{selectedSlide && (
							<PresentationEditSlideEditorChrome
								selectedSlide={selectedSlide}
								selectedSlideIndex={editor.selectedSlideIndex}
								slidesLength={editor.slides.length}
								activeSettingsTab={editor.activeSettingsTab}
								onActiveSettingsTabChange={editor.setActiveSettingsTab}
								onMoveSlide={editor.handleMoveSlide}
								onDuplicateSlide={editor.handleDuplicateSlide}
								onRequestDeleteSlide={editor.requestDeleteSlide}
							>
								{editor.activeSettingsTab === 'basic' && (
									<PresentationEditSlideSettingsBasicTab
										slide={selectedSlide}
										slideIndex={editor.selectedSlideIndex}
										onSlideChange={editor.handleSlideChange}
										copiedStyle={editor.copiedStyle}
										onApplyTemplate={editor.handleApplyTemplate}
										onCopyStyle={editor.handleCopyStyle}
										onPasteStyle={editor.handlePasteStyle}
									/>
								)}
								{editor.activeSettingsTab === 'typography' && (
									<PresentationEditSlideSettingsTypographyTab
										slide={selectedSlide}
										slideIndex={editor.selectedSlideIndex}
										onSlideChange={editor.handleSlideChange}
									/>
								)}
								{editor.activeSettingsTab === 'colors' && (
									<PresentationEditSlideSettingsColorsTab
										slide={selectedSlide}
										slideIndex={editor.selectedSlideIndex}
										onSlideChange={editor.handleSlideChange}
										onApplyColorScheme={editor.handleApplyColorScheme}
									/>
								)}
								{editor.activeSettingsTab === 'image' &&
									(selectedSlide.layout === 'image-content' ||
										selectedSlide.layout === 'title-image-content' ||
										selectedSlide.layout === 'full-image') && (
										<PresentationEditSlideSettingsImageTab
											slide={selectedSlide}
											slideIndex={editor.selectedSlideIndex}
											onSlideChange={editor.handleSlideChange}
											uploadingImageIndex={editor.uploadingImageIndex}
											removeImageModalTitle={editor.t(
												'adminCatalog.presentationEditor.removeImageModalTitle'
											)}
											onImageUpload={editor.handleImageUpload}
											onRequestRemoveImage={() =>
												editor.setShowRemoveImageModal(true)
											}
										/>
									)}
							</PresentationEditSlideEditorChrome>
						)}
					</div>

					<div className="lg:col-span-1 space-y-6">
						<div className="sticky top-24 space-y-6">
							<PresentationEditSlidesSidebar
								slides={editor.slides}
								selectedSlideIndex={editor.selectedSlideIndex}
								slideSearchQuery={editor.slideSearchQuery}
								draggedSlideIndex={editor.draggedSlideIndex}
								historyIndex={editor.historyIndex}
								historyLength={editor.historyLength}
								onSlideSearchQueryChange={editor.setSlideSearchQuery}
								onSelectSlide={editor.setSelectedSlideIndex}
								onAddSlide={editor.handleAddSlide}
								onUndo={editor.handleUndo}
								onRedo={editor.handleRedo}
								onDragStart={editor.handleDragStart}
								onDragOver={editor.handleDragOver}
								onDragEnd={editor.handleDragEnd}
								onDrop={editor.handleDrop}
							/>

							{selectedSlide && (
								<PresentationEditStatisticsPanel
									slides={editor.slides}
									selectedSlide={selectedSlide}
								/>
							)}

							<PresentationEditPublishingPanel
								presentationFieldId={editor.presentationFieldId}
								isPublished={editor.isPublished}
								onIsPublishedChange={editor.setIsPublished}
							/>
						</div>
					</div>
				</div>
			</form>

			<PresentationEditModals
				showDuplicateModal={editor.showDuplicateModal}
				onCloseDuplicateModal={() => editor.setShowDuplicateModal(false)}
				onConfirmDuplicate={editor.executeDuplicatePresentation}
				pendingDeleteSlideIndex={editor.pendingDeleteSlideIndex}
				onCancelDeleteSlide={editor.cancelDeleteSlide}
				onConfirmDeleteSlide={editor.executeDeleteSlide}
				showEmptySlidesModal={editor.showEmptySlidesModal}
				onCloseEmptySlidesModal={() => editor.setShowEmptySlidesModal(false)}
				onConfirmEmptySlidesSave={editor.confirmEmptySlidesSave}
				showRemoveImageModal={editor.showRemoveImageModal}
				onCloseRemoveImageModal={() => editor.setShowRemoveImageModal(false)}
				onConfirmRemoveSlideImage={editor.confirmRemoveSlideImage}
			/>
		</>
	);
};
