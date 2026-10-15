/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Prompt template CRUD tab for Desktop AI Chat admin.
 */

import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { useDesktopAiDialogFocusTrap } from '../../../features/desktop-ai-chat/useDesktopAiDialogFocusTrap';
import {
	createDesktopAiChatPromptTemplate,
	deleteDesktopAiChatPromptTemplate,
	patchDesktopAiChatPromptTemplate,
} from './desktopAiChatAdminApi';
import { useDesktopAiChatAdmin } from './DesktopAiChatAdminContext';
import { DesktopAiChatAdminStatusBanner } from './DesktopAiChatAdminStatusBanner';
import type { DesktopAiChatPromptTemplateRow } from './desktopAiChatAdminTypes';

export function DesktopAiChatTemplatesTab(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const { templates, setTemplates, refresh } = useDesktopAiChatAdmin();
	const [editorOpen, setEditorOpen] = React.useState(false);
	const [deleteTarget, setDeleteTarget] =
		React.useState<DesktopAiChatPromptTemplateRow | null>(null);
	const [busy, setBusy] = React.useState(false);
	const [statusKind, setStatusKind] = React.useState<
		'success' | 'error' | null
	>(null);
	const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
	const [editing, setEditing] =
		React.useState<DesktopAiChatPromptTemplateRow | null>(null);
	const [templateKey, setTemplateKey] = React.useState('');
	const [displayName, setDisplayName] = React.useState('');
	const [systemPrompt, setSystemPrompt] = React.useState('');
	const [isActive, setIsActive] = React.useState(true);
	const dialogRef = React.useRef<HTMLDivElement>(null);
	const openButtonRef = React.useRef<HTMLButtonElement>(null);
	useDesktopAiDialogFocusTrap(dialogRef, editorOpen);

	const resetEditor = () => {
		setEditing(null);
		setTemplateKey('');
		setDisplayName('');
		setSystemPrompt('');
		setIsActive(true);
	};

	const openCreate = () => {
		resetEditor();
		setEditorOpen(true);
	};

	const openEdit = (row: DesktopAiChatPromptTemplateRow) => {
		setEditing(row);
		setTemplateKey(row.template_key);
		setDisplayName(row.display_name);
		setSystemPrompt(row.system_prompt);
		setIsActive(row.is_active);
		setEditorOpen(true);
	};

	const closeEditor = () => {
		setEditorOpen(false);
		resetEditor();
		openButtonRef.current?.focus();
	};

	const saveTemplate = async () => {
		setBusy(true);
		setStatusKind(null);
		setStatusMessage(null);
		try {
			if (editing) {
				const saved = await patchDesktopAiChatPromptTemplate(editing.id, {
					display_name: displayName.trim(),
					system_prompt: systemPrompt,
					is_active: isActive,
				});
				setTemplates((rows) =>
					rows.map((r) => (r.id === saved.id ? saved : r))
				);
			} else {
				const saved = await createDesktopAiChatPromptTemplate({
					template_key: templateKey.trim(),
					display_name: displayName.trim(),
					system_prompt: systemPrompt,
					is_active: isActive,
				});
				setTemplates((rows) => [...rows, saved]);
			}
			setStatusKind('success');
			setStatusMessage(t('adminAiChat.templates.saved'));
			closeEditor();
		} catch (e) {
			setStatusKind('error');
			setStatusMessage(
				e instanceof Error ? e.message : t('adminAiChat.templates.saveError')
			);
		} finally {
			setBusy(false);
		}
	};

	const confirmDelete = async () => {
		if (!deleteTarget) return;
		setBusy(true);
		try {
			await deleteDesktopAiChatPromptTemplate(deleteTarget.id);
			setTemplates((rows) => rows.filter((r) => r.id !== deleteTarget.id));
			setStatusKind('success');
			setStatusMessage(t('adminAiChat.templates.deleted'));
		} catch (e) {
			setStatusKind('error');
			setStatusMessage(
				e instanceof Error ? e.message : t('adminAiChat.templates.deleteError')
			);
		} finally {
			setBusy(false);
			setDeleteTarget(null);
		}
	};

	return (
		<div className="space-y-4">
			<DesktopAiChatAdminStatusBanner
				kind={statusKind}
				message={statusMessage}
			/>

			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className={`${DESKTOP_TYPOGRAPHY.body} text-white/70`}>
					{t('adminAiChat.templates.lead')}
				</p>
				<button
					ref={openButtonRef}
					type="button"
					onClick={openCreate}
					className="inline-flex items-center gap-1 rounded-lg bg-violet-600/90 px-3 py-1.5 text-sm text-white hover:bg-violet-600"
				>
					<PlusIcon className="h-4 w-4" aria-hidden />
					{t('adminAiChat.templates.create')}
				</button>
			</div>

			{templates.length === 0 ? (
				<p className={`${DESKTOP_TYPOGRAPHY.caption} text-white/50`}>
					{t('adminAiChat.templates.empty')}
				</p>
			) : (
				<div className="overflow-x-auto rounded-lg border border-white/10">
					<table className="min-w-full text-left text-sm">
						<thead className="bg-white/4 text-white/60">
							<tr>
								<th className="px-3 py-2 font-medium">
									{t('adminAiChat.templates.colKey')}
								</th>
								<th className="px-3 py-2 font-medium">
									{t('adminAiChat.templates.colName')}
								</th>
								<th className="px-3 py-2 font-medium">
									{t('adminAiChat.templates.colActive')}
								</th>
								<th className="px-3 py-2 font-medium">
									{t('adminAiChat.templates.colActions')}
								</th>
							</tr>
						</thead>
						<tbody>
							{templates.map((row) => (
								<tr key={row.id} className="border-t border-white/5">
									<td className="px-3 py-2 font-mono text-xs text-white/80">
										{row.template_key}
									</td>
									<td className="px-3 py-2 text-white/90">
										{row.display_name}
									</td>
									<td className="px-3 py-2">
										<span
											className={`rounded-full px-2 py-0.5 text-xs ${
												row.is_active
													? 'bg-emerald-500/15 text-emerald-200'
													: 'bg-white/10 text-white/50'
											}`}
										>
											{row.is_active
												? t('adminAiChat.templates.activeYes')
												: t('adminAiChat.templates.activeNo')}
										</span>
									</td>
									<td className="px-3 py-2">
										<div className="flex flex-wrap gap-2">
											<button
												type="button"
												className="text-violet-300 hover:underline"
												onClick={() => openEdit(row)}
											>
												{t('adminAiChat.templates.edit')}
											</button>
											<button
												type="button"
												className="inline-flex items-center gap-1 text-rose-300 hover:underline"
												onClick={() => setDeleteTarget(row)}
											>
												<TrashIcon className="h-3.5 w-3.5" aria-hidden />
												{t('adminAiChat.templates.delete')}
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{editorOpen ? (
				<div className="fixed inset-0 z-1200 flex items-center justify-center p-4">
					<button
						type="button"
						className="absolute inset-0 bg-black/60"
						aria-label={t('adminAiChat.templates.closeEditor')}
						onClick={closeEditor}
					/>
					<div
						ref={dialogRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby="dac-template-editor-title"
						tabIndex={-1}
						className="relative z-10 w-full max-w-lg rounded-2xl border border-white/15 bg-[#0a0520] p-5 shadow-2xl outline-none"
					>
						<h3
							id="dac-template-editor-title"
							className={`${DESKTOP_TYPOGRAPHY.subtitle} text-white/95`}
						>
							{editing
								? t('adminAiChat.templates.editTitle')
								: t('adminAiChat.templates.createTitle')}
						</h3>
						<div className="mt-4 space-y-3">
							{!editing ? (
								<div>
									<label
										htmlFor="dac-tpl-key"
										className={`block ${DESKTOP_TYPOGRAPHY.caption} mb-1`}
									>
										{t('adminAiChat.templates.colKey')}
									</label>
									<input
										id="dac-tpl-key"
										value={templateKey}
										onChange={(e) => setTemplateKey(e.target.value)}
										disabled={busy}
										className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90"
									/>
								</div>
							) : null}
							<div>
								<label
									htmlFor="dac-tpl-name"
									className={`block ${DESKTOP_TYPOGRAPHY.caption} mb-1`}
								>
									{t('adminAiChat.templates.colName')}
								</label>
								<input
									id="dac-tpl-name"
									value={displayName}
									onChange={(e) => setDisplayName(e.target.value)}
									disabled={busy}
									className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90"
								/>
							</div>
							<div>
								<label
									htmlFor="dac-tpl-prompt"
									className={`block ${DESKTOP_TYPOGRAPHY.caption} mb-1`}
								>
									{t('adminAiChat.templates.systemPrompt')}
								</label>
								<textarea
									id="dac-tpl-prompt"
									value={systemPrompt}
									onChange={(e) => setSystemPrompt(e.target.value)}
									disabled={busy}
									rows={6}
									className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white/90"
								/>
							</div>
							<label className="flex items-center gap-2 text-sm text-white/85">
								<input
									type="checkbox"
									checked={isActive}
									disabled={busy}
									onChange={(e) => setIsActive(e.target.checked)}
								/>
								{t('adminAiChat.templates.colActive')}
							</label>
						</div>
						<div className="mt-4 flex justify-end gap-2">
							<button
								type="button"
								onClick={closeEditor}
								disabled={busy}
								className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/85"
							>
								{t('adminAiChat.templates.cancel')}
							</button>
							<button
								type="button"
								disabled={busy}
								onClick={() => void saveTemplate()}
								className="rounded-lg bg-violet-600/90 px-3 py-1.5 text-sm text-white disabled:opacity-50"
							>
								{busy
									? t('adminAiChat.saving')
									: t('adminAiChat.templates.save')}
							</button>
						</div>
					</div>
				</div>
			) : null}

			<ConfirmDeleteModal
				isOpen={deleteTarget != null}
				onClose={() => setDeleteTarget(null)}
				onConfirm={confirmDelete}
				title={t('adminAiChat.templates.deleteConfirmTitle')}
				warningMessage={t('adminAiChat.templates.deleteConfirmBody', {
					name: deleteTarget?.display_name ?? '',
				})}
				confirmButtonLabel={t('adminAiChat.templates.delete')}
			/>

			<button
				type="button"
				className={`${DESKTOP_TYPOGRAPHY.caption} text-violet-300 hover:underline`}
				onClick={() => void refresh()}
			>
				{t('adminAiChat.templates.refreshList')}
			</button>
		</div>
	);
}
