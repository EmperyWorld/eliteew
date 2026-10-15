/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared loading/error/empty frame and error classification for EWA companion admin tabs.
 *
 * Related:
 * - src/features/ewa/admin/ewaCompanionAdminApi.ts
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_SURFACE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	classifyEwaCompanionAdminError,
	type EwaCompanionAdminErrorCode,
} from './ewaCompanionAdminApi';

export function useEwaCompanionAdminErrorMessage(
	error: unknown
): string | null {
	const { t } = useTranslation('desktopUi');
	if (!error) {
		return null;
	}
	const code: EwaCompanionAdminErrorCode =
		classifyEwaCompanionAdminError(error);
	const keyMap: Record<EwaCompanionAdminErrorCode, string> = {
		admin_disabled: 'ewaCompanionAdmin.errorAdminDisabled',
		write_disabled: 'ewaCompanionAdmin.errorWriteDisabled',
		forbidden: 'ewaCompanionAdmin.errorForbidden',
		load_failed: 'ewaCompanionAdmin.errorLoadFailed',
	};
	return t(keyMap[code]);
}

export function EwaCompanionAdminErrorBanner({
	message,
}: {
	message: string;
}): React.ReactElement {
	return (
		<div
			className={`${DESKTOP_SURFACE.radius} border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200`}
		>
			{message}
		</div>
	);
}

export function EwaCompanionAdminCatalogFrame({
	isLoading,
	error,
	empty,
	loadingLabel,
	emptyLabel,
	children,
}: {
	isLoading: boolean;
	error: unknown;
	empty: boolean;
	loadingLabel: string;
	emptyLabel: string;
	children: React.ReactNode;
}): React.ReactElement {
	const errorMessage = useEwaCompanionAdminErrorMessage(error);
	if (isLoading) {
		return (
			<p className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}>
				{loadingLabel}
			</p>
		);
	}
	if (errorMessage) {
		return <EwaCompanionAdminErrorBanner message={errorMessage} />;
	}
	if (empty) {
		return (
			<p className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}>
				{emptyLabel}
			</p>
		);
	}
	return <>{children}</>;
}
