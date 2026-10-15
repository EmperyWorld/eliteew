/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Non-interactive swimlane backdrop node for Admin Topology Map bands.
 *
 * Related:
 * - TopologyMapCanvas.tsx
 * - topologyAutoLayout.ts
 */

import type { NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { TOPOLOGY_BAND_META } from './topologyAdminHelpers';

export interface TopologyBandLaneData extends Record<string, unknown> {
	band: string;
	width: number;
	height: number;
}

const BAND_I18N: Record<string, string> = {
	edge: 'adminTopology.bands.edge',
	prod_core: 'adminTopology.bands.prodCore',
	gpu141: 'adminTopology.bands.gpu141',
	command_center: 'adminTopology.bands.commandCenter',
};

export function TopologyBandLaneNode({ data }: NodeProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const lane = data as TopologyBandLaneData;
	const meta = TOPOLOGY_BAND_META.find((b) => b.id === lane.band);
	const labelKey = BAND_I18N[lane.band];

	return (
		<div
			className="pointer-events-none rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)]/30 bg-[var(--admin-ui-surface)]/40"
			style={{ width: lane.width, height: lane.height }}
		>
			<span
				className="absolute left-2 top-1.5 font-mono text-[10px] uppercase tracking-wider"
				style={{ color: meta?.accent ?? 'var(--admin-ui-fg-dim)' }}
			>
				{labelKey ? t(labelKey, lane.band) : lane.band}
			</span>
		</div>
	);
}
