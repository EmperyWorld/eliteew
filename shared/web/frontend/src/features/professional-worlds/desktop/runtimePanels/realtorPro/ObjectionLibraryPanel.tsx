/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor Pro objection library — coach active deals, upsert typed reply templates, and bridge to pipeline/communications.
 *
 * Invariants:
 * - Replies load via REST list and upsert via typed PUT (`upsertRealtorObjectionReply`) with client-side body validation.
 * - Active deals section links to pipeline and optional communications when `realtor_communications` addon is enabled.
 *
 * Related:
 * - ../RealtorProPanels.tsx (barrel re-export target)
 * - ../../runtimeModuleRegistry.tsx
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsStatusBanner,
	ProfessionalWorldsTextarea,
	ProfessionalWorldsWorkspacePanel,
} from '../../layout';

import {
	listRealtorObjectionReplies,
	upsertRealtorObjectionReply,
} from '../../api';
import { formatProfessionalWorldsApiError } from '../../professionalWorldsApiError';
import { useProfessionalToasts } from '../../ProfessionalToast';
import { useProfessionalWorldsWorkspace } from '../../ProfessionalWorldsWorkspaceContext';
import type { RuntimeModulePanelProps } from '../../runtimeModuleRegistry';
import { listActiveDealsForObjectionCoach } from '../../realtorLogic';
import type { RealtorObjectionReply } from '../../types';

import {
	type AsyncState,
	PanelStatus,
	formatDealStageLabel,
	formatObjectionKeyLabel,
	formatObjectionTagLabel,
} from './shared';

