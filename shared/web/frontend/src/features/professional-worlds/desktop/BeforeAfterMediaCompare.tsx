/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reusable before/after media comparison primitive for Professional Worlds enhancement review flows.
 *
 * Invariants:
 * - The original asset remains visible and labeled; generated media is never presented without comparison context.
 * - Accept/reject actions are optional callbacks so the component can be used for read-only previews.
 *
 * Related:
 * - types.ts
 * - ProfessionalWorldsApp.tsx
 */

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import {
	ProfessionalWorldsFormField,
	ProfessionalWorldsWorkspacePanel,
} from './layout';
import {
	PW_MEDIA_OVERLAY_BADGE_CLASS,
	PW_MEDIA_SPLIT_HANDLE_CLASS,
} from './layout/professionalWorldsLayoutTokens';

export interface BeforeAfterMediaAsset {
	url: string;
	alt: string;
	label?: string;
}

export function BeforeAfterMediaCompare({
	before,
	after,
	title,
	description,
	onAccept,
	onReject,
	acceptLabel,
	rejectLabel,
	disabled = false,
}: {
	before: BeforeAfterMediaAsset;
	after: BeforeAfterMediaAsset;
	title?: string;
	description?: string;
	onAccept?: () => void | Promise<void>;
	onReject?: () => void | Promise<void>;
	acceptLabel?: string;
	rejectLabel?: string;
	disabled?: boolean;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const comparisonSplitFieldId = useId();
	const [split, setSplit] = useState(50);
	const [busyAction, setBusyAction] = useState<'accept' | 'reject' | null>(
		null
	);

	async function runAction(action: 'accept' | 'reject') {
		const callback = action === 'accept' ? onAccept : onReject;
		if (!callback) {
			return;
		}
		setBusyAction(action);
		try {
			await callback();
		} finally {
			setBusyAction(null);
		}
	}

	return (
		<ProfessionalWorldsWorkspacePanel
			title={title ?? t('beforeAfter.title')}
			className="grid gap-4 p-4"
		>
			{description ? (
				<p className="text-xs text-(--desktop-text-secondary)">{description}</p>
			) : null}
			<div className="relative overflow-hidden rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-black">
				<img
					src={before.url}
					alt={before.alt}
					className="block h-80 w-full object-contain"
					draggable={false}
				/>
				<div
					className="absolute inset-0 overflow-hidden"
					style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
				>
					<img
						src={after.url}
						alt={after.alt}
						className="h-80 w-full object-contain"
						draggable={false}
					/>
				</div>
				<div
					className={PW_MEDIA_SPLIT_HANDLE_CLASS}
					style={{ left: `${split}%` }}
				/>
				<div
					className={`absolute left-3 top-3 ${PW_MEDIA_OVERLAY_BADGE_CLASS}`}
				>
					{after.label ?? t('beforeAfter.afterLabel')}
				</div>
				<div
					className={`absolute right-3 top-3 ${PW_MEDIA_OVERLAY_BADGE_CLASS}`}
				>
					{before.label ?? t('beforeAfter.beforeLabel')}
				</div>
			</div>
			<ProfessionalWorldsFormField
				htmlFor={comparisonSplitFieldId}
				label={t('beforeAfter.splitLabel')}
			>
				<input
					id={comparisonSplitFieldId}
					type="range"
					min={0}
					max={100}
					value={split}
					disabled={disabled || busyAction !== null}
					onChange={(event) => setSplit(Number(event.target.value))}
					className="accent-[rgb(var(--desktop-accent-rgb))]"
				/>
			</ProfessionalWorldsFormField>
			{(onAccept || onReject) && (
				<div className="flex flex-wrap gap-2">
					{onAccept && (
						<DesktopAppButton
							disabled={disabled || busyAction !== null}
							onClick={() => void runAction('accept')}
						>
							{busyAction === 'accept'
								? t('beforeAfter.accepting')
								: (acceptLabel ?? t('beforeAfter.accept'))}
						</DesktopAppButton>
					)}
					{onReject && (
						<DesktopAppButton
							variant="danger"
							disabled={disabled || busyAction !== null}
							onClick={() => void runAction('reject')}
						>
							{busyAction === 'reject'
								? t('beforeAfter.rejecting')
								: (rejectLabel ?? t('beforeAfter.reject'))}
						</DesktopAppButton>
					)}
				</div>
			)}
		</ProfessionalWorldsWorkspacePanel>
	);
}
