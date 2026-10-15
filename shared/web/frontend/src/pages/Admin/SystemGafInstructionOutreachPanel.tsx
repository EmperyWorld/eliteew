/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Test send, single UUID, bulk list, and broadcast-to-all controls for GAF instruction outreach.
 *
 * Related:
 * - `pages/Admin/SystemGafInstructionSection.tsx`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_INTERACTIVE, DESKTOP_TYPOGRAPHY } from '../Desktop/constants';
import {
	ADMIN_SHELL_BTN_ACCENT,
	ADMIN_SHELL_BTN_SECONDARY,
	ADMIN_SHELL_BTN_WARN,
	ADMIN_SHELL_INPUT_MONO,
} from './shell/adminFormClasses';
import { BULK_SEND_CHUNK_SIZE } from './systemGafInstructionPreview';
import {
	ArrowPathIcon,
	ClipboardDocumentIcon,
	MegaphoneIcon,
	PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

type BulkParsed = { valid: string[]; invalidTokens: string[] };

type Props = {
	templateLocale: string;
	broadcastConfirmPhrase: string;
	sendUserId: string;
	setSendUserId: (v: string) => void;
	onSendOne: () => void;
	sendSinglePending: boolean;
	bulkUserIdsText: string;
	setBulkUserIdsText: (v: string) => void;
	bulkParsed: BulkParsed;
	dryRunBulk: boolean;
	setDryRunBulk: (v: boolean) => void;
	onSendBulk: () => void;
	sendBulkPending: boolean;
	bulkProgress: {
		chunk: number;
		chunks: number;
		sent: number;
		skipped: number;
	} | null;
	recipientCount: number | null;
	previewLoading: boolean;
	broadcastConfirm: string;
	setBroadcastConfirm: (v: string) => void;
	onQueueBroadcast: () => void;
	broadcastPending: boolean;
	broadcastTaskId: string | null;
	onCopyTaskId: (id: string) => void;
};

export function SystemGafInstructionOutreachPanel({
	templateLocale,
	broadcastConfirmPhrase,
	sendUserId,
	setSendUserId,
	onSendOne,
	sendSinglePending,
	bulkUserIdsText,
	setBulkUserIdsText,
	bulkParsed,
	dryRunBulk,
	setDryRunBulk,
	onSendBulk,
	sendBulkPending,
	bulkProgress,
	recipientCount,
	previewLoading,
	broadcastConfirm,
	setBroadcastConfirm,
	onQueueBroadcast,
	broadcastPending,
	broadcastTaskId,
	onCopyTaskId,
}: Props): React.ReactElement {
	const { t } = useTranslation('desktopUi', {
		keyPrefix: 'adminGafInstruction',
	});
	const { t: tUi } = useTranslation('desktopUi');

	return (
		<div
			className={`space-y-4 pt-4 border-t border-white/10 ${DESKTOP_TYPOGRAPHY.meta}`}
		>
			<p className="text-slate-400 text-sm leading-relaxed">
				{t('outreach.uuidHelp')}
			</p>
			<p className="text-slate-500 text-sm leading-relaxed">
				{t('outreach.sendUsesTemplateLocale', { locale: templateLocale })}
			</p>

			<div className="flex flex-wrap items-end gap-3">
				<label className="flex-1 min-w-[200px]">
					<span className="block text-slate-400 mb-1">
						{t('outreach.sendOneLabel')}
					</span>
					<input
						type="text"
						value={sendUserId}
						onChange={(e) => setSendUserId(e.target.value)}
						placeholder={t('outreach.uuidPlaceholder')}
						className={ADMIN_SHELL_INPUT_MONO}
						spellCheck={false}
						autoComplete="off"
					/>
				</label>
				<button
					type="button"
					onClick={() => void onSendOne()}
					disabled={sendSinglePending}
					className={ADMIN_SHELL_BTN_SECONDARY}
				>
					{sendSinglePending ? (
						<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
					) : (
						<PaperAirplaneIcon className="h-4 w-4" />
					)}
					{t('outreach.send')}
				</button>
			</div>

			<div className="eliteew-admin-shell__subpanel space-y-3">
				<div className={DESKTOP_TYPOGRAPHY.caption}>
					{t('outreach.bulkTitle')}
				</div>
				<p className="text-slate-500 text-xs">
					{t('outreach.bulkHint', { chunkSize: BULK_SEND_CHUNK_SIZE })}
				</p>
				{bulkParsed.valid.length > 0 || bulkParsed.invalidTokens.length > 0 ? (
					<p className="text-slate-400 text-xs">
						{t('outreach.bulkParsed', { count: bulkParsed.valid.length })}
						{bulkParsed.invalidTokens.length > 0
							? t('outreach.bulkInvalid', {
									count: bulkParsed.invalidTokens.length,
								})
							: null}
					</p>
				) : null}
				<label className="block">
					<span className="block text-slate-400 mb-1 text-xs">
						{t('outreach.bulkListLabel')}
					</span>
					<textarea
						value={bulkUserIdsText}
						onChange={(e) => setBulkUserIdsText(e.target.value)}
						rows={5}
						placeholder={t('outreach.bulkListPlaceholder')}
						className={ADMIN_SHELL_INPUT_MONO}
						spellCheck={false}
					/>
				</label>
				<label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
					<input
						type="checkbox"
						checked={dryRunBulk}
						onChange={(e) => setDryRunBulk(e.target.checked)}
						className="rounded border-white/20 bg-slate-900"
					/>
					{t('outreach.dryRun')}
				</label>
				<div className="flex flex-wrap items-center gap-3">
					<button
						type="button"
						onClick={() => void onSendBulk()}
						disabled={sendBulkPending || bulkParsed.valid.length === 0}
						className={ADMIN_SHELL_BTN_ACCENT}
					>
						{sendBulkPending ? (
							<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
						) : (
							<PaperAirplaneIcon className="h-4 w-4" />
						)}
						{dryRunBulk ? t('outreach.verifyList') : t('outreach.sendList')}
					</button>
					{sendBulkPending && bulkProgress ? (
						<span className="text-slate-500 text-xs tabular-nums">
							{t('outreach.bulkProgress', {
								chunk: bulkProgress.chunk,
								chunks: bulkProgress.chunks,
							})}
						</span>
					) : null}
				</div>
			</div>

			<div className="eliteew-admin-shell__subpanel eliteew-admin-shell__subpanel--warn space-y-3">
				<div className="flex flex-wrap items-center gap-2 text-slate-200 text-sm">
					<MegaphoneIcon
						className="h-4 w-4 text-amber-400 shrink-0"
						aria-hidden
					/>
					<span>{t('outreach.broadcastIntro')}</span>
				</div>
				<p className="text-slate-400 text-xs">
					{t('outreach.recipientEstimate')}{' '}
					{previewLoading ? (
						<span className="text-slate-500">{t('outreach.loading')}</span>
					) : recipientCount === null ? (
						<span className="text-slate-500">{tUi('adminCommon.emDash')}</span>
					) : (
						<strong className="text-slate-200">{recipientCount}</strong>
					)}{' '}
					{t('outreach.recipientRefreshHint')}
				</p>
				<label className="block">
					<span className="block text-slate-400 mb-1 text-xs">
						{t('outreach.confirmLabel')}
					</span>
					<code className="block mb-2 rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-xs text-amber-100/90 select-all">
						{broadcastConfirmPhrase}
					</code>
					<input
						type="text"
						value={broadcastConfirm}
						onChange={(e) => setBroadcastConfirm(e.target.value)}
						placeholder={broadcastConfirmPhrase}
						autoComplete="off"
						className={`${ADMIN_SHELL_INPUT_MONO} max-w-xl`}
					/>
				</label>
				<button
					type="button"
					disabled={broadcastPending}
					onClick={() => void onQueueBroadcast()}
					className={ADMIN_SHELL_BTN_WARN}
				>
					{broadcastPending ? (
						<ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden />
					) : (
						<MegaphoneIcon className="h-4 w-4" aria-hidden />
					)}
					{broadcastPending
						? t('outreach.queuePending')
						: t('outreach.queueBroadcast')}
				</button>
				{broadcastTaskId ? (
					<div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
						<span>{t('outreach.lastTaskId')}</span>
						<code className="rounded bg-black/40 px-2 py-1 font-mono text-amber-100/90">
							{broadcastTaskId}
						</code>
						<button
							type="button"
							onClick={() => void onCopyTaskId(broadcastTaskId)}
							className={`inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-amber-100/90 hover:bg-white/5 ${DESKTOP_INTERACTIVE.focusRing}`}
						>
							<ClipboardDocumentIcon className="h-3.5 w-3.5" aria-hidden />
							{t('outreach.copy')}
						</button>
					</div>
				) : null}
			</div>
		</div>
	);
}
