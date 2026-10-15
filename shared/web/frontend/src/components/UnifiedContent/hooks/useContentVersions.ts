/**
 * Hook for managing content versions
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import type { Version } from '../types';
import {
	contentApi,
	getContentCollectionStatus,
	toContentError,
} from '../../../services/contentApi';

interface UseContentVersionsOptions {
	user?: { id?: string; username?: string } | null;
	onSuccess?: (message: string) => void;
	onError?: (message: string, error?: string) => void;
}

interface UseContentVersionsReturn {
	versions: Version[];
	loading: boolean;
	error: string | null;
	status: 'loading' | 'error' | 'empty' | 'ready';
	isEmpty: boolean;
	setVersions: React.Dispatch<React.SetStateAction<Version[]>>;
	fetchVersions: (contentId: string) => Promise<Version[]>;
	downloadVersion: (
		versionId: string,
		versionNumber: number,
		name: string
	) => Promise<boolean>;
	restoreVersion: (
		contentId: string,
		versionNumber: number
	) => Promise<boolean>;
}

export const useContentVersions = (
	options: UseContentVersionsOptions = {}
): UseContentVersionsReturn => {
	const { user, onSuccess, onError } = options;
	const [versions, setVersions] = useState<Version[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Fetch versions
	const fetchVersions = useCallback(
		async (contentId: string): Promise<Version[]> => {
			setLoading(true);
			setError(null);
			try {
				const loadedVersions = await contentApi.listVersions(contentId);
				setVersions(loadedVersions);
				return loadedVersions;
			} catch (error: unknown) {
				const errorMessage = toContentError(error, 'Unknown error');
				setError(errorMessage);
				onError?.('Не удалось загрузить версии', errorMessage);
				return [];
			} finally {
				setLoading(false);
			}
		},
		[onError]
	);

	// Download version
	const downloadVersion = useCallback(
		async (versionId: string, versionNumber: number, name: string) => {
			try {
				await contentApi.downloadVersion(
					versionId,
					`${name}_v${versionNumber}`
				);
				onSuccess?.(`Загружена версия ${versionNumber}`);
				return true;
			} catch (error: unknown) {
				const errorMessage = toContentError(error, 'Unknown error');
				setError(errorMessage);
				onError?.('Загрузка не удалась', errorMessage);
				return false;
			}
		},
		[onSuccess, onError]
	);

	// Restore version
	const restoreVersion = useCallback(
		async (contentId: string, versionNumber: number) => {
			try {
				const restoreDescription = `Восстановлено к версии ${versionNumber} пользователем ${user?.username || 'unknown'} в ${new Date().toLocaleString('ru-RU')}`;

				await contentApi.revertVersion(contentId, versionNumber, {
					change_description: restoreDescription,
					updated_by: user?.id,
				});

				onSuccess?.(
					`Контент возвращен к версии ${versionNumber}. Изменение сохранено в истории версий.`
				);
				return true;
			} catch (error: unknown) {
				const errorMessage = toContentError(error, 'Unknown error');
				setError(errorMessage);
				onError?.('Восстановление не удалось', errorMessage);
				return false;
			}
		},
		[user, onSuccess, onError]
	);

	const status = getContentCollectionStatus(versions, loading, error);

	return {
		versions,
		loading,
		error,
		status,
		isEmpty: status === 'empty',
		setVersions,
		fetchVersions,
		downloadVersion,
		restoreVersion,
	};
};
