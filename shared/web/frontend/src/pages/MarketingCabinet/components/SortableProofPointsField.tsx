import { useMemo, useState } from 'react';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import { parseMultilineList } from '../utils';

const TEXTAREA_CLASS =
	'min-h-[112px] w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2.5 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) outline-none transition-colors focus:border-(--desktop-border-strong) focus:ring-1 focus:ring-(--mc-accent-30)';

interface SortableProofPointsFieldProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
}

function SortableItem({
	id,
	text,
	disabled,
}: {
	id: string;
	text: string;
	disabled?: boolean;
}) {
	const { t } = useTranslation('marketing');
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id,
		disabled,
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
				'flex items-center gap-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3.5 py-2.5 text-sm shadow-sm',
				isDragging &&
					'z-10 border-(--desktop-border-strong) opacity-95 shadow-lg ring-1 ring-(--mc-accent-22)'
			)}
		>
			{!disabled && (
				<button
					type="button"
					className={cn(
						'-m-1 shrink-0 cursor-grab touch-none rounded-md p-2 text-(--desktop-text-muted) transition-[color,background-color] hover:bg-(--desktop-surface-panel) hover:text-(--desktop-text-secondary) active:cursor-grabbing',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--mc-accent-40) focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-soft)'
					)}
					aria-label={t('sortableProofPoints.dragAria')}
					{...attributes}
					{...listeners}
				>
					<Bars3Icon
						className="h-4 w-4 rotate-90"
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
				</button>
			)}
			<span className="min-w-0 flex-1 leading-snug text-(--desktop-text-primary)">
				{text}
			</span>
		</div>
	);
}

export function SortableProofPointsField({
	value,
	onChange,
	placeholder,
	disabled,
}: SortableProofPointsFieldProps) {
	const { t } = useTranslation('marketing');
	const items = useMemo(() => parseMultilineList(value), [value]);
	const [showSortable, setShowSortable] = useState(items.length > 1);
	const resolvedPlaceholder =
		placeholder ?? t('sortableProofPoints.placeholder');

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = items.findIndex(
			(_, i) => `${i}-${items[i]}` === active.id
		);
		const newIndex = items.findIndex((_, i) => `${i}-${items[i]}` === over.id);
		if (oldIndex === -1 || newIndex === -1) return;

		const reordered = arrayMove(items, oldIndex, newIndex);
		onChange(reordered.join('\n'));
	};

	const itemIds = useMemo(
		() => items.map((item, i) => `${i}-${item}`),
		[items]
	);

	if (items.length > 1 && showSortable) {
		return (
			<div className="space-y-2.5">
				<div className="flex items-start justify-between gap-3">
					<span className="min-w-0 pt-0.5 text-xs font-medium leading-snug tracking-wide text-(--desktop-text-secondary)">
						{t('sortableProofPoints.reorderHint', { count: items.length })}
					</span>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => setShowSortable(false)}
						aria-label={t('sortableProofPoints.editAsTextAria')}
					>
						{t('sortableProofPoints.editAsText')}
					</DesktopAppButton>
				</div>
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={itemIds}
						strategy={verticalListSortingStrategy}
					>
						<div className="space-y-2.5">
							{items.map((item, i) => (
								<SortableItem
									key={itemIds[i]}
									id={itemIds[i]}
									text={item}
									disabled={disabled}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			</div>
		);
	}

	return (
		<div className="space-y-2.5">
			<textarea
				className={TEXTAREA_CLASS}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={resolvedPlaceholder}
				disabled={disabled}
			/>
			{items.length > 1 && (
				<DesktopAppButton
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => setShowSortable(true)}
					aria-label={t('sortableProofPoints.enableSortingAria')}
				>
					{t('sortableProofPoints.enableSorting', { count: items.length })}
				</DesktopAppButton>
			)}
		</div>
	);
}
