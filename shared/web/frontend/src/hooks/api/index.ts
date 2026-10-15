/**
 * API Hooks - Centralized export
 * Marketing Cabinet hooks removed; UGS hooks retained.
 *
 * @version 2.0.0 - React Query v5
 * @date 2025-10-15
 */

export type { UUID } from './types';

// UGS Hooks
export * from './useUgsBillingStats';
export * from './useUgsTasks';

// IMC (marketing cabinet research)
export * from './useImcResearch';
