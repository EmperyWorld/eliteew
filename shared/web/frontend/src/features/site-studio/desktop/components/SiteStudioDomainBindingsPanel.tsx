/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Domain bindings panel for Site Studio: TXT → route → TLS → active stepper and binding lifecycle APIs.
 *
 * Invariants:
 * - Domain list refreshes after every binding action.
 * - Machine binding ids stay out of primary user-facing copy.
 *
 * Related:
 * - `SiteStudioRuntimePanel.tsx`
 * - `../api.ts`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';

import {
	activateSiteStudioDomainBinding,
	createSiteStudioDomainBinding,
	disableSiteStudioDomainBinding,
	listSiteStudioDomainBindings,
	requestSiteStudioDomainRoute,
	type SiteStudioDomainBinding,
	verifySiteStudioDomainBinding,
} from '../api';
import {
	domainStepDotTone,
	domainStepTone,
	formatDomainBindingState,
	getDomainToken,
	resolveDomainProgressSteps,
} from './siteStudioRuntimeShared';

export interface SiteStudioDomainBindingsPanelProps {
	onCopy: (value: string, label: string) => void;
}

export const SiteStudioDomainBindingsPanel: React.FC<
	SiteStudioDomainBindingsPanelProps
> = ({ onCopy }) => {
	const { t } = useTranslation('siteStudio');
	const [domainInput, setDomainInput] = React.useState('');
	const [domainBindings, setDomainBindings] = React.useState<
		SiteStudioDomainBinding[]
	>([]);
	const [domainBusy, setDomainBusy] = React.useState<string | null>(null);
	const [domainError, setDomainError] = React.useState<string | null>(null);
	const refreshDomains = React.useCallback(async () => {
		try {
			setDomainError(null);
			const rows = await listSiteStudioDomainBindings();
			setDomainBindings(rows);
		} catch (error) {
			setDomainError(error instanceof Error ? error.message : String(error));
		}
	}, []);
	React.useEffect(() => {
		void refreshDomains();
	}, [refreshDomains]);
	const runDomainAction = React.useCallback(
		async (key: string, action: () => Promise<SiteStudioDomainBinding>) => {
			try {
				setDomainBusy(key);
				setDomainError(null);
				await action();
				await refreshDomains();
			} catch (error) {
				setDomainError(error instanceof Error ? error.message : String(error));
			} finally {
				setDomainBusy(null);
			}
		},
		[refreshDomains]
	);
	const handleCreateDomain = React.useCallback(() => {
		const hostname = domainInput.trim();
		if (!hostname) return;
		void runDomainAction('create', async () => {
			const row = await createSiteStudioDomainBinding(hostname);
			setDomainInput('');
			return row;
		});
	}, [domainInput, runDomainAction]);

	return (
		<DesktopAppSurface variant="soft" padding="sm" className="space-y-3">
			<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
				{t('runtime.domainsTitle')}
			</div>
			<p className="text-xs leading-5 text-(--desktop-text-secondary)">
				{t('runtime.domainsDescription')}
			</p>
			<div className="flex flex-col gap-2 sm:flex-row">
				<input
					type="text"
					value={domainInput}
					onChange={(event) => setDomainInput(event.target.value)}
					placeholder={t('runtime.domainsPlaceholder')}
					className="min-w-0 flex-1 rounded-md border border-(--desktop-border) bg-(--desktop-surface) px-3 py-2 text-sm text-(--desktop-text-primary) outline-none focus:border-sky-300/60"
				/>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="accent"
					disabled={domainBusy === 'create' || !domainInput.trim()}
					onClick={handleCreateDomain}
				>
					{t('runtime.domainsAdd')}
				</DesktopAppButton>
			</div>
			{domainError ? (
				<div className="rounded-md border border-red-500/20 bg-red-500/8 p-2 text-xs text-red-100">
					{t('runtime.lastError', { message: domainError })}
				</div>
			) : null}
			<div className="space-y-2">
				{domainBindings.length === 0 ? (
					<div className="text-xs text-(--desktop-text-muted)">
						{t('runtime.domainsEmpty')}
					</div>
				) : (
					domainBindings.map((binding) => {
						const token = getDomainToken(binding);
						const domainProgressSteps = resolveDomainProgressSteps(binding);
						return (
							<div
								key={binding.id}
								className="rounded-md border border-(--desktop-border) bg-(--desktop-surface) p-3"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div>
										<div className="break-all text-sm font-medium text-(--desktop-text-primary)">
											{binding.hostname}
										</div>
										<div className="mt-1 text-xs text-(--desktop-text-muted)">
											{formatDomainBindingState(t, binding)}
										</div>
									</div>
									<div className="flex flex-wrap gap-1">
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											disabled={domainBusy === `verify:${binding.id}`}
											onClick={() =>
												void runDomainAction(`verify:${binding.id}`, () =>
													verifySiteStudioDomainBinding(binding.id)
												)
											}
										>
											{t('runtime.domainsVerify')}
										</DesktopAppButton>
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											disabled={domainBusy === `route:${binding.id}`}
											onClick={() =>
												void runDomainAction(`route:${binding.id}`, () =>
													requestSiteStudioDomainRoute(binding.id)
												)
											}
										>
											{t('runtime.domainsRequestRoute')}
										</DesktopAppButton>
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											disabled={domainBusy === `activate:${binding.id}`}
											onClick={() =>
												void runDomainAction(`activate:${binding.id}`, () =>
													activateSiteStudioDomainBinding(binding.id)
												)
											}
										>
											{t('runtime.domainsActivate')}
										</DesktopAppButton>
										<DesktopAppButton
											type="button"
											size="sm"
											variant="ghost"
											disabled={domainBusy === `disable:${binding.id}`}
											onClick={() =>
												void runDomainAction(`disable:${binding.id}`, () =>
													disableSiteStudioDomainBinding(binding.id)
												)
											}
										>
											{t('runtime.domainsDisable')}
										</DesktopAppButton>
									</div>
								</div>
								<ol
									className="mt-3 grid list-none gap-2 p-0 sm:grid-cols-4"
									aria-label={t('runtime.domainsProgressAria', {
										hostname: binding.hostname,
									})}
								>
									{domainProgressSteps.map((step) => (
										<li
											key={step.id}
											className={`rounded-md border p-2 ${domainStepTone(step.status)}`}
											aria-current={
												step.status === 'current' ? 'step' : undefined
											}
										>
											<div className="flex items-center gap-2">
												<span
													className={`h-2 w-2 shrink-0 rounded-full ${domainStepDotTone(step.status)}`}
													aria-hidden
												/>
												<span className="text-xs font-medium text-(--desktop-text-primary)">
													{t(step.labelKey)}
												</span>
											</div>
											<div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-(--desktop-text-dim)">
												{t(`runtime.domainsStepStatus.${step.status}`)}
											</div>
										</li>
									))}
								</ol>
								<div className="mt-3 grid gap-2 text-xs text-(--desktop-text-secondary) md:grid-cols-2">
									<div>
										<div className="text-(--desktop-text-dim)">
											{t('runtime.domainsTxtName')}
										</div>
										<button
											type="button"
											className="mt-1 break-all text-left text-sky-200 hover:underline"
											onClick={() =>
												onCopy(
													binding.verification_name,
													t('runtime.domainsTxtName')
												)
											}
										>
											{binding.verification_name}
										</button>
									</div>
									<div>
										<div className="text-(--desktop-text-dim)">
											{t('runtime.domainsTxtValue')}
										</div>
										<button
											type="button"
											className="mt-1 break-all text-left text-sky-200 hover:underline"
											onClick={() =>
												onCopy(token, t('runtime.domainsTxtValue'))
											}
										>
											{token}
										</button>
									</div>
								</div>
								{binding.last_error ? (
									<div className="mt-3 rounded-md border border-red-500/20 bg-red-500/8 p-2 text-xs text-red-100">
										{t('runtime.lastError', {
											message: binding.last_error,
										})}
									</div>
								) : null}
							</div>
						);
					})
				)}
			</div>
		</DesktopAppSurface>
	);
};

export default SiteStudioDomainBindingsPanel;
