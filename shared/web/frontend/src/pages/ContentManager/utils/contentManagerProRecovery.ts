import type { TFunction } from 'i18next';

/** Recovery hint for content operations (P1 UX). */
export function getContentRecoveryHint(
	operation: 'fetch' | 'upload' | 'download' | 'delete' | 'update' | 'batch',
	err: unknown,
	t: TFunction<'contentManager'>
): string {
	const status = (err as { response?: { status?: number } })?.response?.status;
	if (status === 403) return t('errors.recovery.forbidden');
	if (status === 404) return t('errors.recovery.notFound');
	if (status && status >= 500) return t('errors.recovery.server');
	const isNetwork =
		(err as Error)?.message?.toLowerCase().includes('network') ?? false;
	if (isNetwork) return t('errors.recovery.network');
	if (operation === 'fetch') return t('errors.recovery.fetch');
	if (operation === 'upload') return t('errors.recovery.upload');
	if (operation === 'download' || operation === 'batch')
		return t('errors.recovery.downloadOrBatch');
	return t('errors.recovery.default');
}
