import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import { cabinetNotify } from '../cabinetNotify';
import {
	marketingCabinetApi,
	MARKETING_PROJECT_AUTOFILL_ALL_TARGETS,
} from '../marketingCabinetApi';
import { extractApiErrorMessage, requireDefined } from '../utils';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { invalidateMarketingCabinetAfterAmkaRun } from '../marketingCabinetQueryOptions';

const BETWEEN_REQUESTS_MS = 450;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function forEachWithDelayBetween<T>(
	items: readonly T[],
	step: (item: T, index: number) => Promise<void>,
	delayMs: number
): Promise<void> {
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (item === undefined) continue;
		await step(item, i);
		if (i < items.length - 1) {
			await delay(delayMs);
		}
	}
}

export interface MarketingProjectGenerateAllAiButtonProps {
	projectId: string | null;
	companyId?: string | null;
	allowMarketingWrite: boolean;
}

/**
 * Запускает по очереди все `generate-from-project/async` для разделов кабинета
 * (как отдельные кнопки «Сгенерировать с AI» в каждом разделе).
 */
export function MarketingProjectGenerateAllAiButton({
	projectId,
	companyId = null,
	allowMarketingWrite,
}: MarketingProjectGenerateAllAiButtonProps) {
	const { t } = useTranslation('marketing');
	const queryClient = useQueryClient();
	const [confirmOpen, setConfirmOpen] = React.useState(false);

	const bulkMutation = useMutation({
		mutationFn: async () => {
			const pid = requireDefined(projectId, 'projectId');
			let ok = 0;
			const errors: string[] = [];
			await forEachWithDelayBetween(
				MARKETING_PROJECT_AUTOFILL_ALL_TARGETS,
				async (target) => {
					try {
						await marketingCabinetApi.documentAutofillFromProjectAsync({
							project_id: pid,
							target_section: target,
							idempotency_key: crypto.randomUUID(),
						});
						ok += 1;
					} catch (err) {
						errors.push(
							`${target}: ${extractApiErrorMessage(err, t('cabinetPage.notices.sectionProjectGenFailed'))}`
						);
					}
				},
				BETWEEN_REQUESTS_MS
			);
			return { ok, errors };
		},
		onSuccess: async (data) => {
			const pid = requireDefined(projectId, 'projectId');
			invalidateMarketingCabinetAfterAmkaRun(queryClient, {
				projectId: pid,
				companyId,
			});
			setConfirmOpen(false);
			const total = MARKETING_PROJECT_AUTOFILL_ALL_TARGETS.length;
			if (data.errors.length === 0) {
				cabinetNotify.success(
					t('toolbar.bulkGenerateSuccess', { count: data.ok })
				);
				return;
			}
			if (data.ok === 0) {
				cabinetNotify.error(
					t('toolbar.bulkGenerateAllFailed'),
					data.errors.slice(0, 3).join('\n')
				);
				return;
			}
			cabinetNotify.info(
				t('toolbar.bulkGeneratePartialInfo', {
					ok: data.ok,
					failed: data.errors.length,
					total,
				}),
				data.errors.slice(0, 4).join('\n')
			);
		},
		onError: (error) => {
			setConfirmOpen(false);
			cabinetNotify.error(
				extractApiErrorMessage(error, t('toolbar.bulkGenerateFailed'))
			);
		},
	});

	const busy = bulkMutation.isPending;
	const disabled = !allowMarketingWrite || !projectId || busy;

	return (
		<>
			<DesktopAppButton
				type="button"
				variant="accent"
				size="sm"
				className="max-w-[min(100%,11rem)] gap-1.5"
				disabled={disabled}
				onClick={() => setConfirmOpen(true)}
				aria-label={t('toolbar.bulkGenerateAria')}
				title={t('toolbar.bulkGenerateAria')}
			>
				{busy ? (
					<ArrowPathIcon
						className="h-4 w-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				) : (
					<SparklesIcon
						className="h-4 w-4 shrink-0"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				)}
				<span className="hidden min-w-0 truncate sm:inline">
					{t('toolbar.bulkGenerateButton')}
				</span>
			</DesktopAppButton>
			<DeleteConfirmModal
				isOpen={confirmOpen}
				tone="sparkles"
				title={t('toolbar.bulkGenerateTitle')}
				message={t('toolbar.bulkGenerateMessage', {
					count: MARKETING_PROJECT_AUTOFILL_ALL_TARGETS.length,
				})}
				confirmLabel={t('toolbar.bulkGenerateConfirm')}
				cancelLabel={t('toolbar.bulkGenerateCancel')}
				pendingLabel={t('toolbar.bulkGeneratePending')}
				confirmVariant="accent"
				hint={t('toolbar.bulkGenerateHint')}
				onCancel={() => {
					if (!bulkMutation.isPending) setConfirmOpen(false);
				}}
				onConfirm={() => bulkMutation.mutate()}
				isLoading={bulkMutation.isPending}
			/>
		</>
	);
}
