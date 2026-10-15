/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Todos widget slot body with compact summary and local-only banners.
 *
 * Invariants:
 * - Data from useWidgetTodos hook only.
 *
 * Related:
 * - useWidgetNotesTodos.ts
 */

import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { useWidgetTodos } from '../../hooks/useWidgetNotesTodos';

export function TodosSlotBody({ compact }: { compact: boolean }) {
	const { t } = useTranslation('desktopUi');
	const { t: tWorkspace } = useTranslation('desktopUi', {
		keyPrefix: 'workspace',
	});
	const { todos, isLoading, isLocalOnly, storageWriteFailed } =
		useWidgetTodos();

	const localOnlyBanner = isLocalOnly ? (
		<p
			className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-(--desktop-text-dim)')}
			data-local-only="true"
		>
			{tWorkspace('localOnlyHint')}
		</p>
	) : null;
	const storageFailedBanner = storageWriteFailed ? (
		<p
			className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-(--desktop-text-dim)')}
			role="alert"
		>
			{tWorkspace('localStorageWriteFailed')}
		</p>
	) : null;

	if (isLoading && todos.length === 0) {
		return (
			<div
				className="flex flex-col gap-1.5"
				data-local-only={isLocalOnly ? 'true' : undefined}
			>
				{localOnlyBanner}
				{storageFailedBanner}
				<p className={DESKTOP_TYPOGRAPHY.caption}>
					{t('settingsPanel.widgetsPanel.loading')}
				</p>
			</div>
		);
	}
	const open = todos.filter((x) => !x.completed).length;
	if (todos.length === 0) {
		return (
			<div
				className="flex flex-col gap-1.5"
				data-local-only={isLocalOnly ? 'true' : undefined}
			>
				{localOnlyBanner}
				{storageFailedBanner}
				<p className={DESKTOP_TYPOGRAPHY.caption}>
					{t('settingsPanel.widgetsPanel.todosEmpty')}
				</p>
			</div>
		);
	}
	if (compact) {
		return (
			<div
				className="flex flex-col gap-1.5"
				data-local-only={isLocalOnly ? 'true' : undefined}
			>
				{localOnlyBanner}
				{storageFailedBanner}
				<p className={DESKTOP_TYPOGRAPHY.caption}>
					{t('settingsPanel.widgetsPanel.todosSummary', {
						open,
						total: todos.length,
					})}
				</p>
			</div>
		);
	}
	return (
		<div
			className="flex flex-col gap-1.5"
			data-local-only={isLocalOnly ? 'true' : undefined}
		>
			{localOnlyBanner}
			{storageFailedBanner}
			<ul className="max-h-40 space-y-1 overflow-y-auto pr-0.5">
				{todos.slice(0, 8).map((td) => (
					<li
						key={td.id}
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'flex items-start gap-2 rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1 text-(--desktop-text-secondary)',
							td.completed && 'opacity-60 line-through'
						)}
					>
						<span className="min-w-0 flex-1 wrap-break-word">{td.text}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
