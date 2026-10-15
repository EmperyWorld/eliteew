/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared prop and compose types for AmkaView atomization modules.
 *
 * Invariants:
 * - Public AmkaView props shape matches MarketingCabinetAmkaView alias.
 *
 * Related:
 * - ../AmkaView.tsx, useAmkaViewCompose.ts
 */

export type AmkaViewProps = {
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	/** Глобальный операторский конфиг AMKA: только `is_trusted` (см. GET/PUT operator-config). */
	canEditAmkaOperatorConfig?: boolean;
	onOpenAiStudio?: () => void;
};

export type AmkaMainTab = 'run' | 'builder';

export type AmkaRunMode = 'semi_auto' | 'auto';

export type AmkaImcFocus = 'mixed' | 'global' | 'rf';
