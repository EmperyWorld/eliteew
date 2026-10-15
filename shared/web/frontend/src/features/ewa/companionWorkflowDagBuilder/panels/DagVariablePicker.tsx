/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Popover tree for inserting ``{{node_id.field}}`` placeholders into DAG fields.
 *
 * Related:
 * - buildVariablePickerTree.ts
 */

import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { buildVariablePickerTree } from '@/features/ewa/companionWorkflowDagBuilder/graph/buildVariablePickerTree';
import { COMPANION_DAG_BUILDER_POPOVER_CLASS } from '@/features/ewa/companionWorkflowDagBuilder/dagBuilderUi';
import { useDagBuilderEditor } from '@/features/ewa/companionWorkflowDagBuilder/state/DagBuilderEditorContext';
import { cn } from '@/utils/cn';

type Props = {
	onInsert: (template: string) => void;
	targetNodeId: string;
};

export function DagVariablePicker({ onInsert, targetNodeId }: Props) {
	const { i18n } = useTranslation();
	const isRu = i18n.language.startsWith('ru');
	const { pickerSession, closePicker, nodes, edges } = useDagBuilderEditor();
	const panelRef = useRef<HTMLDivElement>(null);

	const tree = useMemo(
		() =>
			buildVariablePickerTree({
				nodes,
				edges,
				targetNodeId,
				isRu,
			}),
		[nodes, edges, targetNodeId, isRu]
	);

	useEffect(() => {
		if (!pickerSession) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closePicker();
		};
		const onPointerDown = (event: MouseEvent) => {
			if (!panelRef.current?.contains(event.target as Node)) {
				closePicker();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('mousedown', onPointerDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('mousedown', onPointerDown);
		};
	}, [pickerSession, closePicker]);

	if (!pickerSession) return null;

	const rect = pickerSession.anchorRect;
	const style = rect
		? {
				top: rect.bottom + 6,
				left: rect.left,
				minWidth: Math.max(rect.width, 280),
			}
		: { top: '20%', left: '50%', transform: 'translateX(-50%)', minWidth: 280 };

	return (
		<div
			ref={panelRef}
			className={cn(
				COMPANION_DAG_BUILDER_POPOVER_CLASS,
				'fixed z-50 max-h-72 overflow-y-auto'
			)}
			style={style}
			role="dialog"
			aria-label={isRu ? 'Вставить переменную' : 'Insert variable'}
		>
			<div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-(--companion-text-soft)">
				{isRu ? 'Вставить переменную' : 'Insert variable'}
			</div>
			<div className="flex flex-col gap-2">
				{tree.groups.map((group) => (
					<div key={group.id}>
						<div className="mb-1 text-[10px] font-medium uppercase text-(--companion-aura)/90">
							{group.label}
						</div>
						<ul className="flex flex-col gap-0.5">
							{group.children.map((leaf) => (
								<li key={leaf.id}>
									<button
										type="button"
										className={cn(
											'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left',
											'hover:bg-(--desktop-surface-soft) border border-transparent hover:border-(--companion-divider)'
										)}
										onClick={() => {
											onInsert(leaf.template);
											closePicker();
										}}
									>
										<span className="text-xs text-(--companion-text-primary)">
											{leaf.label}
										</span>
										<code className="truncate text-[10px] text-(--companion-text-soft)">
											{leaf.template}
										</code>
									</button>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</div>
	);
}
