import { ArrowPathIcon, EyeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import { MarketingCabinetCheckboxPickList } from '../../components/MarketingCabinetCheckboxPickList';
import type {
	ClientDocApproval,
	ClientInteractionContext,
} from '../../marketingCabinetApi';
import {
	INLINE_EMPTY_CAPTIONS_VTT,
	type DocInlinePreview,
} from './clientInteractionShared';

type ContentListItem = { id: string; name?: string | null };

export type ClientInteractionDocsPanelProps = {
	embedded: boolean;
	mcPanel: string;
	ixPadding: string;
	checkboxControl: string;
	ctx: ClientInteractionContext | undefined;
	isLead: boolean;
	contentItems: ContentListItem[] | undefined;
	selectedContentIds: Set<string>;
	toggleContent: (id: string) => void;
	sendDocsPending: boolean;
	onSendForApproval: () => void;
	pendingDocs: ClientDocApproval[];
	approvedDocs: ClientDocApproval[];
	openingApprovalId: string | null;
	onOpenApprovalDocument: (approvalId: string, title: string) => void;
	approvePending: boolean;
	onApprove: (id: string) => void;
	confirmRemovalPending: boolean;
	onConfirmRemoval: (removalId: string) => void;
	cancelRemovalPending: boolean;
	onCancelRemoval: (removalId: string) => void;
	requestRemovalPending: boolean;
	onRequestRemoval: (approvalId: string) => void;
	docPreview: DocInlinePreview | null;
	onClearDocPreview: () => void;
	onOpenBlobInNewTab: (url: string) => void;
};

export function ClientInteractionDocsPanel({
	embedded,
	mcPanel,
	ixPadding,
	checkboxControl,
	ctx,
	isLead,
	contentItems,
	selectedContentIds,
	toggleContent,
	sendDocsPending,
	onSendForApproval,
	pendingDocs,
	approvedDocs,
	openingApprovalId,
	onOpenApprovalDocument,
	approvePending,
	onApprove,
	confirmRemovalPending,
	onConfirmRemoval,
	cancelRemovalPending,
	onCancelRemoval,
	requestRemovalPending,
	onRequestRemoval,
	docPreview,
	onClearDocPreview,
	onOpenBlobInNewTab,
}: ClientInteractionDocsPanelProps) {
	const { t } = useTranslation('marketing');

	return (
		<div
			className={cn(
				mcPanel,
				'flex min-h-0 flex-col',
				ixPadding,
				embedded && 'flex-1'
			)}
		>
			{!embedded ? (
				<>
					<DesktopAppSectionLabel className="mb-1">
						{t('clientInteractionView.docsTitle')}
					</DesktopAppSectionLabel>
					<p className="mb-4 text-xs text-(--desktop-text-secondary)">
						{t('clientInteractionView.docsHint')}
					</p>
				</>
			) : (
				<p className={cn('mb-3', DESKTOP_TYPOGRAPHY.meta)}>
					{t('clientInteractionView.docsHint')}
				</p>
			)}

			{isLead && contentItems?.length ? (
				<div className="mb-4 space-y-2">
					<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'font-medium')}>
						{t('clientInteractionView.selectContent')}
					</div>
					<div className={cn(mcPanel, 'p-2')}>
						<MarketingCabinetCheckboxPickList
							items={contentItems}
							getLabel={(item) => item.name || item.id}
							selectedIds={selectedContentIds}
							checkboxClassName={checkboxControl}
							listHeight={144}
							labelClassName="flex cursor-pointer items-start gap-2 text-sm"
							onToggle={(id) => {
								toggleContent(id);
							}}
						/>
					</div>
					<DesktopAppButton
						type="button"
						size="sm"
						disabled={selectedContentIds.size === 0 || sendDocsPending}
						onClick={onSendForApproval}
					>
						{t('clientInteractionView.sendForApproval')}
					</DesktopAppButton>
				</div>
			) : null}

			<div className="space-y-4 text-sm">
				<div>
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'mb-2 font-semibold uppercase'
						)}
					>
						{t('clientInteractionView.pending')}
					</div>
					<ul className="space-y-2">
						{pendingDocs.map((d) => (
							<li key={d.id} className={cn(mcPanel, 'rounded-md p-2')}>
								<div className="font-medium">
									{d.content_title || d.content_name || d.content_id}
								</div>
								{d.pending_removal ? (
									<p className="mt-1 text-xs text-amber-600">
										{t('clientInteractionView.removalPending')}
									</p>
								) : null}
								<div className="mt-2 flex flex-wrap gap-2">
									{ctx?.is_customer_representative || isLead ? (
										<DesktopAppButton
											type="button"
											size="sm"
											variant="neutral"
											className="gap-1"
											disabled={openingApprovalId === d.id}
											onClick={() =>
												void onOpenApprovalDocument(
													d.id,
													d.content_title ||
														d.content_name ||
														d.content_id ||
														''
												)
											}
										>
											{openingApprovalId === d.id ? (
												<ArrowPathIcon
													className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
													strokeWidth={DESKTOP_LUCIDE.stroke}
													aria-hidden
												/>
											) : (
												<EyeIcon
													className="h-3.5 w-3.5 opacity-80"
													strokeWidth={DESKTOP_LUCIDE.stroke}
													aria-hidden
												/>
											)}
											{t('clientInteractionView.viewDocument')}
										</DesktopAppButton>
									) : null}
									{ctx?.is_customer_representative && !d.pending_removal ? (
										<DesktopAppButton
											type="button"
											size="sm"
											variant="accent"
											disabled={approvePending}
											onClick={() => onApprove(d.id)}
										>
											{t('clientInteractionView.approve')}
										</DesktopAppButton>
									) : null}
									{ctx?.is_customer_representative && d.pending_removal ? (
										<DesktopAppButton
											type="button"
											size="sm"
											variant="accent"
											disabled={confirmRemovalPending}
											onClick={() => {
												const pr = d.pending_removal;
												if (pr) onConfirmRemoval(pr.id);
											}}
										>
											{t('clientInteractionView.confirmRemoval')}
										</DesktopAppButton>
									) : null}
									{isLead && d.pending_removal ? (
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											disabled={cancelRemovalPending}
											onClick={() => {
												const pr = d.pending_removal;
												if (pr) onCancelRemoval(pr.id);
											}}
										>
											{t('clientInteractionView.cancelRemoval')}
										</DesktopAppButton>
									) : null}
									{isLead && !d.pending_removal ? (
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											disabled={requestRemovalPending}
											onClick={() => onRequestRemoval(d.id)}
										>
											{t('clientInteractionView.requestRemoval')}
										</DesktopAppButton>
									) : null}
								</div>
							</li>
						))}
						{pendingDocs.length === 0 ? (
							<li className={DESKTOP_TYPOGRAPHY.meta}>—</li>
						) : null}
					</ul>
				</div>
				<div>
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'mb-2 font-semibold uppercase'
						)}
					>
						{t('clientInteractionView.approved')}
					</div>
					<ul className="space-y-2">
						{approvedDocs.map((d) => (
							<li key={d.id} className={cn(mcPanel, 'rounded-md p-2')}>
								<div className="font-medium">
									{d.content_title || d.content_name || d.content_id}
								</div>
								{d.pending_removal ? (
									<p className="mt-1 text-xs text-amber-600">
										{t('clientInteractionView.removalPending')}
									</p>
								) : null}
								<div className="mt-2 flex flex-wrap gap-2">
									{ctx?.is_customer_representative || isLead ? (
										<DesktopAppButton
											type="button"
											size="sm"
											variant="neutral"
											className="gap-1"
											disabled={openingApprovalId === d.id}
											onClick={() =>
												void onOpenApprovalDocument(
													d.id,
													d.content_title ||
														d.content_name ||
														d.content_id ||
														''
												)
											}
										>
											{openingApprovalId === d.id ? (
												<ArrowPathIcon
													className="h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none"
													strokeWidth={DESKTOP_LUCIDE.stroke}
													aria-hidden
												/>
											) : (
												<EyeIcon
													className="h-3.5 w-3.5 opacity-80"
													strokeWidth={DESKTOP_LUCIDE.stroke}
													aria-hidden
												/>
											)}
											{t('clientInteractionView.viewDocument')}
										</DesktopAppButton>
									) : null}
									{ctx?.is_customer_representative && d.pending_removal ? (
										<DesktopAppButton
											type="button"
											size="sm"
											variant="accent"
											disabled={confirmRemovalPending}
											onClick={() => {
												const pr = d.pending_removal;
												if (pr) onConfirmRemoval(pr.id);
											}}
										>
											{t('clientInteractionView.confirmRemoval')}
										</DesktopAppButton>
									) : null}
									{isLead && d.pending_removal ? (
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											disabled={cancelRemovalPending}
											onClick={() => {
												const pr = d.pending_removal;
												if (pr) onCancelRemoval(pr.id);
											}}
										>
											{t('clientInteractionView.cancelRemoval')}
										</DesktopAppButton>
									) : null}
									{isLead && !d.pending_removal ? (
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											disabled={requestRemovalPending}
											onClick={() => onRequestRemoval(d.id)}
										>
											{t('clientInteractionView.requestRemoval')}
										</DesktopAppButton>
									) : null}
								</div>
							</li>
						))}
						{approvedDocs.length === 0 ? (
							<li className={DESKTOP_TYPOGRAPHY.meta}>—</li>
						) : null}
					</ul>
				</div>

				{docPreview ? (
					<div className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-base)">
						<div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--desktop-border-subtle) px-3 py-2">
							<span className="min-w-0 truncate text-xs font-medium text-(--desktop-text-primary)">
								{docPreview.title}
							</span>
							<div className="flex shrink-0 items-center gap-1">
								{docPreview.type === 'media' ? (
									<DesktopAppButton
										type="button"
										size="sm"
										variant="ghost"
										onClick={() => onOpenBlobInNewTab(docPreview.url)}
									>
										{t('clientInteractionView.openInNewTab')}
									</DesktopAppButton>
								) : null}
								<DesktopAppButton
									type="button"
									size="sm"
									variant="ghost"
									className="gap-1"
									onClick={onClearDocPreview}
								>
									<XMarkIcon
										className="h-3.5 w-3.5"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									{t('clientInteractionView.closeDocPreview')}
								</DesktopAppButton>
							</div>
						</div>
						<div className="max-h-[min(70dvh,720px)] min-h-[min(40dvh,360px)] overflow-auto p-2">
							{docPreview.type === 'text' ? (
								<pre className="wrap-break-word whitespace-pre-wrap font-mono text-xs text-(--desktop-text-secondary)">
									{docPreview.text}
								</pre>
							) : docPreview.mime.startsWith('image/') ? (
								<div className="flex justify-center">
									<img
										src={docPreview.url}
										alt={docPreview.title}
										className="max-h-[min(65dvh,640px)] max-w-full object-contain"
									/>
								</div>
							) : docPreview.mime.startsWith('video/') ? (
								<video
									src={docPreview.url}
									controls
									className="mx-auto max-h-[min(65dvh,640px)] max-w-full"
								>
									<track
										kind="captions"
										srcLang="und"
										label={docPreview.title}
										src={INLINE_EMPTY_CAPTIONS_VTT}
									/>
								</video>
							) : docPreview.mime.startsWith('audio/') ? (
								<audio
									src={docPreview.url}
									controls
									className="w-full"
									aria-label={docPreview.title}
								>
									<track
										kind="captions"
										srcLang="und"
										label={docPreview.title}
										src={INLINE_EMPTY_CAPTIONS_VTT}
									/>
								</audio>
							) : (
								<div
									data-desktop-iframe-host=""
									className="h-[min(62dvh,600px)] min-h-[320px] w-full"
								>
									<iframe
										title={docPreview.title}
										src={docPreview.url}
										className="h-full min-h-[320px] w-full rounded border-0 bg-(--desktop-surface-soft)"
									/>
								</div>
							)}
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
