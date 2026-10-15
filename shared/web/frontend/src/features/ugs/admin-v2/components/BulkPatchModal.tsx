/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Small reusable modal for building safe bulk patch operations in UGS Admin v2.
 *
 * Invariants:
 * - Does not apply changes directly; it only produces operations for validate/apply flow.
 *
 * Related:
 * - src/features/ugs/admin-v2/tabs/ProvidersTabV2.tsx
 * - src/features/ugs/admin-v2/tabs/TypesTabV2.tsx
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, InputField, Modal } from '@/features/ugs/shared/ugsAdminUi';
import { UGS_ADMIN_V2_NS } from '@/i18n/namespaces';

export function BulkPatchModal({
	open,
	title,
	subtitle,
	onClose,
	onConfirm,
	confirmLabel,
	children,
}: {
	open: boolean;
	title: string;
	subtitle?: string;
	onClose: () => void;
	onConfirm: () => void;
	confirmLabel?: string;
	children: React.ReactNode;
}): React.ReactElement {
	const { t } = useTranslation(UGS_ADMIN_V2_NS);
	const resolvedConfirmLabel = confirmLabel ?? t('common.generateChanges');

	return (
		<Modal open={open} title={title} onClose={onClose} size="lg">
			<div className="space-y-4">
				{subtitle ? (
					<p className="text-(--desktop-text-muted)">{subtitle}</p>
				) : null}
				{children}
				<div className="flex flex-wrap gap-3 pt-2">
					<Button variant="secondary" onClick={onClose}>
						{t('common.cancel')}
					</Button>
					<Button onClick={onConfirm}>{resolvedConfirmLabel}</Button>
				</div>
			</div>
		</Modal>
	);
}

export function NumberInputField({
	label,
	value,
	onChange,
	placeholder,
	hint,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	hint?: string;
}): React.ReactElement {
	return (
		<InputField
			label={label}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			placeholder={placeholder}
			hint={hint}
			inputMode="numeric"
		/>
	);
}
