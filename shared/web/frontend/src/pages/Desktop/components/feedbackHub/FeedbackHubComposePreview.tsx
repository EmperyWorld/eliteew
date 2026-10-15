/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read-only compose preview for Feedback Hub: assembled body text, char counter, send shortcut hint.
 *
 * Invariants:
 * - Preview is read-only; parent owns body length and submit gate state.
 *
 * Related:
 * - FeedbackHubComposeForm.tsx · feedbackHubComposeStyles.ts · FEEDBACK-HUB.md
 */
import * as React from 'react';
import type { TFunction } from 'i18next';
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { FEEDBACK_BODY_MAX } from '../../utils/feedbackHubConstants';
import {
	FEEDBACK_HUB_CHAR_COUNTER_ID,
	FEEDBACK_HUB_PREVIEW_FIELD_ID,
	FEEDBACK_HUB_PREVIEW_TEXTAREA_CLASS,
	FEEDBACK_HUB_SECTION_HEADING_CLASS,
	FEEDBACK_HUB_SEND_SHORTCUT_HINT_ID,
} from './feedbackHubComposeStyles';

export type FeedbackHubComposePreviewProps = {
	bodyForSubmit: string;
	textLen: number;
	overLimit: boolean;
	charNearLimit: boolean;
	t: TFunction<'desktopUi', 'feedbackHub'>;
};

export function FeedbackHubComposePreview({
	bodyForSubmit,
	textLen,
	overLimit,
	charNearLimit,
	t,
}: FeedbackHubComposePreviewProps): React.ReactElement {
	return (
		<section
			className={cn(
				'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
				'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_95%,transparent)] p-4 sm:p-5',
				'shadow-(--desktop-shadow-soft)'
			)}
			aria-labelledby="feedback-preview-heading"
			data-feedback-hub-guide="preview"
		>
			<div className="space-y-3">
				<div>
					<h4
						id="feedback-preview-heading"
						className={cn('mb-1', FEEDBACK_HUB_SECTION_HEADING_CLASS)}
					>
						{t('previewLabel')}
					</h4>
					<p className={`${DESKTOP_TYPOGRAPHY.meta} leading-relaxed`}>
						{t('previewHint')}
					</p>
				</div>
				<div>
					<textarea
						id={FEEDBACK_HUB_PREVIEW_FIELD_ID}
						readOnly
						value={bodyForSubmit}
						rows={8}
						tabIndex={-1}
						className={cn(
							FEEDBACK_HUB_PREVIEW_TEXTAREA_CLASS,
							overLimit && 'border-rose-500/50 ring-1 ring-rose-500/20'
						)}
						aria-invalid={overLimit}
						aria-label={t('previewLabel')}
						aria-describedby={FEEDBACK_HUB_CHAR_COUNTER_ID}
					/>
					<p
						id={FEEDBACK_HUB_CHAR_COUNTER_ID}
						className={cn(
							'mt-2 flex justify-end tabular-nums',
							DESKTOP_TYPOGRAPHY.meta,
							overLimit
								? 'font-medium text-rose-300'
								: charNearLimit
									? 'font-medium text-amber-200'
									: 'text-(--desktop-text-muted)'
						)}
						role="status"
						aria-live="polite"
						aria-atomic="true"
					>
						{textLen} / {FEEDBACK_BODY_MAX}
						{charNearLimit ? t('charNearLimit') : null}
						{overLimit ? t('charOver') : null}
					</p>
					<p
						id={FEEDBACK_HUB_SEND_SHORTCUT_HINT_ID}
						className={`mt-2 ${DESKTOP_TYPOGRAPHY.meta} leading-relaxed`}
					>
						{t('sendShortcut')}
					</p>
				</div>
			</div>
		</section>
	);
}
