/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * «Мои фразы» list: drag reorder (U2.2), duplicate (U2.3), icon picker (U2.4).
 *
 * Related:
 * - src/features/ewa/ewaCompanionQuickPresetsUi.ts
 * - documentation/product/ewa/EWA-COMPANION-USER-UX-MAP.md §U2
 */

import {
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
	Bars3Icon,
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
	buildCompanionMyPhrasesExportPayload,
	triggerCompanionMyPhrasesExportDownload,
} from '@/features/ewa/companionOutputSurface/companionMyPhrasesExport';
import { CompanionSurfacePanel } from '@/features/ewa/companionOutputSurface/CompanionSurfacePanel';
import {
	COMPANION_MY_PHRASE_ICON_OPTIONS,
	type MyPhraseIconOverride,
} from '@/features/ewa/companionOutputSurface/companionMyPhraseIconsStorage';
import {
	type CompanionQuickPresetVisual,
	companionQuickPresetVisual,
} from '@/features/ewa/companionQuickPresetIcons';
import {
	type CompanionQuickPresetChip,
	isCompanionQuickPresetDeletable,
} from '@/features/ewa/ewaCompanionQuickPresetsUi';
import { EwaIcon } from '@/features/ewa/ewaIcons/EwaIcon';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionMyPhrasesModeProps = {
	presets: CompanionQuickPresetChip[];
	phraseIconOverrides: ReadonlyMap<string, MyPhraseIconOverride>;
	busy?: boolean;
	onBackToChat: () => void;
	onApply: (preset: CompanionQuickPresetChip) => void;
	onRename: (preset: CompanionQuickPresetChip) => void;
	onDelete: (preset: CompanionQuickPresetChip) => void;
	onDuplicate: (preset: CompanionQuickPresetChip) => void;
	onReorder: (ordered: CompanionQuickPresetChip[]) => void;
	onIconChange: (presetId: string, visual: MyPhraseIconOverride) => void;
	onExportSuccess?: () => void;
	onExportFailed?: () => void;
	onImportFile?: (file: File) => void | Promise<void>;
};

function resolvePhraseVisual(
	preset: CompanionQuickPresetChip,
	overrides: ReadonlyMap<string, MyPhraseIconOverride>
): CompanionQuickPresetVisual {
	return companionQuickPresetVisual(
		preset.id,
		overrides.get(preset.id) ?? null
	);
}

