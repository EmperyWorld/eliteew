/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Domains view for Site Manager Ops: domain/TLS steppers and confirmable operator actions.
 *
 * Invariants:
 * - Presentational wiring only; mutations come from useSiteManagerOps.
 *
 * Related:
 * - ./DomainStepperCard.tsx
 * - ./useSiteManagerOps.ts
 */
import * as React from 'react';

import { DesktopAppSurface } from '@/pages/Desktop/components/DesktopAppChrome';

import { EmptyLine, SectionTitle } from '../SiteManagerOpsAtoms';
import { DomainStepperCard } from './DomainStepperCard';
import type { SiteManagerOpsModel } from './useSiteManagerOps';

export const DomainsModePanel: React.FC<{ ops: SiteManagerOpsModel }> = ({
	ops,
}) => {
	const {
		t,
		busy,
		confirmAction,
		setConfirmAction,
		uxOverview,
		runOutboxApply,
		runTlsReady,
	} = ops;

	return (
		<DesktopAppSurface
			id="site-manager-domain-stepper"
			variant="soft"
			padding="sm"
			className="space-y-3 scroll-mt-4"
		>
			<SectionTitle title={t('siteManager.domains.title')} />
			<p className="text-sm leading-6 text-(--desktop-text-secondary)">
				{t('siteManager.domains.description')}
			</p>
			{uxOverview?.domains.length ? (
				uxOverview.domains.map((domain) => (
					<DomainStepperCard
						key={domain.binding.id}
						domain={domain}
						busy={busy}
						onApplyOutbox={(id) => void runOutboxApply(id)}
						onTlsReady={(bindingId, hostname) =>
							void runTlsReady(bindingId, hostname)
						}
						confirmAction={confirmAction}
						onConfirmAction={setConfirmAction}
						t={t}
					/>
				))
			) : (
				<EmptyLine text={t('siteManager.domains.empty')} />
			)}
		</DesktopAppSurface>
	);
};
