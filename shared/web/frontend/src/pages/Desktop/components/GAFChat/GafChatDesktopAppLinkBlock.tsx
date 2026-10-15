/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render validated desktop app link messages in GAF chat (body + open button).
 *
 * Invariants:
 * - Opens apps only via `openAppByComponent` from desktop shell context.
 *
 * Related:
 * - gafChatDesktopAppLinkMeta.ts; GAFChatMessageBubble.tsx
 * - DesktopChromeTooltip.tsx
 */
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import type { GafDesktopAppLinkMeta } from './gafChatDesktopAppLinkMeta';
import {
	highlightSearchInPlainText,
	renderGafMessageContent,
} from './gafChatMessageBodyRender';

type DesktopGafOpen = { openAppByComponent: (c: string) => void } | null;

type Props = {
	messageId: string;
	body: string;
	meta: GafDesktopAppLinkMeta;
	highlightQuery: string;
	plainShellClass: string;
	bodyMarkdownProse: string;
	gafDesktop: DesktopGafOpen;
	t: TFunction<'gafChat'>;
};

export function GafChatDesktopAppLinkBlock({
	body,
	meta,
	highlightQuery,
	plainShellClass,
	bodyMarkdownProse,
	gafDesktop,
	t,
}: Props): ReactNode {
	const bodyStr = body.trim();
	const hq = highlightQuery.trim();
	const renderedBody =
		bodyStr && hq && !bodyStr.includes('```') ? (
			<div
				className={cn(
					'wrap-anywhere whitespace-pre-wrap leading-[1.45]',
					plainShellClass
				)}
			>
				{highlightSearchInPlainText(bodyStr, hq)}
			</div>
		) : bodyStr ? (
			renderGafMessageContent(bodyStr, bodyMarkdownProse, plainShellClass)
		) : null;

	return (
		<div className="min-w-0">
			{renderedBody}
			<div className="mt-2 flex flex-wrap gap-1.5">
				{gafDesktop ? (
					<DesktopChromeTooltip
						content={meta.button_label}
						placement="top"
						offsetExtra={4}
					>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="touch-manipulation"
							onClick={() =>
								gafDesktop.openAppByComponent(meta.open_app_component)
							}
						>
							{meta.button_label}
						</DesktopAppButton>
					</DesktopChromeTooltip>
				) : (
					<p className={DESKTOP_TYPOGRAPHY.meta}>
						{t('desktopAppLinkDesktopOnlyHint')}
					</p>
				)}
			</div>
		</div>
	);
}
