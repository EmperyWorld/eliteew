import {
	ArrowPathIcon,
	ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { CustomerDiagnosticLeadReport } from '@/features/customer-diagnostic/CustomerDiagnosticLeadReport';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import { CustomerFacingSummaryRead } from '@/pages/CustomerCabinet/CustomerFacingSummaryRead';

import { EmptyProjectState } from '../../components/EmptyProjectState';
import { useMarketingShellClasses } from '../../hooks/useMarketingShellClasses';
import { CustomerFacingSummaryEditor } from '../CustomerFacingSummaryEditor';
import { ClientInteractionDiagnosticPanel } from '../ClientInteractionDiagnosticPanel';
import { ClientInteractionChatPanel } from './ClientInteractionChatPanel';
import { ClientInteractionDocsPanel } from './ClientInteractionDocsPanel';
import { ClientInteractionPresentationsPanel } from './ClientInteractionPresentationsPanel';
import type { ClientInteractionViewProps } from './clientInteractionTypes';
import { requireProjectId } from './clientInteractionShared';
import { useClientInteractionController } from './useClientInteractionController';

export type {
	ClientInteractionLayout,
	ClientInteractionViewProps,
} from './clientInteractionTypes';

export function ClientInteractionView({
	selectedProjectId,
	readOnlyMarketing = false,
	variant = 'default',
	layout = 'full',
}: ClientInteractionViewProps) {
	const { t } = useTranslation('marketing');
	const {
		contentPanel: mcPanel,
		formSelect: mcForm,
		checkboxControl,
	} = useMarketingShellClasses();
	const embedded = variant === 'embedded';
	const ixPadding = embedded ? 'p-3' : 'p-4';

	const ctrl = useClientInteractionController({
		selectedProjectId,
		readOnlyMarketing,
		variant,
		layout,
	});

	const {
		layoutMode,
		marketingTab,
		setMarketingTab,
		showMarketingTabBar,
		visibleClientInteractionTabs,
		showChat,
		showDocs,
		showPres,
		chatDocsGridUsesTwoColumns,
		ctxQuery,
		ctx,
		bridgeQuery,
		chatId,
		messagesQuery,
		contentQuery,
		ewrpQuery,
		sharesQuery,
		customerDiagSettingsQuery,
		customerDiagPatch,
		meForChat,
		sendDocsMutation,
		approveMutation,
		requestRemovalMutation,
		confirmRemovalMutation,
		cancelRemovalMutation,
		sharePresMutation,
		revokePresMutation,
		isLead,
		partner,
		selfUid,
		pendingDocs,
		approvedDocs,
		sortedMessages,
		draft,
		setDraft,
		selectedContentIds,
		toggleContent,
		presObjectUrl,
		openingApprovalId,
		docPreview,
		clearDocPreview,
		messagesEndRef,
		openPresentationPreview,
		downloadPresPdf,
		openBlobInNewTab,
		openApprovalDocument,
		onSubmitChat,
		presViewerMinH,
	} = ctrl;

	const pendingDocsCount = pendingDocs.length;
	const presentationsCount = (sharesQuery.data ?? []).length;

	const chatPanel = showChat ? (
		<ClientInteractionChatPanel
			embedded={embedded}
			mcPanel={mcPanel}
			ixPadding={ixPadding}
			mcForm={mcForm}
			ctx={ctx}
			partner={partner}
			bridgeQueryError={bridgeQuery.isError}
			sortedMessages={sortedMessages}
			selfUid={selfUid}
			messagesLoading={messagesQuery.isLoading}
			messagesEndRef={messagesEndRef}
			draft={draft}
			setDraft={setDraft}
			chatId={chatId}
			chatSendPending={meForChat.isPending}
			onSubmitChat={onSubmitChat}
		/>
	) : null;

	const docsPanel = showDocs ? (
		<ClientInteractionDocsPanel
			embedded={embedded}
			mcPanel={mcPanel}
			ixPadding={ixPadding}
			checkboxControl={checkboxControl}
			ctx={ctx}
			isLead={isLead}
			contentItems={contentQuery.data?.items}
			selectedContentIds={selectedContentIds}
			toggleContent={toggleContent}
			sendDocsPending={sendDocsMutation.isPending}
			onSendForApproval={() => sendDocsMutation.mutate()}
			pendingDocs={pendingDocs}
			approvedDocs={approvedDocs}
			openingApprovalId={openingApprovalId}
			onOpenApprovalDocument={openApprovalDocument}
			approvePending={approveMutation.isPending}
			onApprove={(id) => approveMutation.mutate(id)}
			confirmRemovalPending={confirmRemovalMutation.isPending}
			onConfirmRemoval={(id) => confirmRemovalMutation.mutate(id)}
			cancelRemovalPending={cancelRemovalMutation.isPending}
			onCancelRemoval={(id) => cancelRemovalMutation.mutate(id)}
			requestRemovalPending={requestRemovalMutation.isPending}
			onRequestRemoval={(id) => requestRemovalMutation.mutate(id)}
			docPreview={docPreview}
			onClearDocPreview={clearDocPreview}
			onOpenBlobInNewTab={openBlobInNewTab}
		/>
	) : null;

	const presPanel = showPres ? (
		<ClientInteractionPresentationsPanel
			embedded={embedded}
			mcPanel={mcPanel}
			ixPadding={ixPadding}
			readOnlyMarketing={readOnlyMarketing}
			isLead={isLead}
			ewrpJobs={ewrpQuery.data}
			ewrpLoaded={ewrpQuery.isSuccess}
			sharePresPending={sharePresMutation.isPending}
			onShareJob={(jobId) => sharePresMutation.mutate(jobId)}
			shares={sharesQuery.data}
			revokePresPending={revokePresMutation.isPending}
			onRevokeShare={(shareId) => revokePresMutation.mutate(shareId)}
			onOpenPresentationPreview={openPresentationPreview}
			onDownloadPresPdf={downloadPresPdf}
			presObjectUrl={presObjectUrl}
			presViewerMinH={presViewerMinH}
		/>
	) : null;

	if (!selectedProjectId) {
		return (
			<EmptyProjectState
				title={t('clientInteractionView.needProject')}
				description=""
			/>
		);
	}

	if (ctxQuery.isLoading) {
		return (
			<div
				className={cn(
					'flex items-center justify-center gap-2 text-sm text-(--desktop-text-secondary)',
					embedded ? 'min-h-[140px]' : 'min-h-[40vh]'
				)}
			>
				<ArrowPathIcon
					className="h-5 w-5 motion-safe:animate-spin motion-reduce:animate-none"
					strokeWidth={DESKTOP_LUCIDE.stroke}
				/>
				{t('clientInteractionView.loading')}
			</div>
		);
	}

	if (ctxQuery.isError) {
		return (
			<div
				className={cn(
					'flex flex-col items-start gap-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 p-4',
					embedded ? 'min-h-[140px]' : 'min-h-[200px]'
				)}
			>
				<p className="text-sm text-(--desktop-text-dim)">
					{t('clientInteractionView.contextLoadError')}
				</p>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					disabled={ctxQuery.isFetching}
					onClick={() => {
						void ctxQuery.refetch();
					}}
				>
					{ctxQuery.isFetching ? (
						<>
							<ArrowPathIcon
								className="mr-1.5 h-3.5 w-3.5 animate-spin"
								aria-hidden
							/>
							{t('clientInteractionView.contextRetrying')}
						</>
					) : (
						t('clientInteractionView.contextRetry')
					)}
				</DesktopAppButton>
			</div>
		);
	}

	if (ctx && !ctx.has_representative && layoutMode === 'chat-only') {
		return (
			<DesktopAppEmptyState
				icon={
					<ChatBubbleLeftRightIcon
						className="h-10 w-10 opacity-50"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				}
				title={t('clientInteractionView.noRepresentative')}
			/>
		);
	}

	const legacyChatDocsGrid = (
		<div
			className={cn(
				'grid min-h-0 gap-4 grid-cols-1',
				chatDocsGridUsesTwoColumns && 'lg:grid-cols-2'
			)}
		>
			{chatPanel}
			{docsPanel}
		</div>
	);

	const renderMarketingTabPanel = (): ReactNode => {
		if (!showMarketingTabBar) return null;
		switch (marketingTab) {
			case 'summary':
				if (!selectedProjectId) return null;
				if (isLead && !readOnlyMarketing) {
					return <CustomerFacingSummaryEditor projectId={selectedProjectId} />;
				}
				return <CustomerFacingSummaryRead projectId={selectedProjectId} />;
			case 'diagnostic':
				return isLead && !readOnlyMarketing && selectedProjectId ? (
					<div className="flex min-h-0 flex-col gap-4">
						<div
							className={cn(
								mcPanel,
								'flex flex-col gap-2 rounded-lg border border-(--desktop-border-subtle) p-3'
							)}
						>
							<DesktopAppSectionLabel className="mb-0">
								{t('clientInteractionView.diagnosticSections.access')}
							</DesktopAppSectionLabel>
							<p className="text-xs text-(--desktop-text-secondary)">
								{t('clientInteractionView.customerDiagnostic.hint')}
							</p>
							<label className="flex cursor-pointer items-start gap-2.5 text-sm">
								<input
									type="checkbox"
									className={checkboxControl}
									checked={Boolean(customerDiagSettingsQuery.data?.enabled)}
									disabled={
										customerDiagSettingsQuery.isLoading ||
										customerDiagPatch.isPending
									}
									aria-label={t(
										'clientInteractionView.customerDiagnostic.aria'
									)}
									onChange={(e) => {
										customerDiagPatch.mutate(e.target.checked);
									}}
								/>
								<span className="min-w-0 flex-1 leading-snug text-(--desktop-text-primary)">
									{t('clientInteractionView.customerDiagnostic.toggleLabel')}
								</span>
							</label>
							{customerDiagPatch.isError ? (
								<p className="text-xs text-red-300">
									{t('clientInteractionView.customerDiagnostic.saveError')}
								</p>
							) : null}
							{!customerDiagSettingsQuery.data?.enabled ? (
								<p className="text-xs text-(--desktop-text-secondary)">
									{t('clientInteractionView.diagnosticDisabledHint')}
								</p>
							) : null}
						</div>
						{customerDiagSettingsQuery.data?.enabled ? (
							<>
								<div
									className={cn(
										mcPanel,
										'flex min-h-0 flex-col gap-3 rounded-lg border border-(--desktop-border-subtle) p-3'
									)}
								>
									<DesktopAppSectionLabel className="mb-0">
										{t('clientInteractionView.diagnosticSections.progress')}
									</DesktopAppSectionLabel>
									<CustomerDiagnosticLeadReport
										projectId={requireProjectId(selectedProjectId)}
										omitSectionTitle
									/>
								</div>
								<div
									className={cn(
										mcPanel,
										'flex min-h-0 flex-col gap-3 rounded-lg border border-(--desktop-border-subtle) p-4'
									)}
								>
									<DesktopAppSectionLabel className="mb-0">
										{t('clientInteractionView.diagnosticSections.admin')}
									</DesktopAppSectionLabel>
									<ClientInteractionDiagnosticPanel
										projectId={requireProjectId(selectedProjectId)}
										hideTitle
									/>
								</div>
							</>
						) : null}
					</div>
				) : null;
			case 'documents':
				return docsPanel;
			case 'presentations':
				return presPanel;
			case 'chat':
				return chatPanel;
			default:
				return null;
		}
	};

	return (
		<div
			className={cn(
				'flex min-h-0 flex-col gap-4',
				embedded ? 'flex-1 pb-0' : 'pb-6'
			)}
		>
			{showMarketingTabBar ? (
				<>
					<div
						className={cn(
							DESKTOP_APP_STYLE_CONTRACT.softCard,
							'flex flex-wrap gap-1 p-1'
						)}
						role="tablist"
						aria-label={t('clientInteractionView.tablistAria')}
					>
						{visibleClientInteractionTabs.map((id) => {
							const isActive = marketingTab === id;
							let badge: ReactNode = null;
							let tabTitle: string | undefined;
							if (id === 'documents' && pendingDocsCount > 0) {
								tabTitle = t('clientInteractionView.tabHintPendingDocs', {
									count: pendingDocsCount,
								});
								badge = (
									<span
										className="inline-flex min-w-4.5 items-center justify-center rounded-md border border-amber-500/25 bg-amber-950/35 px-1.5 text-[10px] font-semibold tabular-nums text-amber-200/95"
										title={tabTitle}
									>
										{pendingDocsCount > 99 ? '99+' : pendingDocsCount}
									</span>
								);
							} else if (id === 'presentations' && presentationsCount > 0) {
								tabTitle = t('clientInteractionView.tabHintPresentations', {
									count: presentationsCount,
								});
								badge = (
									<span
										className="inline-flex min-w-4.5 items-center justify-center rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-1.5 text-[10px] font-medium tabular-nums text-(--desktop-text-secondary)"
										title={tabTitle}
									>
										{presentationsCount > 99 ? '99+' : presentationsCount}
									</span>
								);
							}
							const label = t(`clientInteractionView.tabs.${id}`);
							return (
								<DesktopAppButton
									key={id}
									type="button"
									size="sm"
									variant={isActive ? 'accent' : 'neutral'}
									className="shrink-0 gap-1.5"
									role="tab"
									aria-selected={isActive}
									id={`mc-client-ix-tab-${id}-${selectedProjectId}`}
									aria-controls={`mc-client-ix-panel-${id}-${selectedProjectId}`}
									title={tabTitle}
									aria-label={tabTitle ? `${label}. ${tabTitle}` : label}
									onClick={() => setMarketingTab(id)}
								>
									<span>{label}</span>
									{badge}
								</DesktopAppButton>
							);
						})}
					</div>
					<DesktopAppSurface
						variant="soft"
						className="flex min-h-[min(52dvh,28rem)] flex-1 flex-col overflow-y-auto p-3 sm:p-4"
						role="tabpanel"
						id={`mc-client-ix-panel-${marketingTab}-${selectedProjectId}`}
						aria-labelledby={`mc-client-ix-tab-${marketingTab}-${selectedProjectId}`}
					>
						{renderMarketingTabPanel()}
					</DesktopAppSurface>
				</>
			) : (
				<>
					{showChat || showDocs ? legacyChatDocsGrid : null}
					{showPres ? presPanel : null}
				</>
			)}
		</div>
	);
}
