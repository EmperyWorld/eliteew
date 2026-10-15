/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed pure builders for transcript bundle section and surface prop contracts.
 *
 * Invariants:
 * - Builders preserve component prop shapes without adding state or side effects.
 *
 * Related:
 * - src/features/ewa/companionUx/useCompanionChatTranscriptBundle.tsx
 */

import type { CompanionActionsTrayProps } from '@/features/ewa/companionUx/CompanionActionsTray';
import type { CompanionAnticipationHintSectionProps } from '@/features/ewa/companionUx/CompanionAnticipationHintSection';
import type { CompanionLeftRailClusterProps } from '@/features/ewa/companionUx/CompanionLeftRailCluster';
import type { CompanionLeftRailMemorySectionProps } from '@/features/ewa/companionUx/CompanionLeftRailMemorySection';
import type { CompanionLeftRailPlanSectionProps } from '@/features/ewa/companionUx/CompanionLeftRailPlanSection';
import type { CompanionLeftRailServerActionsSectionProps } from '@/features/ewa/companionUx/CompanionLeftRailServerActionsSection';
import type { CompanionProtocolStripsProps } from '@/features/ewa/companionUx/CompanionProtocolStrips';
import type { CompanionTranscriptChatContentProps } from '@/features/ewa/companionUx/CompanionTranscriptChatContent';
import type { CompanionTranscriptColumnProps } from '@/features/ewa/companionUx/CompanionTranscriptColumn';
import type { CompanionTurnPlanStripProps } from '@/features/ewa/companionUx/CompanionTurnPlanStrip';
import type { CompanionOutputSurfaceProps } from '@/features/ewa/companionOutputSurface/CompanionOutputSurface';

export const buildCompanionActionsTrayProps = (
	props: CompanionActionsTrayProps
): CompanionActionsTrayProps => props;

export const buildCompanionAnticipationSectionProps = (
	props: CompanionAnticipationHintSectionProps
): CompanionAnticipationHintSectionProps => props;

export const buildCompanionLeftRailServerActionsProps = (
	props: CompanionLeftRailServerActionsSectionProps
): CompanionLeftRailServerActionsSectionProps => props;

export const buildCompanionProtocolStripsProps = (
	props: CompanionProtocolStripsProps
): CompanionProtocolStripsProps => props;

export const buildCompanionTurnPlanStripProps = (
	props: CompanionTurnPlanStripProps
): CompanionTurnPlanStripProps => props;

export const buildCompanionLeftRailPlanSectionProps = (
	props: CompanionLeftRailPlanSectionProps
): CompanionLeftRailPlanSectionProps => props;

export const buildCompanionLeftRailMemorySectionProps = (
	props: CompanionLeftRailMemorySectionProps
): CompanionLeftRailMemorySectionProps => props;

export const buildCompanionLeftRailClusterProps = (
	props: CompanionLeftRailClusterProps
): CompanionLeftRailClusterProps => props;

export const buildCompanionTranscriptChatContentProps = (
	props: CompanionTranscriptChatContentProps
): CompanionTranscriptChatContentProps => props;

export const buildCompanionOutputSurfaceProps = (
	props: CompanionOutputSurfaceProps
): CompanionOutputSurfaceProps => props;

export const buildCompanionTranscriptColumnProps = (
	props: Omit<CompanionTranscriptColumnProps, 'children'>
): Omit<CompanionTranscriptColumnProps, 'children'> => props;
