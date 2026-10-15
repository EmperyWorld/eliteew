/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Central React Query key factories for AMKA data aligned with Marketing Cabinet routes.
 *
 * Invariants:
 * - Keys stay serializable and stable for TanStack Query deduplication.
 *
 * Related:
 * - src/hooks/api/useAmka.ts
 */
import type { QueryKey } from '@tanstack/react-query';

/** Корень ключей — отдельная константа, чтобы не читать `amkaQueryKeys` до завершения инициализации объекта. */
const AMKA_QUERY_ROOT = ['amka'] as const;

export const amkaQueryKeys = {
	all: AMKA_QUERY_ROOT,
	marketingCabinetPrefix: ['marketing', 'amka'] as const,

	listProject: (projectId: string, limit: number): QueryKey =>
		[...AMKA_QUERY_ROOT, 'list', 'project', projectId, limit] as const,

	run: (runId: string): QueryKey => [...AMKA_QUERY_ROOT, 'run', runId] as const,

	coreAlignment: (runId: string): QueryKey =>
		[...AMKA_QUERY_ROOT, 'core-alignment', runId] as const,

	operatorConfig: [...AMKA_QUERY_ROOT, 'operator-config'] as const,

	presetsProject: (projectId: string): QueryKey =>
		[...AMKA_QUERY_ROOT, 'presets', 'project', projectId] as const,

	presetTemplates: [...AMKA_QUERY_ROOT, 'preset-templates'] as const,
};
