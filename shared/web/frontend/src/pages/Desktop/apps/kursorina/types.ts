/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Type definitions for Kursorina desktop investigation worker application.
 *
 * Invariants:
 * - Product types align with API MissionPublicView (shared/api/services/kursorina/models.py).
 * - Tool names / engine ledger steps remain strictly backend-only.
 *
 * Related:
 * - documentation/product/desktop/KURSORINA.md
 * - shared/apps/kursorina/app.manifest.yaml
 */

export type MissionStatus =
	| 'queued'
	| 'running'
	| 'completed'
	| 'blocked'
	| 'cancelled';

export type MissionResultItem = {
	kind: string;
	title: string;
	ref: string;
	snippet: string;
};

export type MissionPublicView = {
	id: string;
	goal: string;
	status: MissionStatus;
	progress: string;
	results: MissionResultItem[];
	answer?: string | null;
	block_reason?: string | null;
	created_at?: string;
	updated_at?: string;
};

export type KursorinaTab = 'report' | 'findings' | 'goal';

export type InvestigationPreset = {
	id: string;
	title: string;
	category: string;
	prompt: string;
	badge: string;
};
