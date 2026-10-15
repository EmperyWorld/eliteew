/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline edit form for a single assistant FAQ entry in admin.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - pages/Admin/assistant/AssistantFaqPanel.tsx
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { AssistantFaqEntry } from '../../Desktop/services/productDesktopApi';
import { ADMIN_FIELD, ADMIN_FIELD_SM } from './assistantAdminStyles';

export function EditFaq({
	entry,
	onCancel,
	onSave,
	saving,
}: {
	entry: AssistantFaqEntry;
	onCancel: () => void;
	onSave: (patch: Partial<AssistantFaqEntry>) => void;
	saving: boolean;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'assistantAdmin' });
	const [question, setQuestion] = React.useState(entry.question);
	const [answer, setAnswer] = React.useState(entry.answer);
	const [sortOrder, setSortOrder] = React.useState(entry.sort_order);

	return (
		<div className="space-y-2 w-full">
			<input
				type="text"
				value={question}
				onChange={(e) => setQuestion(e.target.value)}
				aria-label={t('questionPlaceholder')}
				className={cn('w-full', ADMIN_FIELD)}
			/>
			<textarea
				value={answer}
				onChange={(e) => setAnswer(e.target.value)}
				rows={4}
				aria-label={t('answerPlaceholder')}
				className={cn('w-full', ADMIN_FIELD)}
			/>
			<input
				type="number"
				value={sortOrder}
				onChange={(e) => setSortOrder(Number.parseInt(e.target.value, 10) || 0)}
				aria-label={t('sortOrderLabel')}
				className={cn('w-32', ADMIN_FIELD_SM)}
			/>
			<div className="flex gap-2">
				<button
					type="button"
					disabled={saving}
					onClick={() =>
						onSave({
							question: question.trim(),
							answer: answer.trim(),
							sort_order: sortOrder,
						})
					}
					className="px-3 py-1.5 text-sm bg-emerald-700/80 rounded-lg text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45"
				>
					{t('save')}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="text-sm text-white/70 rounded-md px-2 py-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
				>
					{t('cancel')}
				</button>
			</div>
		</div>
	);
}