function MyPhraseIconPicker({
	open,
	current,
	onSelect,
	onClose,
}: {
	open: boolean;
	current: CompanionQuickPresetVisual;
	onSelect: (visual: MyPhraseIconOverride) => void;
	onClose: () => void;
}) {
	const { t } = useTranslation('marketing');
	if (!open) return null;
	return (
		<div
			className={cn(
				'mt-2 grid grid-cols-6 gap-1 rounded-lg border border-(--companion-divider)/70',
				'bg-(--desktop-surface-soft)/30 p-2'
			)}
			role="listbox"
			aria-label={t('ewaCompanion.myPhrases.iconPickerAria')}
		>
			{COMPANION_MY_PHRASE_ICON_OPTIONS.map((option) => {
				const selected =
					option.icon === current.icon && option.tone === current.tone;
				return (
					<button
						key={`${option.icon}-${option.tone}`}
						type="button"
						role="option"
						aria-selected={selected}
						className={cn(
							'flex items-center justify-center rounded-md p-1.5',
							'hover:bg-white/10',
							selected && 'ring-1 ring-(--companion-aura)',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						onClick={() => {
							onSelect(option);
							onClose();
						}}
					>
						<EwaIcon name={option.icon} size="xs" tone={option.tone} />
					</button>
				);
			})}
		</div>
	);
}

function SortableMyPhraseRow({
	preset,
	visual,
	busy,
	iconPickerOpen,
	onToggleIconPicker,
	onApply,
	onRename,
	onDelete,
	onDuplicate,
	onIconChange,
}: {
	preset: CompanionQuickPresetChip;
	visual: CompanionQuickPresetVisual;
	busy: boolean;
	iconPickerOpen: boolean;
	onToggleIconPicker: () => void;
	onApply: () => void;
	onRename: () => void;
	onDelete: () => void;
	onDuplicate: () => void;
	onIconChange: (visual: MyPhraseIconOverride) => void;
}) {
	const { t } = useTranslation('marketing');
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: preset.id, disabled: busy });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<li
			ref={setNodeRef}
			style={style}
			className={cn(
				'rounded-lg border border-(--companion-divider)/80',
				'bg-(--desktop-surface-soft)/20 px-3 py-2.5',
				isDragging && 'opacity-80 shadow-md'
			)}
		>
			<div className="flex items-start gap-2">
				<button
					type="button"
					className={cn(
						'mt-0.5 shrink-0 rounded p-1 text-(--companion-text-soft)',
						'hover:bg-white/8 cursor-grab active:cursor-grabbing',
						busy && 'pointer-events-none opacity-40',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					aria-label={t('ewaCompanion.myPhrases.dragHandleAria', {
						label: preset.label,
					})}
					{...attributes}
					{...listeners}
				>
					<Bars3Icon className="size-4" aria-hidden />
				</button>
				<button
					type="button"
					className={cn(
						'mt-0.5 shrink-0 rounded-full p-0.5',
						'hover:bg-white/8',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
					aria-label={t('ewaCompanion.myPhrases.changeIconAria', {
						label: preset.label,
					})}
					title={t('ewaCompanion.myPhrases.changeIcon')}
					disabled={busy}
					onClick={onToggleIconPicker}
				>
					<EwaIcon
						name={visual.icon}
						size="sm"
						tone={visual.tone}
						className="shrink-0"
					/>
				</button>
				<div className="min-w-0 flex-1">
					<p className="text-[13px] font-medium text-(--desktop-text-primary)">
						{preset.label}
					</p>
					<p className="mt-1 text-[11px] leading-snug text-(--companion-text-soft)">
						{preset.promptText}
					</p>
				</div>
			</div>
			<MyPhraseIconPicker
				open={iconPickerOpen}
				current={visual}
				onSelect={onIconChange}
				onClose={onToggleIconPicker}
			/>
			<div className="mt-2 flex flex-wrap gap-2">
				<DesktopAppButton
					type="button"
					variant="accent"
					size="sm"
					disabled={busy}
					onClick={onApply}
				>
					{t('ewaCompanion.myPhrases.apply')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					disabled={busy}
					onClick={onDuplicate}
				>
					{t('ewaCompanion.myPhrases.duplicate')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					disabled={busy}
					onClick={onRename}
				>
					{t('ewaCompanion.quickPresetRename')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					disabled={busy}
					onClick={onDelete}
				>
					{t('ewaCompanion.quickPresetDelete')}
				</DesktopAppButton>
			</div>
		</li>
	);
}

export function CompanionMyPhrasesMode({
	presets,
	phraseIconOverrides,
	busy = false,
	onBackToChat,
	onApply,
	onRename,
	onDelete,
	onDuplicate,
	onReorder,
	onIconChange,
	onExportSuccess,
	onExportFailed,
	onImportFile,
}: CompanionMyPhrasesModeProps) {
	const { t } = useTranslation('marketing');
	const importInputRef = useRef<HTMLInputElement | null>(null);
	const [iconPickerPresetId, setIconPickerPresetId] = useState<string | null>(
		null
	);

	const userPresets = useMemo(
		() =>
			presets
				.filter((row) => isCompanionQuickPresetDeletable(row))
				.sort((a, b) => a.sortOrder - b.sortOrder),
		[presets]
	);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id || busy) return;
		const oldIndex = userPresets.findIndex((row) => row.id === active.id);
		const newIndex = userPresets.findIndex((row) => row.id === over.id);
		if (oldIndex < 0 || newIndex < 0) return;
		onReorder(arrayMove(userPresets, oldIndex, newIndex));
	};

	const handleExport = () => {
		if (busy || userPresets.length === 0) return;
		try {
			const payload = buildCompanionMyPhrasesExportPayload(
				userPresets,
				phraseIconOverrides
			);
			triggerCompanionMyPhrasesExportDownload(payload);
			onExportSuccess?.();
		} catch {
			onExportFailed?.();
		}
	};

	const handleImportClick = () => {
		if (busy || !onImportFile) return;
		importInputRef.current?.click();
	};

	const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file || busy || !onImportFile) return;
		void onImportFile(file);
	};

	return (
		<CompanionSurfacePanel
			title={t('ewaCompanion.myPhrases.title')}
			subtitle={t('ewaCompanion.myPhrases.subtitle', {
				count: userPresets.length,
			})}
			onBack={onBackToChat}
			backLabel={t('ewaCompanion.outputSurfaceBackToChat')}
			testId="ewa-companion-my-phrases"
			headerActions={
				onImportFile || userPresets.length > 0 ? (
					<div className="flex items-center gap-1">
						{onImportFile ? (
							<>
								<input
									ref={importInputRef}
									type="file"
									accept="application/json,.json"
									className="sr-only"
									tabIndex={-1}
									aria-hidden
									onChange={handleImportFileChange}
									data-testid="ewa-companion-my-phrases-import-input"
								/>
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									disabled={busy}
									onClick={handleImportClick}
									aria-label={t('ewaCompanion.myPhrases.importAria')}
									data-testid="ewa-companion-my-phrases-import"
								>
									<ArrowUpTrayIcon className="size-3.5" aria-hidden />
									<span className="sr-only">
										{t('ewaCompanion.myPhrases.import')}
									</span>
								</DesktopAppButton>
							</>
						) : null}
						{userPresets.length > 0 ? (
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								disabled={busy}
								onClick={handleExport}
								aria-label={t('ewaCompanion.myPhrases.exportAria')}
								data-testid="ewa-companion-my-phrases-export"
							>
								<ArrowDownTrayIcon className="size-3.5" aria-hidden />
								<span className="sr-only">
									{t('ewaCompanion.myPhrases.export')}
								</span>
							</DesktopAppButton>
						) : null}
					</div>
				) : null
			}
		>
			{userPresets.length === 0 ? (
				<p className="py-8 text-center text-[12px] text-(--companion-text-soft)">
					{t('ewaCompanion.myPhrases.empty')}
				</p>
			) : (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={userPresets.map((row) => row.id)}
						strategy={verticalListSortingStrategy}
					>
						<ul className="flex flex-col gap-2 pb-2">
							{userPresets.map((preset) => (
								<SortableMyPhraseRow
									key={preset.id}
									preset={preset}
									visual={resolvePhraseVisual(preset, phraseIconOverrides)}
									busy={busy}
									iconPickerOpen={iconPickerPresetId === preset.id}
									onToggleIconPicker={() =>
										setIconPickerPresetId((current) =>
											current === preset.id ? null : preset.id
										)
									}
									onApply={() => onApply(preset)}
									onRename={() => onRename(preset)}
									onDelete={() => onDelete(preset)}
									onDuplicate={() => onDuplicate(preset)}
									onIconChange={(visual) => onIconChange(preset.id, visual)}
								/>
							))}
						</ul>
					</SortableContext>
				</DndContext>
			)}
		</CompanionSurfacePanel>
	);
}
