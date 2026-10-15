/**
 * Фиксированный порядок внешнего shell редактора (DnD → баннер → шапка → …).
 * Только композиция: слоты и обёртка `<div>` — без хуков и store.
 */

import * as React from 'react';

import { cn } from '@/utils/cn';

export type UltimateDocEditorChromeStackShellProps = Omit<
	React.ComponentPropsWithoutRef<'div'>,
	'children'
> & {
	'data-desktop-window-ignore-context'?: boolean | '';
};

export interface UltimateDocEditorChromeStackProps {
	shell: UltimateDocEditorChromeStackShellProps;
	dragDropChrome: React.ReactNode;
	saveErrorBanner: React.ReactNode;
	documentHeader: React.ReactNode;
	quickStartGuide: React.ReactNode;
	draftRecoveryModal: React.ReactNode;
	closeConfirmModal: React.ReactNode;
	destructiveConfirmModal: React.ReactNode;
	mainGrid: React.ReactNode;
	panelOverlays: React.ReactNode;
	guideTourModal: React.ReactNode;
}

export function UltimateDocEditorChromeStack({
	shell,
	dragDropChrome,
	saveErrorBanner,
	documentHeader,
	quickStartGuide,
	draftRecoveryModal,
	closeConfirmModal,
	destructiveConfirmModal,
	mainGrid,
	panelOverlays,
	guideTourModal,
}: UltimateDocEditorChromeStackProps): React.JSX.Element {
	const { className: shellClassName, ...shellRest } = shell;

	return (
		<div {...shellRest} className={cn(shellClassName)}>
			{dragDropChrome}
			{saveErrorBanner}
			{documentHeader}
			{quickStartGuide}
			{draftRecoveryModal}
			{closeConfirmModal}
			{destructiveConfirmModal}
			{mainGrid}
			{panelOverlays}
			{guideTourModal}
		</div>
	);
}
