/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Orchestrates presentation editor state, hooks, and handlers for PresentationEditPage.
 *
 * Related:
 * - PresentationEditPage.tsx
 * - presentationEdit/usePresentationEditor*.ts
 */

import {
	useCreatePresentation,
	usePresentation,
	useUpdatePresentation,
	type PresentationSlide,
} from '@services/api/presentations';
import { useCallback, useEffect, useId, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { useParams } from 'react-router';
import { useAdminNavigate } from '../../AdminEmbeddedRouter';
import {
	defaultSlide,
	type ColorScheme,
	type SlideTemplate,
} from './presentationEditorPresets';
import type { PresentationEditSettingsTabId } from './presentationEditSlideSettingsTypes';
import {
	useOllentiTemplateBootstrap,
	type PresentationFormat,
} from './useOllentiTemplateBootstrap';
import { usePresentationEditorAutoSave } from './usePresentationEditorAutoSave';
import { usePresentationEditorDraft } from './usePresentationEditorDraft';
import { usePresentationEditorHistory } from './usePresentationEditorHistory';
import { usePresentationEditorKeyboard } from './usePresentationEditorKeyboard';
import { usePresentationEditorSave } from './usePresentationEditorSave';

export function usePresentationEditorCompose() {
	const { t } = useTranslation('siteStudio');
	const { id } = useParams();
	const navigate = useAdminNavigate();
	const isNew = id === 'new';
	const presentationFieldId = useId();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	const { data: presentationData, isLoading: isLoadingPresentation } =
		usePresentation(isNew ? '' : id || '');
	const createPresentation = useCreatePresentation();
	const updatePresentation = useUpdatePresentation();

	const [title, setTitle] = useState('');
	const [format, setFormat] = useState<PresentationFormat>('classic');
	const [slides, setSlides] = useState<PresentationSlide[]>([
		{ ...defaultSlide },
	]);
	const [isPublished, setIsPublished] = useState(false);
	const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
	const [activeSettingsTab, setActiveSettingsTab] =
		useState<PresentationEditSettingsTabId>('basic');
	const [copiedStyle, setCopiedStyle] =
		useState<Partial<PresentationSlide> | null>(null);
	const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
	const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
	const [slideSearchQuery, setSlideSearchQuery] = useState('');
	const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(
		null
	);
	const [showRemoveImageModal, setShowRemoveImageModal] = useState(false);
	const [pendingDeleteSlideIndex, setPendingDeleteSlideIndex] = useState<
		number | null
	>(null);

	const {
		history,
		historyIndex,
		setHistory,
		setHistoryIndex,
		handleUndo,
		handleRedo,
		initHistory,
	} = usePresentationEditorHistory(slides, setSlides, setSelectedSlideIndex);

	const { draftStorageKey } = usePresentationEditorDraft({
		id,
		isNew,
		title,
		format,
		slides,
		setTitle,
		setFormat,
		setSlides,
		setHistory,
		setHistoryIndex,
	});

	useEffect(() => {
		if (isNew || !presentationData) return;

		setTitle(presentationData.title);
		setFormat(presentationData.format as PresentationFormat);
		const initialSlides =
			presentationData.slides.length > 0
				? presentationData.slides
				: [{ ...defaultSlide }];
		setSlides(initialSlides);
		setIsPublished(presentationData.isPublished);
		initHistory(initialSlides);
	}, [presentationData, isNew, initHistory]);

	useOllentiTemplateBootstrap({
		isNew,
		format,
		slides,
		title,
		setSlides,
		setTitle,
		setHistory,
		setHistoryIndex,
		t,
	});

	const handleSlideChange = useCallback(
		(
			index: number,
			field: keyof PresentationSlide,
			value: string | undefined
		) => {
			setSlides((currentSlides) => {
				const newSlides = [...currentSlides];
				newSlides[index] = { ...newSlides[index], [field]: value };
				return newSlides;
			});
		},
		[]
	);

	const save = usePresentationEditorSave({
		id,
		isNew,
		title,
		format,
		slides,
		isPublished,
		presentationData,
		draftStorageKey,
		createPresentation,
		updatePresentation,
		navigate,
		t,
		handleSlideChange,
	});

	const { autoSaveStatus } = usePresentationEditorAutoSave({
		id,
		isNew,
		title,
		format,
		slides,
		isPublished,
		updatePresentation,
	});

	const handleAddSlide = useCallback(() => {
		setSlides((currentSlides) => {
			const newSlide: PresentationSlide = {
				...defaultSlide,
				id: Date.now().toString(),
			};
			setSelectedSlideIndex(currentSlides.length);
			return [...currentSlides, newSlide];
		});
	}, []);

	const handleDragStart = useCallback((index: number) => {
		setDraggedSlideIndex(index);
	}, []);

	const handleDragOver = useCallback(
		(e: DragEvent, index: number) => {
			e.preventDefault();
			e.stopPropagation();
			if (draggedSlideIndex === null || draggedSlideIndex === index) return;

			setSlides((currentSlides) => {
				const newSlides = [...currentSlides];
				const draggedSlide = newSlides[draggedSlideIndex];
				newSlides.splice(draggedSlideIndex, 1);
				const insertIndex = draggedSlideIndex < index ? index - 1 : index;
				newSlides.splice(insertIndex, 0, draggedSlide);
				return newSlides;
			});
			setDraggedSlideIndex((prev) => {
				if (prev === null) return null;
				return prev < index ? index - 1 : index;
			});
			setSelectedSlideIndex((prev) => {
				if (draggedSlideIndex === null) return prev;
				return draggedSlideIndex < index ? index - 1 : index;
			});
		},
		[draggedSlideIndex]
	);

	const handleDragEnd = useCallback(() => {
		setDraggedSlideIndex(null);
	}, []);

	const handleDrop = useCallback((e: DragEvent) => {
		e.preventDefault();
		setDraggedSlideIndex(null);
	}, []);

	const requestDeleteSlide = useCallback(
		(index: number) => {
			if (slides.length <= 1) {
				toast.error(t('adminCatalog.presentationEditor.cannotDeleteLastSlide'));
				return;
			}
			setPendingDeleteSlideIndex(index);
		},
		[slides.length, t]
	);

	const cancelDeleteSlide = useCallback(() => {
		setPendingDeleteSlideIndex(null);
	}, []);

	const executeDeleteSlide = useCallback(() => {
		const idx = pendingDeleteSlideIndex;
		if (idx === null) return;
		setPendingDeleteSlideIndex(null);
		setSlides((currentSlides) => {
			const newSlides = currentSlides.filter((_, i) => i !== idx);
			setSelectedSlideIndex((currentIndex) => {
				if (currentIndex >= newSlides.length) {
					return newSlides.length - 1;
				}
				return currentIndex;
			});
			return newSlides;
		});
	}, [pendingDeleteSlideIndex]);

	const handleMoveSlide = useCallback(
		(index: number, direction: 'up' | 'down') => {
			setSlides((currentSlides) => {
				const newSlides = [...currentSlides];
				const targetIndex = direction === 'up' ? index - 1 : index + 1;
				if (targetIndex < 0 || targetIndex >= currentSlides.length) {
					return currentSlides;
				}
				[newSlides[index], newSlides[targetIndex]] = [
					newSlides[targetIndex],
					newSlides[index],
				];
				setSelectedSlideIndex(targetIndex);
				return newSlides;
			});
		},
		[]
	);

	const handleDuplicateSlide = useCallback((index: number) => {
		setSlides((currentSlides) => {
			const slideToCopy = currentSlides[index];
			const newSlide: PresentationSlide = {
				...slideToCopy,
				id: Date.now().toString(),
			};
			const newSlides = [...currentSlides];
			newSlides.splice(index + 1, 0, newSlide);
			setSelectedSlideIndex(index + 1);
			return newSlides;
		});
	}, []);

	const handleApplyColorScheme = useCallback(
		(scheme: ColorScheme) => {
			setSlides((currentSlides) => {
				const newSlides = [...currentSlides];
				newSlides[selectedSlideIndex] = {
					...newSlides[selectedSlideIndex],
					backgroundColor: scheme.backgroundColor,
					textColor: scheme.textColor,
					titleColor: scheme.titleColor,
					contentColor: scheme.contentColor,
				};
				return newSlides;
			});
		},
		[selectedSlideIndex]
	);

	const handleCopyStyle = useCallback(() => {
		const slide = slides[selectedSlideIndex];
		const style: Partial<PresentationSlide> = {
			backgroundColor: slide.backgroundColor,
			backgroundGradient: slide.backgroundGradient,
			textColor: slide.textColor,
			titleColor: slide.titleColor,
			contentColor: slide.contentColor,
			titleFontSize: slide.titleFontSize,
			contentFontSize: slide.contentFontSize,
			textAlign: slide.textAlign,
			titleAlign: slide.titleAlign,
			fontFamily: slide.fontFamily,
			lineHeight: slide.lineHeight,
			transition: slide.transition,
		};
		setCopiedStyle(style);
	}, [slides, selectedSlideIndex]);

	const handlePasteStyle = useCallback(() => {
		if (!copiedStyle) return;
		setSlides((currentSlides) => {
			const newSlides = [...currentSlides];
			newSlides[selectedSlideIndex] = {
				...newSlides[selectedSlideIndex],
				...copiedStyle,
			};
			return newSlides;
		});
	}, [copiedStyle, selectedSlideIndex]);

	const handleApplyTemplate = useCallback(
		(template: SlideTemplate) => {
			setSlides((currentSlides) => {
				const newSlides = [...currentSlides];
				newSlides[selectedSlideIndex] = {
					...newSlides[selectedSlideIndex],
					...template.slide,
					id: newSlides[selectedSlideIndex].id,
					title: newSlides[selectedSlideIndex].title || '',
					content: newSlides[selectedSlideIndex].content || '',
					image: newSlides[selectedSlideIndex].image,
				};
				return newSlides;
			});
		},
		[selectedSlideIndex]
	);

	usePresentationEditorKeyboard({
		selectedSlideIndex,
		slidesLength: slides.length,
		isSaving: save.isSaving,
		isFullscreenPreview,
		previewSlideIndex,
		setSelectedSlideIndex,
		setIsFullscreenPreview,
		setPreviewSlideIndex,
		handleDuplicateSlide,
		requestDeleteSlide,
		handleUndo,
		handleRedo,
	});

	const toggleFullscreenPreview = useCallback(() => {
		setIsFullscreenPreview((prev) => !prev);
		setPreviewSlideIndex(selectedSlideIndex);
	}, [selectedSlideIndex]);

	const confirmRemoveSlideImage = useCallback(() => {
		handleSlideChange(selectedSlideIndex, 'image', '');
		setShowRemoveImageModal(false);
	}, [handleSlideChange, selectedSlideIndex]);

	const selectedSlide = slides[selectedSlideIndex];

	return {
		t,
		id,
		isNew,
		isLoadingPresentation,
		presentationData,
		presentationFieldId,
		embeddedModalZ,
		navigate,
		title,
		setTitle,
		format,
		setFormat,
		slides,
		isPublished,
		setIsPublished,
		selectedSlideIndex,
		setSelectedSlideIndex,
		selectedSlide,
		activeSettingsTab,
		setActiveSettingsTab,
		copiedStyle,
		isFullscreenPreview,
		setIsFullscreenPreview,
		previewSlideIndex,
		setPreviewSlideIndex,
		slideSearchQuery,
		setSlideSearchQuery,
		draggedSlideIndex,
		showRemoveImageModal,
		setShowRemoveImageModal,
		pendingDeleteSlideIndex,
		historyIndex,
		historyLength: history.length,
		autoSaveStatus,
		handleUndo,
		handleRedo,
		handleAddSlide,
		handleDragStart,
		handleDragOver,
		handleDragEnd,
		handleDrop,
		handleMoveSlide,
		handleDuplicateSlide,
		handleSlideChange,
		handleApplyColorScheme,
		handleCopyStyle,
		handlePasteStyle,
		handleApplyTemplate,
		toggleFullscreenPreview,
		confirmRemoveSlideImage,
		cancelDeleteSlide,
		requestDeleteSlide,
		executeDeleteSlide,
		...save,
	};
}

export type PresentationEditorCompose = ReturnType<
	typeof usePresentationEditorCompose
>;
