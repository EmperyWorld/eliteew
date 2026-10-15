// 🔥💎 ELITE EDITOR V2 - AUTO-SAVE HOOK 💎🔥

import { useEffect, useRef, useState, useCallback } from 'react';
import { API_PATHS } from '../services/api/config';
import { debounce } from '../utils/debounce';
import { isAxiosError } from 'axios';
import { apiClient } from '../services/api';
import { log } from '../utils/logger';

export interface UseAutoSaveOptions {
	documentId: string;
	content: string;
	enabled?: boolean;
	debounceMs?: number; // Wait time after user stops typing
	intervalMs?: number; // Periodic save interval
	onSaveSuccess?: () => void;
	onSaveError?: (error: string) => void;
}

export interface UseAutoSaveReturn {
	isSaving: boolean;
	lastSaved: Date | null;
	error: string | null;
	save: () => Promise<void>;
	clearError: () => void;
}

export const useAutoSave = ({
	documentId,
	content,
	enabled = true,
	debounceMs = 2000,
	intervalMs = 30000,
	onSaveSuccess,
	onSaveError,
}: UseAutoSaveOptions): UseAutoSaveReturn => {
	const [isSaving, setIsSaving] = useState(false);
	const [lastSaved, setLastSaved] = useState<Date | null>(null);
	const [error, setError] = useState<string | null>(null);

	const lastContentRef = useRef<string>(content);
	const isSavingRef = useRef(false);
	const lastContentBaselineInitialized = useRef(false);

	// Clear error
	const clearError = useCallback(() => {
		setError(null);
	}, []);

	// Core save function
	const saveDocument = useCallback(
		async (contentToSave: string) => {
			// Prevent duplicate saves
			if (isSavingRef.current) {
				log.info('AutoSave', 'Save already in progress, skipping');
				return;
			}

			// Don't save if content hasn't changed
			if (contentToSave === lastContentRef.current) {
				log.info('AutoSave', 'No changes detected, skipping');
				return;
			}

			isSavingRef.current = true;
			setIsSaving(true);
			setError(null);

			try {
				log.info('AutoSave', `Saving document ${documentId}...`);

				await apiClient.patch(
					`${API_PATHS.ELITE_EDITOR}/documents/${documentId}`,
					{
						content: contentToSave,
					}
				);

				lastContentRef.current = contentToSave;
				setLastSaved(new Date());

				if (onSaveSuccess) {
					onSaveSuccess();
				}

				log.info('AutoSave', 'Document saved successfully');
			} catch (err: unknown) {
				let errorMessage = 'Auto-save failed';
				if (isAxiosError(err)) {
					const data = err.response?.data;
					if (data && typeof data === 'object' && 'detail' in data) {
						errorMessage = String((data as { detail: unknown }).detail);
					}
				} else if (err instanceof Error) {
					errorMessage = err.message;
				}
				log.error('AutoSave', 'Save error', undefined, errorMessage);
				setError(errorMessage);

				if (onSaveError) {
					onSaveError(errorMessage);
				}
			} finally {
				setIsSaving(false);
				isSavingRef.current = false;
			}
		},
		[documentId, onSaveSuccess, onSaveError]
	);

	// Debounced save (triggered after user stops typing)
	const debouncedSave = useRef(
		debounce((contentToSave: string) => {
			if (enabled) {
				saveDocument(contentToSave);
			}
		}, debounceMs)
	).current;

	// Manual save function
	const save = useCallback(async () => {
		// Cancel any pending debounced save
		debouncedSave.cancel();

		// Save immediately
		await saveDocument(content);
	}, [content, saveDocument, debouncedSave]);

	// Trigger debounced save on content change
	useEffect(() => {
		if (enabled && content && content !== lastContentRef.current) {
			log.info('AutoSave', 'Content changed, scheduling debounced save');
			debouncedSave(content);
		}

		// Cleanup
		return () => {
			debouncedSave.cancel();
		};
	}, [content, enabled, debouncedSave]);

	// Periodic save (every intervalMs)
	useEffect(() => {
		if (!enabled || !intervalMs) {
			return;
		}

		const interval = setInterval(() => {
			if (
				content &&
				content !== lastContentRef.current &&
				!isSavingRef.current
			) {
				log.info('AutoSave', 'Periodic save triggered');
				saveDocument(content);
			}
		}, intervalMs);

		return () => clearInterval(interval);
	}, [content, enabled, intervalMs, saveDocument]);

	// Save before page unload (if unsaved changes)
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (content !== lastContentRef.current && enabled) {
				e.preventDefault();
				e.returnValue =
					'You have unsaved changes. Are you sure you want to leave?';

				// Attempt synchronous save (may not complete)
				saveDocument(content);
			}
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	}, [content, enabled, saveDocument]);

	// Baseline for lastContentRef once (avoids stale ref on first paint vs deps without re-syncing every edit)
	useEffect(() => {
		if (!lastContentBaselineInitialized.current) {
			lastContentRef.current = content;
			lastContentBaselineInitialized.current = true;
		}
	}, [content]);

	return {
		isSaving,
		lastSaved,
		error,
		save,
		clearError,
	};
};
