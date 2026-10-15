/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Editorial vertical roadmap timeline — replaces Mermaid Gantt rectangles in
 * Desktop AI Chat and Kursorina report.
 *
 * Invariants:
 * - Display-only; no Mermaid SVG.
 * - Caller must pass a non-empty ParsedGantt.
 *
 * Related:
 * - parseMermaidGantt.ts
 * - DesktopAiChatMarkdown.mermaid.tsx
 */

import type { ReactElement } from 'react';
import { cn } from '@/utils/cn';
import {
	formatGanttDuration,
	formatGanttWhen,
	type ParsedGantt,
} from './parseMermaidGantt';

export function RoadmapTimeline({
	data,
	density = 'comfortable',
}: {
	data: ParsedGantt;
	/** `compact` for chat bubbles; `comfortable` for long-read reports. */
	density?: 'compact' | 'comfortable';
}): ReactElement {
	const cozy = density === 'comfortable';
	return (
		<figure
			className={cn('min-w-0 max-w-full', cozy ? 'my-5' : 'my-2.5')}
			aria-label={data.title || 'Дорожная карта'}
			data-roadmap-timeline="1"
			data-density={density}
		>
			{data.title ? (
				<figcaption
					className={cn(
						'font-semibold tracking-tight text-(--desktop-text-primary)',
						cozy ? 'mb-3 text-sm' : 'mb-2 text-xs'
					)}
				>
					{data.title}
				</figcaption>
			) : null}
			<ol className="relative m-0 list-none space-y-0 p-0">
				<div
					aria-hidden
					className="pointer-events-none absolute bottom-2 left-[0.6875rem] top-2 w-px bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.45)_100%,var(--desktop-border-subtle))]"
				/>
				{data.tasks.map((task, index) => {
					const when = formatGanttWhen(task.when);
					const dur = task.duration ? formatGanttDuration(task.duration) : '';
					const meta = [when, dur].filter(Boolean).join(' · ');
					return (
						<li
							key={`${task.section}:${task.id}:${task.name}`}
							className={cn(
								'relative flex gap-3 last:pb-0',
								cozy ? 'pb-5' : 'pb-3.5'
							)}
						>
							<span
								aria-hidden
								className={cn(
									'relative z-1 mt-1 flex size-[1.375rem] shrink-0 items-center justify-center',
									'rounded-full border border-[rgb(var(--desktop-accent-rgb)/0.45)]',
									'bg-(--desktop-surface-panel-strong) text-[10px] font-semibold',
									'text-[rgb(var(--desktop-accent-rgb))]'
								)}
							>
								{index + 1}
							</span>
							<div className="min-w-0 flex-1 pt-0.5">
								<p className="m-0 text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-dim)">
									{task.section}
								</p>
								<p
									className={cn(
										'm-0 mt-0.5 font-medium leading-snug text-(--desktop-text-primary)',
										cozy ? 'text-sm' : 'text-xs'
									)}
								>
									{task.name}
								</p>
								{meta ? (
									<p className="m-0 mt-1 text-xs leading-snug text-(--desktop-text-secondary)">
										{meta}
									</p>
								) : null}
							</div>
						</li>
					);
				})}
			</ol>
		</figure>
	);
}

/** @deprecated Prefer RoadmapTimeline — alias for older Kursorina imports. */
export const KursorinaRoadmapTimeline = RoadmapTimeline;
