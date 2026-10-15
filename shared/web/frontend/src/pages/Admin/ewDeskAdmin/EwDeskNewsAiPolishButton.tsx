/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single-post AI polish trigger for EWDesk admin news editor toolbar.
 *
 * Invariants:
 * - Disabled when body empty or mutation pending.
 *
 * Related:
 * - EwDeskAdminSection.tsx, EwDeskAdminEditNewsForm.tsx
 * - documentation/product/desktop/EWDESK-NEWS.md
 */
import { normalizeApiError } from '@/services/api/error-handler';
import { useMutation } from '@tanstack/react-query';
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import { adminPolishNewsBody } from '../../Desktop/services/productDesktopApi';

export function EwDeskNewsAiPolishButton({
	title,
	body,
	setTitle,
	setBody,
}: {
	title: string;
	body: string;
	setTitle: React.Dispatch<React.SetStateAction<string>>;
	setBody: React.Dispatch<React.SetStateAction<string>>;
}): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'ewDeskAdmin' });
	const polishMut = useMutation({
		mutationFn: () =>
			adminPolishNewsBody({
				title: title.trim() || undefined,
				body,
			}),
		onSuccess: (data) => {
			if (data.title?.trim()) {
				setTitle(data.title.trim());
			}
			setBody(data.body);
			toast.success(t('aiPolishToast'));
		},
		onError: (e: unknown) => {
			const n = normalizeApiError(e);
			toast.error(typeof n === 'string' ? n : n.message);
		},
	});

	return (
		<DesktopAppButton
			type="button"
			variant="neutral"
			size="sm"
			className="gap-1.5"
			disabled={!body.trim() || polishMut.isPending}
			onClick={() => polishMut.mutate()}
			title={t('aiPolishHint')}
			aria-label={t('aiPolishAria')}
		>
			{polishMut.isPending ? (
				<ArrowPathIcon
					className="h-3.5 w-3.5 shrink-0 animate-spin"
					aria-hidden
				/>
			) : (
				<SparklesIcon
					className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
					aria-hidden
				/>
			)}
			{t('aiPolish')}
		</DesktopAppButton>
	);
}
