/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Edge visitor status surface for Site Studio: live / needs-attention / idle states and LAN link CTAs.
 *
 * Invariants:
 * - Visitor link renders only when `edgeLive` (runtime_dist or snapshot content source).
 * - Panel hidden when edge metadata is absent.
 *
 * Related:
 * - `SiteStudioRuntimePanel.tsx`
 * - `SiteStudioLaunchPanel.tsx`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	ArrowTopRightOnSquareIcon,
	DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';

import type { SiteStudioHealth, SiteStudioInstance } from '../api';
import { computeSiteStudioEdgeState } from './siteStudioRuntimeShared';

export interface SiteStudioEdgeVisitorPanelProps {
	instance: SiteStudioInstance;
	health: SiteStudioHealth | null;
	onCopy: (value: string, label: string) => void;
}

export const SiteStudioEdgeVisitorPanel: React.FC<
	SiteStudioEdgeVisitorPanelProps
> = ({ instance, health, onCopy }) => {
	const { t } = useTranslation('siteStudio');
	const isPublished = instance.publication_state === 'open';
	const { edgeLive, edgeNeedsAttention } = computeSiteStudioEdgeState(
		health,
		isPublished
	);

	if (
		!health?.edge?.url &&
		!health?.edge?.last_error &&
		!health?.edge?.content_source &&
		!health?.edge?.enabled
	) {
		return null;
	}

	return (
		<DesktopAppSurface
			variant="soft"
			padding="sm"
			className="space-y-2"
			data-testid="site-studio-edge-status"
		>
			<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
				{t('runtime.fieldEdgeUrl')}
			</div>
			<div
				className="text-xs text-(--desktop-text-secondary)"
				data-testid="site-studio-edge-live-state"
			>
				{edgeLive
					? t('runtime.edgeStateLive')
					: edgeNeedsAttention
						? t('runtime.edgeStateNeedsAttention')
						: t('runtime.edgeStateIdle')}
			</div>
			{health.edge?.content_source ? (
				<div
					className="text-xs text-(--desktop-text-secondary)"
					data-testid="site-studio-edge-content-source"
				>
					{t(`runtime.edgeContentSource.${health.edge.content_source}`, {
						defaultValue: health.edge.content_source,
					})}
				</div>
			) : null}
			{edgeLive && health.edge?.url ? (
				<>
					<div className="min-h-[44px] break-all text-sm leading-6 text-(--desktop-text-primary)">
						<a
							href={health.edge.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-sky-200 underline-offset-2 hover:underline"
						>
							{health.edge.url}
						</a>
					</div>
					<div className="flex flex-wrap gap-2">
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							onClick={() =>
								onCopy(health.edge?.url ?? '', t('runtime.fieldEdgeUrl'))
							}
						>
							<DocumentDuplicateIcon className="h-3.5 w-3.5" />
							{t('runtime.copy')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="ghost"
							onClick={() => {
								if (health.edge?.url) {
									window.open(health.edge.url, '_blank', 'noopener,noreferrer');
								}
							}}
						>
							<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
							{t('runtime.openEdgeUrl')}
						</DesktopAppButton>
					</div>
				</>
			) : (
				<div className="text-sm text-(--desktop-text-secondary)">
					{edgeNeedsAttention
						? t('runtime.edgeNeedsAttentionHint')
						: t('runtime.notReady')}
				</div>
			)}
			{health.edge?.last_error ? (
				<div className="text-sm text-red-100">
					{t('runtime.edgeLastError', {
						message: health.edge.last_error,
					})}
				</div>
			) : null}
		</DesktopAppSurface>
	);
};

export default SiteStudioEdgeVisitorPanel;
