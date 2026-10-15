/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bridges the current Marketing Cabinet AMKA view into the standalone AMKA feature boundary.
 * This keeps the existing UI stable while future waves move internals out of `pages/MarketingCabinet`.
 *
 * Invariants:
 * - No UI behavior changes here; it only forwards the feature-owned `AmkaView` with Marketing Cabinet props.
 * - Marketing-specific props remain explicit until a generic AMKA shell owns them.
 *
 * Related:
 * - ./AmkaView.tsx
 * - documentation/product/amka-seed-album/AMKA-STANDALONE-LAYER-MAP.md
 */
import type { ComponentProps } from 'react';

import { AmkaView } from '@/features/amka/AmkaView';

export type MarketingCabinetAmkaViewProps = ComponentProps<typeof AmkaView>;

export const MarketingCabinetAmkaView = AmkaView;
