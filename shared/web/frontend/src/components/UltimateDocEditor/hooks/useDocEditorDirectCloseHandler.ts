/**
 * Кнопка/запрос закрытия окна редактора: guard → telemetry → модалка или onClose (волна 6.2).
 */

import { useCallback } from 'react';

import { telemetryDocEditorLeaveGuard } from '@/pages/Desktop/utils/desktopTelemetry';

import type { DocEditorLeaveGuardDecision } from '../utils/docEditorLeaveGuard';

export interface UseDocEditorDirectCloseHandlerParams {
	onClose?: () => void;
	getLeaveGuardDecision: () => DocEditorLeaveGuardDecision;
	openDirectCloseConfirm: () => void;
	openTargetRequestId?: string;
}

export function useDocEditorDirectCloseHandler(
	params: UseDocEditorDirectCloseHandlerParams
): () => void {
	const {
		onClose,
		getLeaveGuardDecision,
		openDirectCloseConfirm,
		openTargetRequestId,
	} = params;

	return useCallback((): void => {
		if (!onClose) {
			return;
		}

		const guard = getLeaveGuardDecision();
		if (guard.shouldBlock) {
			telemetryDocEditorLeaveGuard({
				channel: 'direct_close',
				reason: guard.reason,
				blocked: true,
				requestId: openTargetRequestId,
			});
			openDirectCloseConfirm();
			return;
		}

		onClose();
	}, [
		onClose,
		openDirectCloseConfirm,
		getLeaveGuardDecision,
		openTargetRequestId,
	]);
}
