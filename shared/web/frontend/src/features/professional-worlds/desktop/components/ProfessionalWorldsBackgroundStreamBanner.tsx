/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Surfaces muted AI/stream activity happening on Professional Worlds lanes while the operator is on another main tab.
 *
 * Invariants:
 * - Caller supplies translated `jumpLabel` / `hint`; banner never hardcodes UX copy per locale.
 *
 * Related:
 * - hooks/useProfessionalWorldsAiStreams.ts
 * - ProfessionalWorldsApp.tsx
 */

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import type { AiStreamLaneState } from '../hooks/useProfessionalWorldsAiStreams';

export type BackgroundStreamPeek = {
	laneLabel: string;
	preview: string;
	hint?: string | null;
	jumpLabel: string;
	onJump: () => void;
};

function laneHasSignal(lane: AiStreamLaneState): boolean {
	return Boolean(lane.text.trim() || lane.status.trim());
}

export function ProfessionalWorldsBackgroundStreamBanner({
	activePeek,
}: {
	activePeek: BackgroundStreamPeek | null;
}) {
	if (!activePeek) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-xs text-(--desktop-text-secondary)">
			<div className="min-w-0 flex-1">
				<strong className="block text-[11px] uppercase tracking-wide text-(--desktop-text-muted)">
					{activePeek.laneLabel}
				</strong>
				<span className="wrap-break-word text-(--desktop-text-primary)">
					{activePeek.preview}
				</span>
				{activePeek.hint ? (
					<span className="mt-1 block text-[11px] text-(--desktop-text-muted)">
						{activePeek.hint}
					</span>
				) : null}
			</div>
			<DesktopAppButton
				className="shrink-0"
				size="sm"
				onClick={activePeek.onJump}
			>
				{activePeek.jumpLabel}
			</DesktopAppButton>
		</div>
	);
}

export function mergeLanePreview(lane: AiStreamLaneState): string {
	const body = lane.text.trim();
	const status = lane.status.trim();
	if (body && status) {
		return `${status} — ${body.slice(0, 160)}${body.length > 160 ? '…' : ''}`;
	}
	if (body) return body.slice(0, 200) + (body.length > 200 ? '…' : '');
	return status;
}

export { laneHasSignal };
