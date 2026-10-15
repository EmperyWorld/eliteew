/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Edit access group modal form (New World tokens; desktop portal z-index preserved).
 *
 * Invariants:
 * - Admin HTTP via `desktopAdminApi`; tab content is self-contained (no marketing AMKA).
 * - Does not import adminChrome class tokens (Wave 3).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useState } from 'react';
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
import type {
	AccessGroupResponse,
	AccessGroupUpdate,
} from '../services/desktopAdminApi';
import { updateAccessGroup } from '../services/desktopAdminApi';

export function GroupEditForm({
	groupId,
	group,
	onClose,
	onSuccess,
}: {
	groupId: string;
	group: AccessGroupResponse | null;
	onClose: () => void;
	onSuccess: () => void;
}): React.ReactElement {
	const { t } = useTranslation('appStore');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const [form, setForm] = useState<AccessGroupUpdate>({
		name: group?.name ?? '',
		description: group?.description ?? null,
	});
	useEffect(() => {
		if (group) {
			setForm({ name: group.name, description: group.description });
		}
	}, [group]);
	const updateMut = useMutation({
		mutationFn: (data: AccessGroupUpdate) => updateAccessGroup(groupId, data),
		onSuccess: () => {
			toast.success(t('admin.toast.groups'), t('admin.toast.updated'));
			onSuccess();
		},
		onError: (err: Error) => toast.error(t('admin.toast.groups'), err.message),
	});
	const geid = useId();
	const groupEditName = `${geid}-name`;
	const groupEditDescription = `${geid}-description`;
	const submitErrId = `${geid}-group-edit-error`;
	const submitMessage =
		updateMut.isError && updateMut.error instanceof Error
			? updateMut.error.message
			: null;
	const fieldInvalid = Boolean(submitMessage);

	const touchForm = useCallback(
		(next: (prev: AccessGroupUpdate) => AccessGroupUpdate) => {
			updateMut.reset();
			setForm(next);
		},
		[updateMut]
	);

	if (!group) {
		return (
			<div className="text-[var(--admin-ui-fg-muted)]">
				{t('admin.groups.notFound')}
			</div>
		);
	}

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
				aria-labelledby={`${geid}-title`}
			>
				<h3
					id={`${geid}-title`}
					className="mb-4 text-lg font-semibold text-[var(--admin-ui-fg)]"
				>
					{t('admin.groups.editTitle')}
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
						htmlFor={groupEditName}
						className="block text-sm text-[var(--admin-ui-fg-muted)]"
					>
						{t('admin.common.name')}
					</label>
					<AdminField
						id={groupEditName}
						type="text"
						value={form.name ?? ''}
						onChange={(e) => touchForm((p) => ({ ...p, name: e.target.value }))}
						aria-describedby={fieldInvalid ? submitErrId : undefined}
					/>
					<label
						htmlFor={groupEditDescription}
						className="block text-sm text-[var(--admin-ui-fg-muted)]"
					>
						{t('admin.common.description')}
					</label>
					<AdminField
						id={groupEditDescription}
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
						onClick={() => updateMut.mutate(form)}
						disabled={updateMut.isPending}
					>
						{updateMut.isPending
							? t('admin.common.saving')
							: t('admin.common.save')}
					</AdminButton>
					<AdminButton variant="ghost" onClick={onClose}>
						{t('admin.common.cancel')}
					</AdminButton>
				</div>
			</div>
		</div>
	);
}