export function ObjectionLibraryPanel({ snapshot }: RuntimeModulePanelProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const { notifyApiError, notifySuccess } = useProfessionalToasts();
	const { openCommunications, openPipeline, verticalAddonModules } =
		useProfessionalWorldsWorkspace();
	const communicationsModuleEnabled = verticalAddonModules.some(
		(mod) => mod.module_key === 'realtor_communications'
	);
	const activeDeals = useMemo(
		() => listActiveDealsForObjectionCoach(snapshot.deals),
		[snapshot.deals]
	);
	const [{ data: replies, error, loading }, setRepliesState] = useState<
		AsyncState<RealtorObjectionReply[]>
	>({
		data: [],
		error: null,
		loading: true,
	});
	const [draftObjectionKey, setDraftObjectionKey] = useState('');
	const [draftReplyText, setDraftReplyText] = useState('');
	const [draftTags, setDraftTags] = useState('');
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [formSuccess, setFormSuccess] = useState<string | null>(null);

	useEffect(() => {
		let alive = true;
		listRealtorObjectionReplies()
			.then((data) => {
				if (alive) setRepliesState({ data, error: null, loading: false });
			})
			.catch((err: unknown) => {
				if (alive) {
					setRepliesState({
						data: [],
						error: formatProfessionalWorldsApiError(err, (key) => t(key)),
						loading: false,
					});
				}
			});
		return () => {
			alive = false;
		};
	}, [t]);

	function beginEditReply(reply: RealtorObjectionReply) {
		setDraftObjectionKey(reply.objection_key);
		setDraftReplyText(reply.reply_text);
		setDraftTags(
			Array.isArray(reply.tags) ? reply.tags.map(String).join(', ') : ''
		);
		setFormError(null);
		setFormSuccess(null);
	}

	async function handleSaveReply() {
		const objectionKey = draftObjectionKey.trim();
		const replyText = draftReplyText.trim();
		if (!objectionKey || !replyText) {
			setFormError(t('realtorPro.objections.saveValidation'));
			setFormSuccess(null);
			return;
		}
		setSaving(true);
		setFormError(null);
		setFormSuccess(null);
		try {
			const tags = draftTags
				.split(',')
				.map((tag) => tag.trim())
				.filter(Boolean);
			const row = await upsertRealtorObjectionReply(objectionKey, {
				reply_text: replyText,
				...(tags.length > 0 ? { tags } : {}),
			});
			setRepliesState((current) => ({
				...current,
				data: [
					row,
					...current.data.filter(
						(item) => item.objection_key !== row.objection_key
					),
				],
			}));
			setFormSuccess(t('realtorPro.objections.saveSuccess'));
			notifySuccess(t('realtorPro.objections.saveSuccess'));
		} catch (caught: unknown) {
			setFormError(formatProfessionalWorldsApiError(caught, (key) => t(key)));
			notifyApiError(caught, t, t('realtorPro.objections.saveFailed'));
		} finally {
			setSaving(false);
		}
	}

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('realtorPro.objections.title')}
			actions={<PanelStatus error={error} loading={loading} />}
		>
			{activeDeals.length > 0 ? (
				<div className="mb-4 grid gap-2 rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) p-3">
					<strong className="text-sm">
						{t('realtorPro.objections.activeDealsTitle')}
					</strong>
					<p className="text-xs text-(--desktop-text-muted)">
						{t('realtorPro.objections.activeDealsHint')}
					</p>
					<div className="grid gap-2">
						{activeDeals.map((deal) => (
							<article
								key={deal.id}
								className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm"
							>
								<strong>{deal.title}</strong>
								<p className="mt-1 text-xs text-(--desktop-text-secondary)">
									{formatDealStageLabel(t, deal.stage)}
									{deal.next_action ? ` · ${deal.next_action}` : ''}
								</p>
								<div className="mt-2 flex flex-wrap gap-2">
									<DesktopAppButton
										size="sm"
										variant="ghost"
										onClick={() => openPipeline({ dealId: deal.id })}
									>
										{t('realtorPro.documents.openDealInPipeline')}
									</DesktopAppButton>
									{communicationsModuleEnabled ? (
										<DesktopAppButton
											size="sm"
											variant="ghost"
											onClick={() =>
												openCommunications({
													relatedType: 'deal',
													relatedId: deal.id,
												})
											}
										>
											{t('realtorPro.communications.logCta')}
										</DesktopAppButton>
									) : null}
								</div>
							</article>
						))}
					</div>
				</div>
			) : null}
			<div className="mb-4 grid gap-3 rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) p-3">
				<strong className="text-sm">
					{t('realtorPro.objections.saveTitle')}
				</strong>
				<p className="text-xs text-(--desktop-text-muted)">
					{t('realtorPro.objections.saveHint')}
				</p>
				<div className="grid gap-2 sm:grid-cols-2">
					<ProfessionalWorldsFormField
						label={t('realtorPro.objections.objectionKeyLabel')}
					>
						<DesktopAppInput
							value={draftObjectionKey}
							onChange={(event) => setDraftObjectionKey(event.target.value)}
							placeholder={t('realtorPro.objections.objectionKeyPlaceholder')}
							aria-label={t('realtorPro.objections.objectionKeyLabel')}
						/>
					</ProfessionalWorldsFormField>
					<ProfessionalWorldsFormField
						label={t('realtorPro.objections.tagsLabel')}
					>
						<DesktopAppInput
							value={draftTags}
							onChange={(event) => setDraftTags(event.target.value)}
							placeholder={t('realtorPro.objections.tagsPlaceholder')}
							aria-label={t('realtorPro.objections.tagsLabel')}
						/>
					</ProfessionalWorldsFormField>
				</div>
				<ProfessionalWorldsFormField
					label={t('realtorPro.objections.replyTextLabel')}
				>
					<ProfessionalWorldsTextarea
						value={draftReplyText}
						onChange={(event) => setDraftReplyText(event.target.value)}
						placeholder={t('realtorPro.objections.replyTextPlaceholder')}
						aria-label={t('realtorPro.objections.replyTextLabel')}
						rows={4}
					/>
				</ProfessionalWorldsFormField>
				{formError ? (
					<ProfessionalWorldsStatusBanner kind="error" role="alert">
						{formError}
					</ProfessionalWorldsStatusBanner>
				) : null}
				{formSuccess ? (
					<ProfessionalWorldsStatusBanner kind="success" role="status">
						{formSuccess}
					</ProfessionalWorldsStatusBanner>
				) : null}
				<div>
					<DesktopAppButton
						size="sm"
						onClick={() => void handleSaveReply()}
						disabled={saving}
					>
						{saving
							? t('realtorPro.objections.saveSaving')
							: t('realtorPro.objections.saveCta')}
					</DesktopAppButton>
				</div>
			</div>
			{!loading && replies.length === 0 ? (
				<DesktopAppEmptyState
					title={t('realtorPro.objections.emptyTitle')}
					description={t('realtorPro.objections.emptyDescription')}
				/>
			) : (
				replies.map((reply) => (
					<article
						key={reply.id}
						className="rounded-(--desktop-radius) bg-(--desktop-surface-soft) p-3 text-sm"
					>
						<div className="flex flex-wrap items-start justify-between gap-2">
							<strong>{formatObjectionKeyLabel(t, reply.objection_key)}</strong>
							<DesktopAppButton
								size="sm"
								variant="ghost"
								onClick={() => beginEditReply(reply)}
							>
								{t('realtorPro.objections.editCta')}
							</DesktopAppButton>
						</div>
						<p className="mt-1 text-xs text-(--desktop-text-secondary)">
							{reply.reply_text}
						</p>
						{Array.isArray(reply.tags) && reply.tags.length > 0 ? (
							<p className="mt-1 text-[11px] text-(--desktop-text-muted)">
								{t('realtorPro.objections.tagsPrefix')}{' '}
								{reply.tags
									.map((tag) => formatObjectionTagLabel(t, String(tag)))
									.join(', ')}
							</p>
						) : null}
					</article>
				))
			)}
		</ProfessionalWorldsWorkspacePanel>
	);
}
