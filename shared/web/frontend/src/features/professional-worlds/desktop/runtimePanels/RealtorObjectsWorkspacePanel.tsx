/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Barrel re-exports for realtor objects runtime panels (Wave 2b split). Preserves
 * import-stable paths for registry, router, and tests.
 *
 * Invariants:
 * - Implementation lives under `./realtorObjects/*`; this file is adapter + re-export only.
 *
 * Related:
 * - ./realtorObjects/
 * - ../runtimeModuleRegistry.tsx
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

import type { RuntimeModulePanelProps } from '../runtimeModuleRegistry';
import { RealtorObjectsWorkspaceShell } from './realtorObjects/RealtorObjectsWorkspaceShell';

/** Registry adapter; requires `ProfessionalWorldsWorkspaceProvider` ancestor. */
export function RealtorObjectsRegistryPanel(_props: RuntimeModulePanelProps) {
	return <RealtorObjectsWorkspacePanel />;
}

export function RealtorObjectsWorkspacePanel() {
	return <RealtorObjectsWorkspaceShell />;
}
