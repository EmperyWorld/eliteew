/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-screen loading placeholder for UGS Hub initial dashboard fetch.
 *
 * Related:
 * - ugsHubSharedUi.tsx (UgsHubLoadingSkeleton)
 */

import type { FC } from 'react';

import { UgsHubLoadingSkeleton } from '../ugsHubSharedUi';

export const UgsHubLoadingState: FC = () => <UgsHubLoadingSkeleton />;
