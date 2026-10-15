/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Support-only storage map card in expansion settings — persistence buckets and
 * field deep-links stay behind an explicit «For support» disclosure.
 *
 * Invariants:
 * - Lazy-loaded from `DesktopSettingsExpansionSection` (last in user card order).
 * - Outer summary never shows raw field counts; counts appear only inside support body.
 * - Field rows link to tab/anchor targets via `onStorageMapFieldNavigate`.
 *
 * Related:
 * - `desktopSettingsExpansionSection.types.ts`
 * - `DesktopChromeTooltip.tsx`
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { getDesktopShellToolbarClusterInsetControlClassName } from '../../../utils/desktopVisualSystem';
import { resolveStorageMapFieldNavigateTarget } from '../../../utils/desktopSettingsStorageMapNavigation';
import { DESKTOP_INTERACTIVE, DESKTOP_TYPOGRAPHY } from '../../../constants';
import { SettingsFormCard } from '../DesktopSettingsFormCard';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import type { ExpansionCardBaseProps } from './desktopSettingsExpansionSection.types';
import { DesktopSettingsExpansionSaveErrorBanner } from './DesktopSettingsExpansionSaveErrorBanner';

export function DesktopSettingsExpansionStorageCard({
	expansionSettings,
	shell,
	onStorageMapFieldNavigate,
}: ExpansionCardBaseProps) {
	const { t } = useTranslation('desktopUi');
	return (
		<details
			className="group rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40"
			data-testid="desktop-settings-support-diagnostics"
		>
			<summary
				className={cn(
					'cursor-pointer list-none px-4 py-3 text-sm font-semibold text-(--desktop-text-primary) marker:content-none',
					DESKTOP_INTERACTIVE.focusRing
				)}
			>
				<span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
					<span>{t('settingsPanel.supportDiagnosticsTitle')}</span>
					<span className="text-xs font-normal text-(--desktop-text-dim)">
						{t('settingsPanel.supportDiagnosticsHint')}
					</span>
				</span>
			</summary>
			<div className="border-t border-(--desktop-border-subtle) p-1 pt-0">
				<details className="mx-3 my-3 rounded-lg border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/30">
					<summary
						className={cn(
							'cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-(--desktop-text-secondary) marker:content-none',
							DESKTOP_INTERACTIVE.focusRing
						)}
					>
						{t('settingsPanel.cardStorageMapCollapsedTitle')}
					</summary>
					<div className="border-t border-(--desktop-border-subtle) p-1 pt-0">
						<SettingsFormCard
							title={t('settingsPanel.cardStorageMapTitle')}
							windowStyle={shell.windowStyle}
						>
							<p className={cn(DESKTOP_TYPOGRAPHY.caption, 'mb-3')}>
								{t('settingsPanel.supportDiagnosticsStorageIntro')}
							</p>
							<DesktopSettingsExpansionSaveErrorBanner
								prefix={t('settingsPanel.expansionSaveError')}
								error={expansionSettings.error}
							/>
							<div className="grid gap-3 lg:grid-cols-2">
								{expansionSettings.storageMap.map((row) => (
									<div
										key={row.id}
										className={cn(
											getDesktopShellToolbarClusterInsetControlClassName(
												shell.windowStyle
											),
											'rounded-xl px-3 py-3'
										)}
									>
										<div className="flex items-center justify-between gap-2">
											<p className="text-sm font-semibold text-(--desktop-text-primary)">
												{row.label}
											</p>
											<span className={DESKTOP_TYPOGRAPHY.shellMeta10}>
												{t(`settingsPanel.storageBucket.${row.bucket}`)}
												{' · '}
												{t('settingsPanel.storageMapFieldCount', {
													count: row.fields.length,
												})}
											</span>
										</div>
										<p className={cn(DESKTOP_TYPOGRAPHY.caption, 'mt-1')}>
											{row.description}
										</p>
										<ul
											className={cn(
												DESKTOP_TYPOGRAPHY.captionInherit,
												'mt-2 max-h-28 list-none space-y-0.5 overflow-y-auto pl-0 text-(--desktop-text-dim)'
											)}
											aria-label={t('settingsPanel.storageMapFieldsListAria', {
												bucket: row.label,
											})}
										>
											{row.fields.map((field) => {
												const target = resolveStorageMapFieldNavigateTarget(
													row.bucket,
													field
												);
												const canNavigate =
													Boolean(target) && Boolean(onStorageMapFieldNavigate);
												return (
													<li key={field}>
														{canNavigate && target ? (
															<DesktopChromeTooltip
																content={t(
																	'settingsPanel.storageMapFieldGoTo',
																	{
																		field,
																	}
																)}
																placement="top"
																offsetExtra={4}
															>
																<button
																	type="button"
																	className={cn(
																		'rounded px-1 py-0.5 text-left font-mono underline-offset-2 hover:text-(--desktop-text-primary) hover:underline',
																		DESKTOP_TYPOGRAPHY.shellMeta10,
																		'text-(--desktop-text-dim)',
																		DESKTOP_INTERACTIVE.focusRing
																	)}
																	aria-controls={target.elementId}
																	data-testid={`desktop-settings-storage-map-field-${row.bucket}-${field}`}
																	onClick={() =>
																		onStorageMapFieldNavigate?.(target)
																	}
																>
																	{field}
																</button>
															</DesktopChromeTooltip>
														) : (
															<code
																className={cn(
																	'font-mono',
																	DESKTOP_TYPOGRAPHY.shellMeta10
																)}
															>
																{field}
															</code>
														)}
													</li>
												);
											})}
										</ul>
									</div>
								))}
							</div>
						</SettingsFormCard>
					</div>
				</details>
			</div>
		</details>
	);
}
