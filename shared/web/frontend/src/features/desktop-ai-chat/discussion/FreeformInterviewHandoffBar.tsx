/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * «Пройти интервью» above freeform (non-blueprint) assistant cards with topic/goal.
 *
 * Invariants:
 * - Same CTA visibility as blueprint header (`canShowInterviewHandoffCta`).
 * - Never auto-starts Discussion; click only.
 *
 * Related:
 * - ./interviewHandoff.ts
 * - ./DesktopAiInterviewHandoffStartButton.tsx
 * - ../components/messagesPane/DesktopAiChatMessageRow.tsx
 */
import type { TFunction } from 'i18next';

import type { DesktopAiMessage } from '../api/desktopChatClient';
import { DesktopAiInterviewHandoffStartButton } from './DesktopAiInterviewHandoffStartButton';
import { canShowInterviewHandoffCta } from './interviewHandoff';

export function FreeformInterviewHandoffBar({
	message,
	onStartInterviewFromMessage,
	interviewStartBusy,
	t,
}: {
	message: DesktopAiMessage;
	onStartInterviewFromMessage?: (m: DesktopAiMessage) => void | Promise<void>;
	interviewStartBusy: boolean;
	t: TFunction<'desktopAiChat'>;
}) {
	const canTake = canShowInterviewHandoffCta(message, {
		hasStartHandler: Boolean(onStartInterviewFromMessage),
	});
	if (!canTake || !onStartInterviewFromMessage) return null;
	return (
		<div
			className="mb-2 flex flex-wrap items-center justify-end gap-1.5"
			data-testid="freeform-interview-handoff-bar"
		>
			<DesktopAiInterviewHandoffStartButton
				busy={interviewStartBusy}
				onClick={() => void onStartInterviewFromMessage(message)}
				t={t}
			/>
		</div>
	);
}
