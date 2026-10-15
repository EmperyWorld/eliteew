/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Side-by-side compare of two completed IMC research markdown results.
 *
 * Invariants:
 * - Renders only when at least two completed runs exist for the project list.
 *
 * Related:
 * - ImcResearchRunForm.tsx
 * - ImcResearchResultMarkdown
 */

import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { DESKTOP_APP_STYLE_CONTRACT } from '../../../Desktop/components/DesktopAppChrome';
import { ImcResearchResultMarkdown } from '../../components/ImcResearchResultMarkdown';
import { MarketingCabinetSelect } from '../../components/MarketingCabinetSelect';
import type { ImcResearchController } from './useImcResearchController';

export function ImcResearchComparePanel({ c }: { c: ImcResearchController }) {
	if (c.completedForCompare.length < 2) return null;

	return (
		<div className="space-y-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 p-4">
			<h3
				className={cn(
					DESKTOP_APP_STYLE_CONTRACT.helperText,
					'font-semibold uppercase tracking-wider'
				)}
			>
				{c.t('imcView.compareTitle')}
			</h3>
			<p className={DESKTOP_TYPOGRAPHY.meta}>
				{c.t('imcView.compareDescription')}
			</p>
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="grid gap-1.5 text-sm">
					<span className="text-(--desktop-text-muted)">
						{c.t('imcView.compareLeft')}
					</span>
					<MarketingCabinetSelect
						value={c.compareLeftId}
						onChange={c.setCompareLeftId}
						size="compact"
						options={[
							{ value: '', label: c.t('imcView.comparePick') },
							...c.completedForCompare.map((x) => ({
								value: x.id,
								label: `${x.display_name} — ${x.created_at.slice(0, 10)}`,
							})),
						]}
						className="normal-case tracking-normal"
					/>
				</div>
				<div className="grid gap-1.5 text-sm">
					<span className="text-(--desktop-text-muted)">
						{c.t('imcView.compareRight')}
					</span>
					<MarketingCabinetSelect
						value={c.compareRightId}
						onChange={c.setCompareRightId}
						size="compact"
						options={[
							{ value: '', label: c.t('imcView.comparePick') },
							...c.completedForCompare.map((x) => ({
								value: x.id,
								label: `${x.display_name} — ${x.created_at.slice(0, 10)}`,
							})),
						]}
						className="normal-case tracking-normal"
					/>
				</div>
			</div>
			{c.compareLeftId &&
			c.compareRightId &&
			c.compareLeftId !== c.compareRightId ? (
				<div className="grid gap-3 lg:grid-cols-2">
					<div className="min-h-0 min-w-0 space-y-2">
						<div className="space-y-0.5">
							<p className={DESKTOP_TYPOGRAPHY.meta}>
								{c.t('imcView.compareColumnA')}
							</p>
							{c.compareLeftQuery.data?.result_text ? (
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'text-(--desktop-text-dim)'
									)}
								>
									{c.t('imcView.resultTextStats', {
										chars: c.compareLeftStats.chars.toLocaleString(
											c.statLocale
										),
										lines: c.compareLeftStats.lines.toLocaleString(
											c.statLocale
										),
									})}
								</p>
							) : null}
						</div>
						{c.compareLeftQuery.isLoading ? (
							<ArrowPathIcon
								className="h-6 w-6 motion-safe:animate-spin text-(--desktop-text-dim)"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						) : c.compareLeftQuery.data?.result_text ? (
							<article className="max-h-[min(50vh,28rem)] overflow-y-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) p-3">
								<ImcResearchResultMarkdown
									markdown={c.compareLeftQuery.data.result_text}
								/>
							</article>
						) : (
							<p className={DESKTOP_TYPOGRAPHY.meta}>
								{c.t('imcView.compareNoText')}
							</p>
						)}
					</div>
					<div className="min-h-0 min-w-0 space-y-2">
						<div className="space-y-0.5">
							<p className={DESKTOP_TYPOGRAPHY.meta}>
								{c.t('imcView.compareColumnB')}
							</p>
							{c.compareRightQuery.data?.result_text ? (
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'text-(--desktop-text-dim)'
									)}
								>
									{c.t('imcView.resultTextStats', {
										chars: c.compareRightStats.chars.toLocaleString(
											c.statLocale
										),
										lines: c.compareRightStats.lines.toLocaleString(
											c.statLocale
										),
									})}
								</p>
							) : null}
						</div>
						{c.compareRightQuery.isLoading ? (
							<ArrowPathIcon
								className="h-6 w-6 motion-safe:animate-spin text-(--desktop-text-dim)"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						) : c.compareRightQuery.data?.result_text ? (
							<article className="max-h-[min(50vh,28rem)] overflow-y-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) p-3">
								<ImcResearchResultMarkdown
									markdown={c.compareRightQuery.data.result_text}
								/>
							</article>
						) : (
							<p className={DESKTOP_TYPOGRAPHY.meta}>
								{c.t('imcView.compareNoText')}
							</p>
						)}
					</div>
				</div>
			) : null}
		</div>
	);
}
