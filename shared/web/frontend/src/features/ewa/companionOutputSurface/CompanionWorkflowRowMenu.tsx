/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact actions menu for a user workflow list row.
 *
 * Invariants:
 * - Menu trigger exposes expanded/controls state; disabled rows cannot open the menu.
 *
 * Related:
 * - CompanionWorkflowEditMode.tsx
 */

import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

type Props = {
	enabled: boolean;
	disabled?: boolean;
	onEdit?: () => void;
	onDuplicate?: () => void;
	onToggleEnabled: () => void;
	onDelete: () => void;
};

export function CompanionWorkflowRowMenu({
	enabled,
	disabled,
	onEdit,
	onDuplicate,
	onToggleEnabled,
	onDelete,
}: Props) {
	const { t } = useTranslation('marketing');
	const [open, setOpen] = useState(false);
	const menuId = useId();
	const triggerId = useId();
	const isDisabled = Boolean(disabled);
	const canEdit = typeof onEdit === 'function';
	const canDuplicate = typeof onDuplicate === 'function';

	return (
		<div className="relative shrink-0">
			<button
				type="button"
				id={triggerId}
				className={cn(
					'inline-flex cursor-pointer items-center justify-center rounded-md',
					'border border-(--companion-divider)/90 bg-(--desktop-surface-soft)/45 p-1.5',
					'hover:border-(--companion-aura)/30 hover:bg-(--companion-bg)/85',
					isDisabled && 'cursor-not-allowed opacity-50',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				aria-label={t('ewaCompanion.userWorkflowEditActionsAria')}
				aria-controls={menuId}
				aria-expanded={open}
				aria-haspopup="menu"
				disabled={isDisabled}
				onClick={() => setOpen((prev) => !prev)}
			>
				<EllipsisVerticalIcon className="size-4 text-(--desktop-text-secondary)" />
			</button>
			{open && !isDisabled ? (
				<div
					id={menuId}
					className={cn(
						'absolute right-0 top-full z-20 mt-1 min-w-38',
						'rounded-lg border border-(--companion-divider)/90',
						'bg-(--companion-bg)/95 py-1 shadow-lg shadow-black/25 backdrop-blur-sm'
					)}
					role="menu"
					aria-labelledby={triggerId}
				>
					{canEdit ? (
						<button
							type="button"
							className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-(--desktop-surface-soft)/50"
							onClick={onEdit}
							role="menuitem"
						>
							{t('ewaCompanion.userWorkflowEditEdit')}
						</button>
					) : null}
					{canDuplicate ? (
						<button
							type="button"
							className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-(--desktop-surface-soft)/50"
							onClick={onDuplicate}
							role="menuitem"
						>
							{t('ewaCompanion.userWorkflowEditDuplicate')}
						</button>
					) : null}
					<button
						type="button"
						className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-(--desktop-surface-soft)/50"
						onClick={onToggleEnabled}
						role="menuitem"
					>
						{enabled
							? t('ewaCompanion.userWorkflowEditDisable')
							: t('ewaCompanion.userWorkflowEditEnable')}
					</button>
					<button
						type="button"
						className="block w-full px-3 py-1.5 text-left text-[12px] text-rose-200 hover:bg-rose-500/10"
						onClick={onDelete}
						role="menuitem"
					>
						{t('ewaCompanion.userWorkflowEditDelete')}
					</button>
				</div>
			) : null}
		</div>
	);
}
