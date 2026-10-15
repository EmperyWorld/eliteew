/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Operator-visible Professional Worlds → EWDesk draft handoff banner (never auto-publish).
 *
 * Invariants:
 * - Banner is informational; publish only via admin handoff CTA when allowed.
 *
 * Related:
 * - `pages/Desktop/components/EWDeskApp.tsx`
 * - `documentation/product/desktop/EWDESK-NEWS.md`
 */
import type { ProfessionalWorldsEwDeskSuggestion } from '@/features/professional-worlds/desktop/professionalWorldsCrossAppDraft';
import type { TFunction } from 'i18next';
import type { ReactElement } from 'react';
import { DesktopAppButton, DesktopAppSurface } from '../DesktopAppChrome';
import { ProductAssistantMarkdown } from '../ProductAssistantMarkdown';

export interface EwDeskPwDraftBannerProps {
	t: TFunction<'desktopUi', 'ewDesk'>;
	draft: ProfessionalWorldsEwDeskSuggestion;
	canOpenEwDeskAdminPublish: boolean;
	onOpenAdminPublish: () => void;
}

export function EwDeskPwDraftBanner({
	t,
	draft,
	canOpenEwDeskAdminPublish,
	onOpenAdminPublish,
}: EwDeskPwDraftBannerProps): ReactElement {
	return (
		<div className="shrink-0 border-b border-(--desktop-border-subtle)/70 px-3 py-2 md:px-4">
			<DesktopAppSurface
				variant="soft"
				padding="sm"
				className="space-y-2 text-sm text-(--desktop-text-secondary)"
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<strong className="text-(--desktop-text-primary)">
						{t('pwDraftBannerTitle', {
							title: draft.title,
						})}
					</strong>
					<span className="text-xs text-(--desktop-text-muted)">
						{t('pwDraftManualPublishOnly')}
					</span>
				</div>
				<ProductAssistantMarkdown
					content={draft.markdown}
					className="max-h-40 overflow-y-auto text-sm"
				/>
				{canOpenEwDeskAdminPublish && draft.crossAppLinkId ? (
					<div className="flex flex-wrap gap-2 pt-1">
						<DesktopAppButton
							size="sm"
							variant="ghost"
							onClick={onOpenAdminPublish}
							aria-label={t('pwDraftOpenAdminAria')}
						>
							{t('pwDraftOpenAdmin')}
						</DesktopAppButton>
					</div>
				) : null}
			</DesktopAppSurface>
		</div>
	);
}
