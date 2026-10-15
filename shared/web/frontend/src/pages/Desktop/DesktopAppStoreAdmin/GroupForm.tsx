/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Create access group modal form (New World tokens; desktop portal z-index preserved).
 *
 * Invariants:
 * - Admin HTTP via `desktopAdminApi`; tab content is self-contained (no marketing AMKA).
 * - Does not import adminChrome class tokens (Wave 3).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useMutation } from '@tanstack/react-query';
import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { notify as toast } from '@/notifications';
import {
	AdminButton,
	AdminField,
	AdminStatusBanner,
	adminUiModalBackdropClass,
	adminUiModalPanelClass,
} from '@/pages/Admin/ui';
import { cn } from '@/utils/cn';

import { useEmbeddedPortaledModalZIndex } from '../context/DesktopWindowPortalStackContext';
import type { AccessGroupCreate } from '../services/desktopAdminApi';
import { createAccessGroup } from '../services/desktopAdminApi';

export function GroupForm({
	onClose,
	onSuccess,
}: {
	onClose: () => void;
	onSuccess: () => void;
}): React.ReactElement {
	const { t } = useTranslation('appStore');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const [form, setForm] = useState<AccessGroupCreate>({
		name: '',
		description: null,
	});
	const createMut = useMutation({
		mutationFn: createAccessGroup,
		onSuccess: () => {
			toast.success(t('admin.toast.groups'), t('admin.toast.groupCreated'));
			onSuccess();
		},
		onError: (err: Error) => toast.error(t('admin.toast.groups'), err.message),
	});
	const gid = useId();
	const groupCreateName = `${gid}-name`;
	const groupCreateDescription = `${gid}-description`;
	const submitErrId = `${gid}-group-create-error`;
	const submitMessage =
		createMut.isError && createMut.error instanceof Error
			? createMut.error.message
			: null;
	const fieldInvalid = Boolean(submitMessage);

	const touchForm = useCallback(
		(next: (prev: AccessGroupCreate) => AccessGroupCreate) => {
			createMut.reset();
			setForm(next);
		},
		[createMut]
	);

	return (
		<div
			className={adminUiModalBackdropClass}
			style={{ zIndex: embeddedModalZ.backdrop }}
		>
			<div
				className={cn(adminUiModalPanelClass, 'relative')}
				style={{ zIndex: embeddedModalZ.content }}
				role="dialog"
				aria-modal="true"
				aria-labelledby={`${gid}-title`}
			>
				<h3
					id={`${gid}-title`}
					className="mb-4 text-lg font-semibold text-[var(--admin-ui-fg)]"
				>
					{t('admin.groups.createTitle')}
				</h3>
				{submitMessage ? (
					<AdminStatusBanner tone="danger" className="mb-3">
						<span id={submitErrId}>
							{t('admin.formError', { message: submitMessage })}
						</span>
					</AdminStatusBanner>
				) : null}
				<div className="space-y-3">
					<label
						htmlFor={groupCreateName}
						className="block text-sm text-[var(--admin-ui-fg-muted)]"
					>
						{t('admin.common.name')}
					</label>
					<AdminField
						id={groupCreateName}
						type="text"
						value={form.name}
						onChange={(e) => touchForm((p) => ({ ...p, name: e.target.value }))}
						aria-describedby={fieldInvalid ? submitErrId : undefined}
					/>
					<label
						htmlFor={groupCreateDescription}
						className="block text-sm text-[var(--admin-ui-fg-muted)]"
					>
						{t('admin.common.description')}
					</label>
					<AdminField
						id={groupCreateDescription}
						type="text"
						value={form.description ?? ''}
						onChange={(e) =>
							touchForm((p) => ({
								...p,
								description: e.target.value || null,
							}))
						}
						aria-describedby={fieldInvalid ? submitErrId : undefined}
					/>
				</div>
				<div className="mt-6 flex gap-2">
					<AdminButton
						variant="primary"
						onClick={() => createMut.mutate(form)}
						disabled={!form.name.trim() || createMut.isPending}
					>
						{createMut.isPending
							? t('admin.common.saving')
							: t('admin.common.create')}
					</AdminButton>
					<AdminButton variant="ghost" onClick={onClose}>
						{t('admin.common.cancel')}
					</AdminButton>
				</div>
			</div>
		</div>
	);
}
