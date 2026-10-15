/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared props and draft-updater types for the customer diagnostic runner UI.
 *
 * Invariants:
 * - Public props stay { projectId, className? } — no scoring contract here.
 *
 * Related:
 * - ../CustomerDiagnosticRunner.tsx
 * - documentation/product/marketing/MARKETING-CABINET.md
 */

import type { CustomerDiagnosticSessionState } from '../diagnosticTypes';

export type CustomerDiagnosticRunnerProps = {
	projectId: string;
	className?: string;
};

export type CustomerDiagnosticDraftUpdater = (
	u: (p: CustomerDiagnosticSessionState) => CustomerDiagnosticSessionState
) => void;

export type DiagnosticTranslate = (
	k: string,
	opts?: Record<string, unknown>
) => string;
