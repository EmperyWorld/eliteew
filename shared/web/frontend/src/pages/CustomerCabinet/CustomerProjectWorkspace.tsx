import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CustomerDiagnosticRunner } from '@/features/customer-diagnostic/CustomerDiagnosticRunner';
import { canShowCustomerDiagnosticTab } from '@/features/customer-diagnostic/diagnosticProgress';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { marketingCabinetCustomerDiagnosticSettingsQueryOptions } from '@/pages/MarketingCabinet/marketingCabinetClientInteractionQueryOptions';
import { ClientInteractionView } from '@/pages/MarketingCabinet/views/ClientInteractionView';
import { cn } from '@/utils/cn';

import { customerCabinetCustomerSummaryQueryOptions } from './customerCabinetQueryOptions';

import { customerFacingSummaryResponseHasBody } from './customerFacingSummaryDisplay';
import { CustomerFacingSummaryRead } from './CustomerFacingSummaryRead';
import {
	type CustomerProjectTab,
	getRememberedCustomerTab,
	hasStoredTabPreference,
	rememberCustomerTab,
} from './customerProjectTabMemory';

export type { CustomerProjectTab } from './customerProjectTabMemory';

export interface CustomerWorkspaceSignals {
	pendingDocs: number;
	presentations: number;
}

export interface CustomerProjectWorkspaceProps {
	projectId: string;
	className?: string;
	/** Сигналы со списка проектов (без лишних запросов). */
	signals?: CustomerWorkspaceSignals | null;
}

const BASE_TABS: CustomerProjectTab[] = [
	'summary',
	'documents',
	'presentations',
	'chat',
];

export function CustomerProjectWorkspace({
	projectId,
	className,
	signals,
}: CustomerProjectWorkspaceProps) {
	const { t } = useTranslation('customerCabinet');
	const diagnosticSettingsQuery = useQuery({
		...marketingCabinetCustomerDiagnosticSettingsQueryOptions(projectId),
		staleTime: 30_000,
	});
	const diagnosticEnabled = canShowCustomerDiagnosticTab(
		diagnosticSettingsQuery.data?.enabled
	);

	const customerSummaryQuery = useQuery({
		...customerCabinetCustomerSummaryQueryOptions(projectId),
		enabled: Boolean(projectId),
	});
	const summaryTabHasContent = customerFacingSummaryResponseHasBody(
		customerSummaryQuery.data ?? null
	);

	const tabs = useMemo((): CustomerProjectTab[] => {
		if (!diagnosticEnabled) return [...BASE_TABS];
		return ['summary', 'diagnostic', 'documents', 'presentations', 'chat'];
	}, [diagnosticEnabled]);

	const [tab, setTab] = useState<CustomerProjectTab>(() =>
		getRememberedCustomerTab(projectId)
	);

	useEffect(() => {
		setTab(getRememberedCustomerTab(projectId));
	}, [projectId]);

	useEffect(() => {
		if (tab === 'diagnostic' && !diagnosticEnabled) {
			setTab('summary');
		}
	}, [tab, diagnosticEnabled]);

	/** Без сохранённой вкладки открываем «Документы», если есть ожидающие согласования. */
	useEffect(() => {
		if (!signals) return;
		if (hasStoredTabPreference(projectId)) return;
		if (signals.pendingDocs > 0) setTab('documents');
	}, [projectId, signals]);

	const selectTab = (id: CustomerProjectTab): void => {
		rememberCustomerTab(projectId, id);
		setTab(id);
	};

	const pendingDocs = signals?.pendingDocs ?? 0;
	const presCount = signals?.presentations ?? 0;

	return (
		<div className={cn('flex min-h-0 flex-col gap-3', className)}>
			<div
				className={cn(
					DESKTOP_APP_STYLE_CONTRACT.softCard,
					'flex flex-wrap gap-1 p-1'
				)}
				role="tablist"
				aria-label={t('workspace.tablistAria')}
			>
				{tabs.map((id) => {
					const isActive = tab === id;
					let badge: ReactNode = null;
					let tabTitle: string | undefined;
					if (
						id === 'summary' &&
						summaryTabHasContent &&
						!customerSummaryQuery.isError
					) {
						tabTitle = t('workspace.tabs.summaryHasContentHint');
						badge = (
							<span
								className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-400/90 shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
								title={tabTitle}
								aria-hidden
							/>
						);
					}
					if (id === 'documents' && pendingDocs > 0) {
						tabTitle = t('workspace.tabHintPendingDocs', {
							count: pendingDocs,
						});
						badge = (
							<span
								className="inline-flex min-w-4.5 items-center justify-center rounded-md border border-amber-500/25 bg-amber-950/35 px-1.5 text-[10px] font-semibold tabular-nums text-amber-200/95"
								title={tabTitle}
							>
								{pendingDocs > 99 ? '99+' : pendingDocs}
							</span>
						);
					} else if (id === 'presentations' && presCount > 0) {
						tabTitle = t('workspace.tabHintPresentations', {
							count: presCount,
						});
						badge = (
							<span
								className="inline-flex min-w-4.5 items-center justify-center rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-1.5 text-[10px] font-medium tabular-nums text-(--desktop-text-secondary)"
								title={tabTitle}
							>
								{presCount > 99 ? '99+' : presCount}
							</span>
						);
					}
					const label = t(`workspace.tabs.${id}`);
					return (
						<DesktopAppButton
							key={id}
							type="button"
							size="sm"
							variant={isActive ? 'accent' : 'neutral'}
							className="shrink-0 gap-1.5"
							role="tab"
							aria-selected={isActive}
							id={`customer-tab-${id}-${projectId}`}
							aria-controls={`customer-panel-${id}-${projectId}`}
							title={tabTitle}
							aria-label={tabTitle ? `${label}. ${tabTitle}` : label}
							onClick={() => selectTab(id)}
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
				id={`customer-panel-${tab}-${projectId}`}
				aria-labelledby={`customer-tab-${tab}-${projectId}`}
			>
				{tab === 'summary' ? (
					<CustomerFacingSummaryRead projectId={projectId} />
				) : null}
				{tab === 'diagnostic' && diagnosticEnabled ? (
					<CustomerDiagnosticRunner projectId={projectId} />
				) : null}
				{tab === 'documents' ? (
					<ClientInteractionView
						selectedProjectId={projectId}
						readOnlyMarketing
						variant="embedded"
						layout="documents-only"
					/>
				) : null}
				{tab === 'presentations' ? (
					<ClientInteractionView
						selectedProjectId={projectId}
						readOnlyMarketing
						variant="embedded"
						layout="presentations-only"
					/>
				) : null}
				{tab === 'chat' ? (
					<ClientInteractionView
						selectedProjectId={projectId}
						readOnlyMarketing
						variant="embedded"
						layout="chat-only"
					/>
				) : null}
			</DesktopAppSurface>
		</div>
	);
}
