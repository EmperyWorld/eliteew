/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Debounced server auto-save for existing presentations in the editor.
 *
 * Related:
 * - PresentationEditPage.tsx
 */

import type { PresentationSlide } from '@services/api/presentations';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PresentationFormat } from './useOllentiTemplateBootstrap';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved';

export type UsePresentationEditorAutoSaveArgs = {
	id: string | undefined;
	isNew: boolean;
	title: string;
	format: PresentationFormat;
	slides: PresentationSlide[];
	isPublished: boolean;
	updatePresentation: {
		mutateAsync: (payload: {
			id: string;
			title: string;
			format: PresentationFormat;
			slides: PresentationSlide[];
			isPublished: boolean;
		}) => Promise<unknown>;
	};
};

export function usePresentationEditorAutoSave({
	id,
	isNew,
	title,
	format,
	slides,
	isPublished,
	updatePresentation,
}: UsePresentationEditorAutoSaveArgs) {
	const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
	const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const autoSave = useCallback(async () => {
		if (isNew || !id) return;

		if (autoSaveTimeoutRef.current) {
			clearTimeout(autoSaveTimeoutRef.current);
		}

		autoSaveTimeoutRef.current = setTimeout(async () => {
			const presentationId = id;
			if (!presentationId) return;
			setAutoSaveStatus('saving');
			try {
				await updatePresentation.mutateAsync({
					id: presentationId,
					title: title.trim(),
					format,
					slides,
					isPublished,
				});
				setAutoSaveStatus('saved');
				setTimeout(() => setAutoSaveStatus('idle'), 2000);
			} catch (error) {
				console.error('Auto-save failed:', error);
				setAutoSaveStatus('idle');
			}
		}, 2000);
	}, [id, isNew, title, format, slides, isPublished, updatePresentation]);

	useEffect(() => {
		if (!isNew && id) {
			autoSave();
		}
		return () => {
			if (autoSaveTimeoutRef.current) {
				clearTimeout(autoSaveTimeoutRef.current);
			}
		};
	}, [isNew, id, autoSave]);

	return { autoSaveStatus };
}
