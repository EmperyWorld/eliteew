/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual line gutter for Ultimate Doc Editor — block numbers, wrap continuations,
 * and collaboration cursor highlights aligned to measured visual rows.
 *
 * Invariants:
 * - Collab highlight applies only on first visual row of a block (not wrap ↳ rows).
 * - data-gutter-track height follows gutter layout hook output.
 *
 * Related:
 * - TiptapEditor.tsx, useTiptapGutterLayout.ts, tiptapGutterMeasure.ts
 */
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ULTIMATE_DOC_EDITOR_NS } from '../../../i18n/config';
import { cn } from '../../../utils/cn';
import type { CollaboratorInfo } from '../types/editor.types';
import type { VisualLineMetric } from './tiptapGutterMeasure';

export interface TiptapLineGutterProps {
	visualLines: VisualLineMetric[];
	gutterHeight: number;
	gutterTrackTransitionEnabled: boolean;
	activeCollaborators: CollaboratorInfo[];
}

export const TiptapLineGutter: React.FC<TiptapLineGutterProps> = ({
	visualLines,
	gutterHeight,
	gutterTrackTransitionEnabled,
	activeCollaborators,
}) => {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);

	return (
		<div
			className="relative w-10 shrink-0 select-none border-r border-(--desktop-border-subtle) bg-(--desktop-surface-soft) font-mono text-sm text-(--desktop-text-dim) motion-reduce:transition-none"
			aria-hidden
		>
			<div
				data-gutter-track
				className={cn(
					'relative',
					gutterTrackTransitionEnabled &&
						'transition-[height] duration-150 ease-out motion-reduce:transition-none'
				)}
				style={{ height: gutterHeight }}
			>
				{visualLines.map((entry) => {
					const lineNum = entry.lineNumber;
					const onLine = activeCollaborators.filter(
						(c) =>
							!entry.isWrapContinuation &&
							c.cursor_position &&
							(c.cursor_position as { line?: number }).line === lineNum
					);
					const first = onLine[0];
					const color = first?.color?.trim() || '#3b82f6';
					const safeColor = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#3b82f6';
					const title =
						onLine.length > 0
							? onLine
									.map((c) =>
										t('gutter.collabEditing', {
											name:
												c.username || c.email || t('collabRemoteUserFallback'),
										})
									)
									.join(', ')
							: undefined;

					return (
						<div
							key={`${lineNum}-${entry.top}-${entry.isWrapContinuation ? 'w' : 'b'}`}
							className={cn(
								'absolute left-0 right-0 rounded-r pr-2 text-right transition-colors duration-150 ease-out motion-reduce:transition-none',
								entry.isWrapContinuation &&
									'text-[0.95rem] text-(--desktop-text-dim) opacity-75'
							)}
							style={{
								top: entry.top,
								height: entry.height,
								lineHeight: `${entry.height}px`,
								...(onLine.length > 0
									? {
											backgroundColor: `${safeColor}18`,
											borderLeft: `3px solid ${safeColor}`,
											marginLeft: '-3px',
											color: safeColor,
										}
									: undefined),
							}}
							title={title}
						>
							{entry.isWrapContinuation ? (
								<span aria-hidden title={t('gutter.lineWrapTitle')}>
									↳
								</span>
							) : (
								lineNum
							)}
							{onLine.length > 1 && (
								<span
									className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5"
									title={title}
								>
									{onLine.slice(0, 3).map((c) => {
										const ccolor =
											c.color?.trim() && /^#[0-9A-Fa-f]{6}$/.test(c.color)
												? c.color
												: '#3b82f6';
										return (
											<span
												key={c.user_id}
												className="h-1.5 w-1.5 shrink-0 rounded-full"
												style={{ backgroundColor: ccolor }}
											/>
										);
									})}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};
