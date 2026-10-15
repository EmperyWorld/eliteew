/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * New IMC research run form (type, URL, focus, brief) plus embedded compare panel.
 *
 * Invariants:
 * - canRun / rag_project_only / toolbar doc hints match pre-atomization behavior.
 *
 * Related:
 * - ImcResearchView.tsx
 * - ImcResearchComparePanel.tsx
 */

import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { ArrowPathIcon, PlayIcon } from '@heroicons/react/24/outline';
import {
	DesktopAppButton,
	DesktopAppErrorState,
	DESKTOP_APP_STYLE_CONTRACT,
} from '../../../Desktop/components/DesktopAppChrome';
import { MarketingCabinetSelect } from '../../components/MarketingCabinetSelect';
import { SectionPanel } from '../../components/SectionPanel';
import { TEXTAREA_CLASS } from '../../constants';
import { extractApiErrorMessage } from '../../utils';
import { IMC_CONTROL_CLASS } from './imcResearchHelpers';
import { ImcResearchComparePanel } from './ImcResearchComparePanel';
import type { ImcResearchController } from './useImcResearchController';

export function ImcResearchRunForm({ c }: { c: ImcResearchController }) {
	return (
		<SectionPanel
			title={c.t('imcView.formTitle')}
			description={
				c.ragProjectOnly
					? c.t('imcView.formDescriptionRagOnly')
					: c.t('imcView.formDescription')
			}
			className="min-w-0"
		>
			{c.typesQuery.isError ? (
				<DesktopAppErrorState
					message={`${c.t('imcView.typesErrorTitle')}: ${extractApiErrorMessage(c.typesQuery.error, c.t('imcView.typesErrorDefault'))}`}
					actionLabel={c.t('imcView.refreshList')}
					onAction={() => void c.typesQuery.refetch()}
				/>
			) : c.types.length === 0 && !c.typesQuery.isLoading ? (
				<p className="text-sm text-(--desktop-text-muted) antialiased">
					{c.t('imcView.noTypesHint')}
				</p>
			) : (
				<div className="flex flex-col gap-6">
					{c.weakRagBanner ? (
						<div
							className={cn(
								'rounded-(--desktop-radius) border border-amber-500/35 bg-amber-950/35 px-3 py-2.5 text-sm text-amber-50'
							)}
							role="status"
						>
							{c.t('imcView.ragWeakBanner')}
						</div>
					) : null}
					<div className="min-w-0 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 p-4 sm:p-5">
						<div className="grid min-w-0 gap-2 text-sm">
							<label
								htmlFor={c.fieldTypeSelectId}
								className="text-(--desktop-text-muted)"
							>
								{c.t('imcView.fieldType')}
							</label>
							<MarketingCabinetSelect
								id={c.fieldTypeSelectId}
								aria-label={c.selectedTypeTitle}
								value={c.typeKey}
								onChange={c.setTypeKey}
								options={c.researchTypeOptions}
								disabled={c.typesQuery.isLoading}
							/>
							<p className={DESKTOP_APP_STYLE_CONTRACT.helperText}>
								{c.t('imcView.outputLanguageRuHint')}
							</p>
						</div>
					</div>
					<div className="flex flex-col gap-4">
						<label className="grid gap-2 text-sm">
							<span className="text-(--desktop-text-muted)">
								{c.t('imcView.fieldUrl')}
							</span>
							<input
								type="url"
								inputMode="url"
								autoComplete="url"
								className={`${IMC_CONTROL_CLASS} min-h-10 px-3 py-2 text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)`}
								value={c.sourceUrl}
								onChange={(e) => c.setSourceUrl(e.target.value)}
								placeholder="https://"
							/>
						</label>
						<div className="grid gap-2 text-sm">
							<span className="text-(--desktop-text-muted)">
								{c.t('imcView.fieldFocus')}
							</span>
							<MarketingCabinetSelect
								value={c.focusKey}
								onChange={c.setFocusKey}
								size="compact"
								options={[
									{ value: '', label: c.t('imcView.focusNone') },
									{
										value: 'global',
										label: c.t('imcView.focusGlobal'),
									},
									{ value: 'rf', label: c.t('imcView.focusRf') },
									{
										value: 'mixed',
										label: c.t('imcView.focusMixed'),
									},
								]}
								className="normal-case tracking-normal"
							/>
							<p className={DESKTOP_APP_STYLE_CONTRACT.helperText}>
								{c.t('imcView.fieldFocusHint')}
							</p>
						</div>
						<label className="grid gap-2 text-sm">
							<span className="text-(--desktop-text-muted)">
								{c.t('imcView.fieldBrief')}
							</span>
							<textarea
								className={cn(
									TEXTAREA_CLASS,
									'disabled:cursor-not-allowed disabled:opacity-60'
								)}
								rows={6}
								value={c.brief}
								onChange={(e) => c.setBrief(e.target.value)}
								placeholder={c.t('imcView.fieldBriefPlaceholder')}
							/>
						</label>
					</div>
					<div
						className={cn(
							'rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/25 px-3 py-2.5 leading-relaxed',
							DESKTOP_TYPOGRAPHY.meta
						)}
						role="note"
					>
						{c.ragProjectOnly ? (
							c.toolbarContentId ? (
								<p>{c.t('imcView.toolbarDocHintRagOnly')}</p>
							) : (
								<p>{c.t('imcView.sourceHintRagOnly')}</p>
							)
						) : c.toolbarContentId ? (
							<p>{c.t('imcView.toolbarDocHint')}</p>
						) : (
							<p>{c.t('imcView.sourceHint')}</p>
						)}
					</div>
					{c.runError ? (
						<div
							className="rounded-(--desktop-radius) border border-red-500/35 bg-red-950/45 px-3 py-2.5 text-sm text-red-100"
							role="alert"
						>
							{c.runError}
						</div>
					) : null}
					<DesktopAppButton
						type="button"
						variant="accent"
						className="w-full gap-2 sm:w-fit"
						disabled={!c.canRun || c.runMutation.isPending}
						aria-busy={c.runMutation.isPending}
						onClick={c.handleRun}
					>
						{c.runMutation.isPending ? (
							<ArrowPathIcon
								className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						) : (
							<PlayIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						)}
						{c.t('imcView.runAction')}
					</DesktopAppButton>
					<ImcResearchComparePanel c={c} />
				</div>
			)}
		</SectionPanel>
	);
}
