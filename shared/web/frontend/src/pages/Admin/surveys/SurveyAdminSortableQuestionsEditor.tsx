/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Drag-and-drop survey question editor for admin drafts (dnd-kit sortable list).
 */
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core';
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopNativeSelect,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import {
	emptyQuestionDraft,
	type QuestionDraft,
	type QuestionValidationIssue,
} from './surveyAdminEditorUtils';

const QUESTION_TYPES = [
	'single_choice',
	'multi_choice',
	'scale',
	'yes_no',
	'text_short',
	'text_long',
	'nps',
] as const;

const CHOICE_TYPES = new Set(['single_choice', 'multi_choice']);

const INPUT_CLASS = cn(
	'w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
	'bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)',
	'placeholder:text-(--desktop-text-dim)',
	'focus:border-[rgb(var(--desktop-accent-rgb)/0.45)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)]'
);

type Props = {
	questions: QuestionDraft[];
	onChange: (rows: QuestionDraft[]) => void;
	isDraft: boolean;
	editorIssues: QuestionValidationIssue[];
};

function validationMessage(
	t: (key: string) => string,
	code: QuestionValidationIssue['code']
): string {
	return t(`admin.validation.${code}`);
}

type SortableCardProps = {
	row: QuestionDraft;
	idx: number;
	isDraft: boolean;
	issueCodes: QuestionValidationIssue['code'][];
	canRemove: boolean;
	onPatch: (patch: Partial<QuestionDraft>) => void;
	onRemove: () => void;
};

function SortableQuestionCard({
	row,
	idx,
	isDraft,
	issueCodes,
	canRemove,
	onPatch,
	onRemove,
}: SortableCardProps): React.ReactElement {
	const { t } = useTranslation('surveys');
	const hasIssue = issueCodes.length > 0;
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: row.localId,
		disabled: !isDraft,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				'space-y-2 rounded-(--desktop-radius) border p-3',
				isDragging &&
					'z-10 opacity-95 shadow-lg ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.35)]',
				hasIssue
					? 'border-[rgb(var(--desktop-danger-rgb)/0.45)] bg-[rgb(var(--desktop-danger-rgb)/0.06)]'
					: 'border-(--desktop-border-subtle)'
			)}
		>
			<div className="flex items-center gap-2">
				{isDraft ? (
					<button
						type="button"
						className={cn(
							'-m-1 shrink-0 cursor-grab touch-none rounded-md p-2 text-(--desktop-text-muted)',
							'hover:bg-(--desktop-surface-panel) hover:text-(--desktop-text-secondary) active:cursor-grabbing',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.4)]'
						)}
						aria-label={t('admin.dragQuestion')}
						{...attributes}
						{...listeners}
					>
						<Bars3Icon
							className="size-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</button>
				) : null}
				<p className={DESKTOP_TYPOGRAPHY.caption}>
					{t('admin.questionNumber', { number: idx + 1 })}
				</p>
			</div>
			<div className="grid gap-2 sm:grid-cols-2">
				<input
					className={INPUT_CLASS}
					placeholder={t('admin.questionKey')}
					value={row.question_key}
					disabled={!isDraft}
					aria-invalid={
						issueCodes.includes('key') || issueCodes.includes('duplicateKey')
					}
					onChange={(e) => onPatch({ question_key: e.target.value })}
				/>
				<DesktopNativeSelect
					value={row.question_type}
					disabled={!isDraft}
					onChange={(e) => onPatch({ question_type: e.target.value })}
					className="text-sm"
				>
					{QUESTION_TYPES.map((qt) => (
						<option
							key={qt}
							value={qt}
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t(`admin.questionTypes.${qt}`, { defaultValue: qt })}
						</option>
					))}
				</DesktopNativeSelect>
			</div>
			<input
				className={INPUT_CLASS}
				placeholder={t('admin.prompt')}
				value={row.prompt}
				disabled={!isDraft}
				aria-invalid={issueCodes.includes('prompt')}
				onChange={(e) => onPatch({ prompt: e.target.value })}
			/>
			{row.question_type === 'scale' ? (
				<p className={DESKTOP_TYPOGRAPHY.caption}>
					{t('admin.scaleRangeHint')}
				</p>
			) : null}
			{row.question_type === 'nps' ? (
				<p className={DESKTOP_TYPOGRAPHY.caption}>{t('admin.npsRangeHint')}</p>
			) : null}
			{CHOICE_TYPES.has(row.question_type) ? (
				<input
					className={INPUT_CLASS}
					placeholder={t('admin.choices')}
					value={row.choicesText}
					disabled={!isDraft}
					onChange={(e) => onPatch({ choicesText: e.target.value })}
				/>
			) : null}
			<div className="flex flex-wrap items-center gap-3">
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={row.required}
						disabled={!isDraft}
						onChange={(e) => onPatch({ required: e.target.checked })}
					/>
					{t('admin.required')}
				</label>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="ghost"
					disabled={!isDraft || !canRemove}
					onClick={onRemove}
				>
					{t('admin.removeQuestion')}
				</DesktopAppButton>
			</div>
			{hasIssue ? (
				<ul
					className={cn(
						DESKTOP_TYPOGRAPHY.caption,
						'text-[rgb(var(--desktop-danger-rgb))]'
					)}
				>
					{issueCodes.map((code) => (
						<li key={code}>{validationMessage(t, code)}</li>
					))}
				</ul>
			) : null}
		</div>
	);
}

export function SurveyAdminSortableQuestionsEditor({
	questions,
	onChange,
	isDraft,
	editorIssues,
}: Props): React.ReactElement {
	const { t } = useTranslation('surveys');
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const ids = React.useMemo(
		() => questions.map((row) => row.localId),
		[questions]
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = questions.findIndex((row) => row.localId === active.id);
		const newIndex = questions.findIndex((row) => row.localId === over.id);
		if (oldIndex < 0 || newIndex < 0) return;
		onChange(arrayMove(questions, oldIndex, newIndex));
	};

	const patchAt = (idx: number, patch: Partial<QuestionDraft>) => {
		onChange(
			questions.map((row, i) => (i === idx ? { ...row, ...patch } : row))
		);
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<h3 className={DESKTOP_TYPOGRAPHY.subtitle}>{t('admin.questions')}</h3>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					disabled={!isDraft}
					onClick={() =>
						onChange([...questions, emptyQuestionDraft(`new-${Date.now()}`)])
					}
				>
					{t('admin.addQuestion')}
				</DesktopAppButton>
			</div>
			<p className={DESKTOP_TYPOGRAPHY.caption}>{t('admin.dragHint')}</p>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
			>
				<SortableContext items={ids} strategy={verticalListSortingStrategy}>
					<div className="space-y-3">
						{questions.map((row, idx) => {
							const issueCodes = editorIssues
								.filter((issue) => issue.index === idx)
								.map((issue) => issue.code);
							return (
								<SortableQuestionCard
									key={row.localId}
									row={row}
									idx={idx}
									isDraft={isDraft}
									issueCodes={issueCodes}
									canRemove={questions.length > 1}
									onPatch={(patch) => patchAt(idx, patch)}
									onRemove={() =>
										onChange(questions.filter((_, i) => i !== idx))
									}
								/>
							);
						})}
					</div>
				</SortableContext>
			</DndContext>
		</div>
	);
}
