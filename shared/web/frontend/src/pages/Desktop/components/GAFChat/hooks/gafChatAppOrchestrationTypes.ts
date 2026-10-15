/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared orchestration result types for GAFChatApp atomization hooks.
 *
 * Invariants:
 * - Result shape matches BuildGafChatAppWorkspaceModelArgs + auth gate fields.
 *
 * Related:
 * - useGafChatAppOrchestration.ts
 * - buildGafChatAppWorkspaceModel.ts
 */
import type { TFunction } from 'i18next';
import type { User } from '@/services';
import type { BuildGafChatAppWorkspaceModelArgs } from './buildGafChatAppWorkspaceModel';

export type GafChatAppOrchestrationResult = {
	user: User | null | undefined;
	t: TFunction<'gafChat'>;
} & BuildGafChatAppWorkspaceModelArgs;
