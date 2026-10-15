/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky toolbar for system GAF onboarding instruction template (refresh, save, test, import/export).
 *
 * Invariants:
 * - Save hotkey is handled in parent section (Ctrl/Cmd+S).
 *
 * Related:
 * - `pages/Admin/SystemGafInstructionSection.tsx`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowUpTrayIcon,
	PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../Desktop/constants';

type Props = {
	loading: boolean;
	instructionFetching: boolean;
	previewFetching: boolean;
	savePending: boolean;
	sendTestPending: boolean;
	onRefresh: () => void;
	onSave: () => void;
	onSendTest: () => void;
	onExportJson: () => void;
	onImportClick: () => void;
};

export function SystemGafInstructionToolbar({
	loading,
	instructionFetching,
	previewFetching,
	savePending,
	sendTestPending,
	onRefresh,
	onSave,
	onSendTest,
	onExportJson,
	onImportClick,
}: Props): React.ReactElement {
	const { t } = useTranslation('desktopUi', {
		keyPrefix: 'adminGafInstruction',
	});

	return (
		<div
			className={`sticky top-0 z-10 -mx-6 mb-4 border-b border-white/10 bg-slate-950/90 px-6 py-3 backdrop-blur-sm ${DESKTOP_SURFACE.radius}`}
		>
			<div
				className="flex flex-wrap items-center gap-3"
				role="toolbar"
				aria-label={t('toolbar.aria')}
			>
				<button
					type="button"
					onClick={() => void onRefresh()}
					disabled={loading || instructionFetching}
					className={`inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/90 hover:bg-white/5 disabled:opacity-50 ${DESKTOP_INTERACTIVE.focusRing}`}
				>
					{instructionFetching || previewFetching ? (
						<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
					) : null}
					{t('toolbar.refresh')}
				</button>
				<button
					type="button"
					onClick={() => void onSave()}
					disabled={savePending || loading}
					title={t('toolbar.saveTitle')}
					className={`inline-flex items-center gap-1 rounded-lg bg-violet-600/90 px-3 py-1.5 text-sm text-white hover:bg-violet-600 disabled:opacity-50 ${DESKTOP_INTERACTIVE.focusRing}`}
				>
					{savePending ? (
						<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
					) : (
						<ArrowDownTrayIcon className="h-4 w-4" />
					)}
					{t('toolbar.save')}
				</button>
				<button
					type="button"
					onClick={() => onSendTest()}
					disabled={sendTestPending || loading}
					className={`inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-50 ${DESKTOP_INTERACTIVE.focusRing}`}
				>
					{sendTestPending ? (
						<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
					) : (
						<PaperAirplaneIcon className="h-4 w-4" />
					)}
					{t('toolbar.sendTest')}
				</button>
				<span
					className="hidden sm:inline w-px h-6 bg-white/15 shrink-0"
					aria-hidden
				/>
				<button
					type="button"
					onClick={onExportJson}
					disabled={loading}
					className={`inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50 ${DESKTOP_INTERACTIVE.focusRing}`}
				>
					<ArrowDownTrayIcon className="h-4 w-4 shrink-0" aria-hidden />
					{t('toolbar.exportJson')}
				</button>
				<button
					type="button"
					onClick={onImportClick}
					disabled={loading}
					className={`inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50 ${DESKTOP_INTERACTIVE.focusRing}`}
				>
					<ArrowUpTrayIcon className="h-4 w-4 shrink-0" aria-hidden />
					{t('toolbar.importJson')}
				</button>
			</div>
			<p className={`mt-2 ${DESKTOP_TYPOGRAPHY.meta} text-slate-500`}>
				{t('toolbar.hotkeyHint')}
			</p>
		</div>
	);
}
