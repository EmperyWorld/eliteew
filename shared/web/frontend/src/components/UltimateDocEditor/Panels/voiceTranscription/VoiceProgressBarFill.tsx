/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Recording level progress bar fill for VoiceTranscriptionPanel record tab.
 *
 * Invariants:
 * - Width applied via ref + useLayoutEffect to avoid layout thrash during animation.
 *
 * Related:
 * - VoiceTranscriptionRecordTab.tsx
 */

import { useLayoutEffect, useRef } from 'react';

export function VoiceProgressBarFill({
	widthPct,
	isRecording,
}: {
	widthPct: number;
	isRecording: boolean;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.width = `${isRecording ? widthPct * 100 : 0}%`;
	}, [widthPct, isRecording]);
	return (
		<div
			ref={ref}
			className={`h-full transition-all duration-100 ${
				isRecording
					? 'bg-linear-to-r from-[rgb(var(--desktop-accent-rgb))] to-red-500'
					: 'bg-(--desktop-border-strong)'
			}`}
		/>
	);
}
