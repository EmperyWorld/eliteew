/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Barrel re-export for companion chat HTTP client modules (coercion, message, stream, task-runs).
 *
 * Invariants:
 * - Public import surface remains `@/services/ewa/ewaCompanionChatApi` for callers and tests.
 *
 * Related:
 * - ewaCompanionChatCoerce.ts
 * - ewaCompanionChatMessageApi.ts
 * - ewaCompanionChatStreamApi.ts
 * - ewaCompanionChatTaskRunsApi.ts
 */
export * from './ewaCompanionChatCoerce';
export * from './ewaCompanionChatMessageApi';
export * from './ewaCompanionChatStreamApi';
export * from './ewaCompanionChatTaskRunsApi';
