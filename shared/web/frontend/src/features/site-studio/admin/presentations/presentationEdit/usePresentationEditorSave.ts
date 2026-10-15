/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Manual save, image upload, and duplicate-presentation flows for the editor.
 *
 * Related:
 * - PresentationEditPage.tsx
 */

import type {
	Presentation,
	PresentationSlide,
} from '@services/api/presentations';
import { uploadImage } from '@services/api/upload';
import { useCallback, useRef, useState, type FormEvent } from 'react';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { formatAdminApiError } from '../../consultations/formatAdminApiError';
import type { PresentationFormat } from './useOllentiTemplateBootstrap';

export type UsePresentationEditorSaveArgs = {
	id: string | undefined;
	isNew: boolean;
	title: string;
	format: PresentationFormat;
	slides: PresentationSlide[];
	isPublished: boolean;
	presentationData: Presentation | undefined;
	draftStorageKey: string;
	createPresentation: {
		mutateAsync: (data: Partial<Presentation>) => Promise<Presentation>;
	};
	updatePresentation: {
		mutateAsync: (
			data: Partial<Presentation> & { id: string }
		) => Promise<unknown>;
	};
	navigate: (path: string) => void;
	t: TFunction<'siteStudio'>;
	handleSlideChange: (
		index: number,
		field: keyof PresentationSlide,
		value: string | undefined
	) => void;
};

export function usePresentationEditorSave({
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
}: UsePresentationEditorSaveArgs) {
	const [isSaving, setIsSaving] = useState(false);
	const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(
		null
	);
	const [showDuplicateModal, setShowDuplicateModal] = useState(false);
	const [showEmptySlidesModal, setShowEmptySlidesModal] = useState(false);
	const skipEmptySlidesCheckRef = useRef(false);

	const runSave = useCallback(async () => {
		if (!title.trim()) {
			toast.error(t('adminCatalog.presentationEditor.validationTitle'));
			return;
		}

		if (slides.length === 0) {
			toast.error(t('adminCatalog.presentationEditor.validationMinSlides'));
			return;
		}

		const hasEmptySlides = slides.some(
			(slide) =>
				!slide.title?.trim() &&
				!slide.content?.trim() &&
				!slide.image &&
				slide.layout !== 'full-image'
		);

		if (hasEmptySlides && !skipEmptySlidesCheckRef.current) {
			setShowEmptySlidesModal(true);
			return;
		}
		skipEmptySlidesCheckRef.current = false;

		setIsSaving(true);

		try {
			const payload: Partial<Presentation> = {
				title: title.trim(),
				format,
				slides,
				isPublished,
			};

			if (isNew) {
				const result = await createPresentation.mutateAsync(payload);
				localStorage.removeItem(draftStorageKey);
				navigate(`/admin/presentations/${result.id}`);
			} else {
				if (!id) {
					toast.error(t('adminCatalog.presentationEditor.validationMissingId'));
					return;
				}
				await updatePresentation.mutateAsync({ id, ...payload });
				localStorage.removeItem(draftStorageKey);
			}
		} catch (error) {
			console.error('Failed to save presentation:', error);
			toast.error(
				formatAdminApiError(error, t('adminCatalog.errors.presentationSave'))
			);
		} finally {
			setIsSaving(false);
		}
	}, [
		title,
		slides,
		format,
		isPublished,
		isNew,
		id,
		draftStorageKey,
		createPresentation,
		updatePresentation,
		navigate,
		t,
	]);

	const handleSubmit = useCallback(
		async (e: FormEvent) => {
			e.preventDefault();
			await runSave();
		},
		[runSave]
	);

	const confirmEmptySlidesSave = useCallback(async () => {
		setShowEmptySlidesModal(false);
		skipEmptySlidesCheckRef.current = true;
		await runSave();
	}, [runSave]);

	const handleImageUpload = useCallback(
		async (slideIndex: number, file: File) => {
			if (!file.type.startsWith('image/')) {
				toast.error(t('adminCatalog.presentationEditor.validationImageType'));
				return;
			}

			const maxSize = 10 * 1024 * 1024;
			if (file.size > maxSize) {
				toast.error(t('adminCatalog.presentationEditor.validationImageSize'));
				return;
			}

			setUploadingImageIndex(slideIndex);
			try {
				const url = await uploadImage(file);
				handleSlideChange(slideIndex, 'image', url);
			} catch (error) {
				console.error('Upload failed:', error);
				toast.error(
					formatAdminApiError(error, t('adminCatalog.errors.uploadImage'))
				);
			} finally {
				setUploadingImageIndex(null);
			}
		},
		[handleSlideChange, t]
	);

	const requestDuplicatePresentation = useCallback(() => {
		setShowDuplicateModal(true);
	}, []);

	const executeDuplicatePresentation = useCallback(async () => {
		if (!id || !presentationData) return;

		try {
			const duplicatedPresentation: Partial<Presentation> = {
				title: `${presentationData.title} (копия)`,
				format: presentationData.format,
				slides: presentationData.slides.map((slide) => ({
					...slide,
					id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
				})),
				isPublished: false,
			};

			const result = await createPresentation.mutateAsync(
				duplicatedPresentation
			);
			setShowDuplicateModal(false);
			navigate(`/admin/presentations/${result.id}`);
		} catch (error) {
			console.error('Failed to duplicate presentation:', error);
			toast.error(
				formatAdminApiError(
					error,
					t('adminCatalog.presentationEditor.duplicateFailed')
				)
			);
		}
	}, [id, presentationData, createPresentation, navigate, t]);

	return {
		isSaving,
		uploadingImageIndex,
		showDuplicateModal,
		setShowDuplicateModal,
		showEmptySlidesModal,
		setShowEmptySlidesModal,
		handleSubmit,
		confirmEmptySlidesSave,
		handleImageUpload,
		requestDuplicatePresentation,
		executeDuplicatePresentation,
	};
}
