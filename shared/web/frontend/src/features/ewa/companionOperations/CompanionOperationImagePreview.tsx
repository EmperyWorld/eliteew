/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Authenticated preview for companion operation images (unified_content download requires Bearer).
 *
 * Invariants:
 * - Never use raw `/api/v1/content/{id}/download` in `<img src>` without blob fetch.
 *
 * Related:
 * - src/features/ewa/CompanionOperationRunCard.tsx
 * - src/components/UGSHub.tsx (UgsUnifiedContentImagePreview)
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	downloadCompanionOperationImageBlob,
	isCompanionOperationContentKnownMissing,
} from '@/services/content/companionOperationContentPreviewDownload';
import { isAuthSessionLocked } from '@/services/auth/authSessionLock';
import { isHttpRequestAbortLikeError } from '@/services/auth/authSessionHttpAbort';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import { cn } from '@/utils/cn';

export type CompanionOperationImagePreviewProps = {
	contentId: string;
	className?: string;
	alt?: string;
	onFailed?: () => void;
};

export function CompanionOperationImagePreview({
	contentId,
	className,
	alt = '',
	onFailed,
}: CompanionOperationImagePreviewProps) {
	const { t } = useTranslation('marketing');
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const [loading, setLoading] = useState(true);
	const blobUrlRef = useRef<string | null>(null);
	const onFailedRef = useRef(onFailed);
	onFailedRef.current = onFailed;

	useEffect(() => {
		const cid = contentId.trim();
		if (!cid) {
			setBlobUrl(null);
			setFailed(true);
			setLoading(false);
			onFailedRef.current?.();
			return;
		}
		if (isCompanionOperationContentKnownMissing(cid)) {
			setBlobUrl(null);
			setFailed(true);
			setLoading(false);
			return;
		}
		if (isAuthSessionLocked()) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setFailed(false);
		if (blobUrlRef.current) {
			URL.revokeObjectURL(blobUrlRef.current);
			blobUrlRef.current = null;
		}
		setBlobUrl(null);

		void (async () => {
			try {
				const { blob } = await downloadCompanionOperationImageBlob(cid);
				if (cancelled || isAuthSessionLocked()) return;
				const url = URL.createObjectURL(blob);
				blobUrlRef.current = url;
				setBlobUrl(url);
			} catch (err) {
				if (
					cancelled ||
					isAuthSessionLocked() ||
					isHttpRequestAbortLikeError(err)
				) {
					return;
				}
				ewaCompanionDegradeDebug(
					'companion_operations_image_preview',
					'unified content blob download failed',
					err
				);
				setFailed(true);
				onFailedRef.current?.();
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = null;
			}
		};
	}, [contentId]);

	if (failed) {
		return (
			<p className="text-[10px] text-rose-300/90">
				{t('ewaCompanion.operationsImagePreviewFailed', {
					defaultValue: 'Не удалось загрузить превью',
				})}
			</p>
		);
	}
	if (loading || !blobUrl) {
		return (
			<div
				className={cn(
					'flex items-center justify-center rounded border border-(--companion-divider) bg-(--desktop-surface-soft)/40',
					className
				)}
				aria-busy="true"
			>
				<ArrowPathIcon className="size-5 animate-spin text-(--companion-text-soft)" />
			</div>
		);
	}

	return (
		<img src={blobUrl} alt={alt} className={className} draggable={false} />
	);
}
