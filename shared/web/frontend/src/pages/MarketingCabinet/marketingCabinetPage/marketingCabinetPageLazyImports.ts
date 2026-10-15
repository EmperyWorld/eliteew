/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lazy-loaded Marketing Cabinet views and sections for MarketingCabinetPageViewRouter.
 *
 * Invariants:
 * - Dynamic import targets match pre-atomization module paths (views/, sections/, AMKA).
 *
 * Related:
 * - MarketingCabinetPageViewRouter.tsx, MarketingCabinetPage.tsx
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { EvidenceViewProps } from '@/pages/MarketingCabinet/views/EvidenceView';

export const ChatView = lazy(() =>
	import('@/pages/MarketingCabinet/views/ChatView').then((m) => ({
		default: m.ChatView,
	}))
);
export const EvidenceView = lazy(() =>
	import('@/pages/MarketingCabinet/views/EvidenceView').then((m) => ({
		default: m.EvidenceView,
	}))
) as LazyExoticComponent<ComponentType<EvidenceViewProps>>;
export const OverviewView = lazy(() =>
	import('@/pages/MarketingCabinet/views/OverviewView').then((m) => ({
		default: m.OverviewView,
	}))
);
export const OverviewInteractiveDashboard = lazy(() =>
	import('@/pages/MarketingCabinet/views/OverviewInteractiveDashboard').then(
		(m) => ({
			default: m.OverviewInteractiveDashboard,
		})
	)
);
export const SegmentsView = lazy(() =>
	import('@/pages/MarketingCabinet/views/SegmentsView').then((m) => ({
		default: m.SegmentsView,
	}))
);
export const CampaignsView = lazy(() =>
	import('@/pages/MarketingCabinet/views/CampaignsView').then((m) => ({
		default: m.CampaignsView,
	}))
);
export const FunnelView = lazy(() =>
	import('@/pages/MarketingCabinet/views/FunnelView').then((m) => ({
		default: m.FunnelView,
	}))
);
export const OperationsView = lazy(() =>
	import('@/pages/MarketingCabinet/views/OperationsView').then((m) => ({
		default: m.OperationsView,
	}))
);
export const AIStudioView = lazy(() =>
	import('@/pages/MarketingCabinet/views/AIStudioView').then((m) => ({
		default: m.AIStudioView,
	}))
);
export const AmkaView = lazy(() =>
	import('@/features/amka/MarketingCabinetAmkaView').then((m) => ({
		default: m.MarketingCabinetAmkaView,
	}))
);
export const ImcResearchView = lazy(() =>
	import('@/pages/MarketingCabinet/views/ImcResearchView').then((m) => ({
		default: m.ImcResearchView,
	}))
);
export const ProjectRagSourcesView = lazy(() =>
	import('@/pages/MarketingCabinet/views/ProjectRagSourcesView').then((m) => ({
		default: m.ProjectRagSourcesView,
	}))
);
export const ClientInteractionView = lazy(() =>
	import('@/pages/MarketingCabinet/views/ClientInteractionView').then((m) => ({
		default: m.ClientInteractionView,
	}))
);
export const CompaniesSection = lazy(() =>
	import('@/pages/MarketingCabinet/sections/CompaniesSection').then((m) => ({
		default: m.CompaniesSection,
	}))
);
export const ProjectsSection = lazy(() =>
	import('@/pages/MarketingCabinet/sections/ProjectsSection').then((m) => ({
		default: m.ProjectsSection,
	}))
);
export const TeamSection = lazy(() =>
	import('@/pages/MarketingCabinet/sections/TeamSection').then((m) => ({
		default: m.TeamSection,
	}))
);
export const JtbdSection = lazy(() =>
	import('@/pages/MarketingCabinet/sections/JtbdSection').then((m) => ({
		default: m.JtbdSection,
	}))
);
export const ValuePropsSection = lazy(() =>
	import('@/pages/MarketingCabinet/sections/ValuePropsSection').then((m) => ({
		default: m.ValuePropsSection,
	}))
);
export const AnalysisSection = lazy(() =>
	import('@/pages/MarketingCabinet/sections/AnalysisSection').then((m) => ({
		default: m.AnalysisSection,
	}))
);
