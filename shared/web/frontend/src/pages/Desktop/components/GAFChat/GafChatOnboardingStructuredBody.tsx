/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render system GAF onboarding with one action button per step (metadata v2).
 *
 * Invariants:
 * - Opens desktop apps only via `gafDesktop.openAppByComponent`.
 *
 * Related:
 * - GAFChatMessageBubble.tsx, DesktopChromeTooltip.tsx
 */
import { cn } from '@/utils/cn';
import { memo, type ReactElement, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { DesktopAppButton } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import {
	highlightSearchInPlainText,
	renderGafMessageContent,
} from './gafChatMessageBodyRender';

export type OnboardingStructuredStep = {
	title?: string;
	body?: string;
	open_app_component?: string;
	button_label?: string;
};

export type OnboardingStructuredPayload = {
	welcome: string;
	thanks: string;
	steps: OnboardingStructuredStep[];
};

type DesktopGafOpen = { openAppByComponent: (c: string) => void } | null;

type Props = {
	messageId: string;
	data: OnboardingStructuredPayload;
	highlightQuery: string;
	plainShellClass: string;
	bodyMarkdownProse: string;
	gafDesktop: DesktopGafOpen;
	t: TFunction<'gafChat'>;
};

function renderTextChunk(
	raw: string,
	hq: string,
	plainShellClass: string,
	bodyMarkdownProse: string
): ReactNode {
	const trimmed = raw.trim();
	if (!trimmed) {
		return null;
	}
	return hq && !trimmed.includes('```') ? (
		<div
			className={cn(
				'wrap-anywhere leading-relaxed whitespace-pre-wrap',
				plainShellClass
			)}
		>
			{highlightSearchInPlainText(trimmed, hq)}
		</div>
	) : (
		renderGafMessageContent(trimmed, bodyMarkdownProse, plainShellClass)
	);
}

const OnboardingStepBlock = memo(function OnboardingStepBlock({
	stepIndex,
	title,
	stepBody,
	component,
	buttonLabel,
	hq,
	plainShellClass,
	bodyMarkdownProse,
	gafDesktop,
	t,
}: {
	stepIndex: number;
	title: string;
	stepBody: string;
	component: string;
	buttonLabel: string;
	hq: string;
	plainShellClass: string;
	bodyMarkdownProse: string;
	gafDesktop: DesktopGafOpen;
	t: TFunction<'gafChat'>;
}) {
	const n = stepIndex + 1;
	const bodyNode = stepBody ? (
		hq && !stepBody.includes('```') ? (
			<div
				className={cn(
					'wrap-anywhere leading-relaxed whitespace-pre-wrap',
					plainShellClass
				)}
			>
				{highlightSearchInPlainText(stepBody, hq)}
			</div>
		) : (
			renderGafMessageContent(stepBody, bodyMarkdownProse, plainShellClass)
		)
	) : null;

	const openLabel = buttonLabel.trim()
		? buttonLabel
		: t('onboardingOpenDefault');

	return (
		<div className="space-y-1.5">
			{title ? (
				<div className="font-medium text-(--desktop-text-primary)">
					{n}. {title}
				</div>
			) : stepBody ? (
				<div className="text-(--desktop-text-muted)">{n}.</div>
			) : null}
			{bodyNode}
			{component && gafDesktop ? (
				<div className="flex flex-wrap gap-1.5">
					<DesktopChromeTooltip
						content={openLabel}
						placement="top"
						offsetExtra={4}
					>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="touch-manipulation"
							onClick={() => gafDesktop.openAppByComponent(component)}
						>
							{openLabel}
						</DesktopAppButton>
					</DesktopChromeTooltip>
				</div>
			) : null}
		</div>
	);
});

export const GafChatOnboardingStructuredBody = memo(
	function GafChatOnboardingStructuredBody({
		messageId,
		data,
		highlightQuery,
		plainShellClass,
		bodyMarkdownProse,
		gafDesktop,
		t,
	}: Props): ReactElement {
		const hq = highlightQuery.trim();

		return (
			<div className="space-y-3">
				{renderTextChunk(data.welcome, hq, plainShellClass, bodyMarkdownProse)}
				{renderTextChunk(data.thanks, hq, plainShellClass, bodyMarkdownProse)}
				{data.steps.map((s, idx) => {
					const title = (s.title ?? '').trim();
					const stepBody = (s.body ?? '').trim();
					const comp = (s.open_app_component ?? '').trim();
					if (!title && !stepBody && !comp) {
						return null;
					}
					const stepKey = `${messageId}|${comp}|${title.length}|${stepBody.length}|${title.slice(0, 48)}|${stepBody.slice(0, 48)}`;
					return (
						<OnboardingStepBlock
							key={stepKey}
							stepIndex={idx}
							title={title}
							stepBody={stepBody}
							component={comp}
							buttonLabel={(s.button_label ?? '').trim()}
							hq={hq}
							plainShellClass={plainShellClass}
							bodyMarkdownProse={bodyMarkdownProse}
							gafDesktop={gafDesktop}
							t={t}
						/>
					);
				})}
			</div>
		);
	}
);
