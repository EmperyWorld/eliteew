/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable import path for the customer diagnostic runner; thin re-export facade.
 *
 * Invariants:
 * - Named exports CustomerDiagnosticRunner and CustomerDiagnosticRunnerProps only.
 * - Implementation lives under ./runner/ (≤800 LOC per child).
 *
 * Related:
 * - runner/CustomerDiagnosticRunner.tsx
 * - documentation/product/marketing/MARKETING-CABINET.md
 * - documentation/product/eliteew-product-card/research/17-customer-cabinet.md
 */

export {
	CustomerDiagnosticRunner,
	type CustomerDiagnosticRunnerProps,
} from './runner/CustomerDiagnosticRunner';
