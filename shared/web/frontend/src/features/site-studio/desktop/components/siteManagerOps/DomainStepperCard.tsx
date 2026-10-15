/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Domain/TLS stepper card with explicit confirmable operator mark-applied / mark-TLS-ready actions.
 *
 * Invariants:
 * - Mutations are caller-provided callbacks; this card does not call Site Manager APIs itself.
 *
 * Related:
 * - ../SiteManagerOpsAtoms.tsx
 * - ./SiteManagerOpsPanel.tsx
 */
import * as React from 'react';
import type { TFunction } from 'i18next';

import { ConfirmableActionButton, RowCard } from '../SiteManagerOpsAtoms';
import type { SiteManagerUxDomainFlow } from '../../siteManagerUserStatus';

export const DomainStepperCard: React.FC<{
	domain: SiteManagerUxDomainFlow;
	busy: string | null;
	onApplyOutbox: (outboxId: string) => void;
	onTlsReady: (bindingId: string, hostname: string) => void;
	confirmAction: string | null;
	onConfirmAction: (action: string | null) => void;
	t: TFunction<'siteStudio'>;
}> = ({
	domain,
	busy,
	onApplyOutbox,
	onTlsReady,
	confirmAction,
	onConfirmAction,
	t,
}) => (
	<RowCard>
		<div className="min-w-0 flex-1 space-y-3">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<div className="break-all text-sm font-medium text-(--desktop-text-primary)">
						{domain.binding.hostname}
					</div>
					<div className="mt-1 text-xs text-(--desktop-text-muted)">
						{t(domain.statusKey)}
					</div>
				</div>
				{domain.needsOperator ? (
					<span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100">
						{t('siteManager.domains.operatorStep')}
					</span>
				) : null}
			</div>
			<ol className="m-0 grid list-none gap-2 p-0 md:grid-cols-5">
				{domain.steps.map((step) => (
					<li
						key={step.id}
						className={`rounded-md border p-2 text-xs ${
							step.status === 'done'
								? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
								: step.status === 'current'
									? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
									: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)'
						}`}
					>
						<div className="font-medium">{t(step.labelKey)}</div>
						<div className="mt-1 opacity-80">
							{t(`siteManager.domainStepStatus.${step.status}`)}
						</div>
					</li>
				))}
			</ol>
		</div>
		<div className="flex flex-wrap gap-2">
			{domain.pendingOutbox ? (
				<ConfirmableActionButton
					actionId={`outbox:${domain.pendingOutbox.id}`}
					busy={busy}
					confirmAction={confirmAction}
					label={t('siteManager.domains.markRouteApplied')}
					confirmLabel={t('siteManager.domains.confirmRouteApplied')}
					cancelLabel={t('siteManager.domains.cancelConfirm')}
					onConfirmAction={onConfirmAction}
					onRun={() => {
						if (domain.pendingOutbox) {
							onApplyOutbox(domain.pendingOutbox.id);
						}
					}}
				/>
			) : null}
			{domain.binding.status === 'route_pending' &&
			domain.binding.tls_status !== 'ready' ? (
				<ConfirmableActionButton
					actionId={`tls:${domain.binding.id}`}
					busy={busy}
					confirmAction={confirmAction}
					label={t('siteManager.domains.markTlsReady')}
					confirmLabel={t('siteManager.domains.confirmTlsReady')}
					cancelLabel={t('siteManager.domains.cancelConfirm')}
					onConfirmAction={onConfirmAction}
					onRun={() => onTlsReady(domain.binding.id, domain.binding.hostname)}
				/>
			) : null}
		</div>
	</RowCard>
);
