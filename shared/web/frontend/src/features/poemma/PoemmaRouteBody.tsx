/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 26+: Poemma route switch + workspace bootstrap / unauthenticated panels.
 *
 * Invariants:
 * - Owner-only pages denied via routeAllowedForSession before page mount.
 * - Explicit sync/bootstrap copy — no silent workspace create.
 *
 * Related:
 * - PoemmaApp.tsx, poemmaAppRouting.ts
 */
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { PoemmaCustomerPathPage } from './customer-path/PoemmaCustomerPathPage';
import { PoemmaFinancePage } from './finance/PoemmaFinancePage';
import { PoemmaHappinessPage } from './happiness/PoemmaHappinessPage';
import { PoemmaGoalPage } from './goal/PoemmaGoalPage';
import { PoemmaGuidePage } from './guide/PoemmaGuidePage';
import { PoemmaHomePage } from './home/PoemmaHomePage';
import { PoemmaIdeasPage } from './ideas/PoemmaIdeasPage';
import { PoemmaOnboarding } from './onboarding/PoemmaOnboarding';
import {
	POEMMA_ACCESS_DENIED,
	POEMMA_BOOTSTRAP_COPY,
} from './poemmaUserChromeCopy';
import { PoemmaPeriodClosePage } from './period-close/PoemmaPeriodClosePage';
import { PoemmaPromoActionPage } from './promo/PoemmaPromoActionPage';
import { PoemmaPromoPage } from './promo/PoemmaPromoPage';
import { PoemmaUtmPage } from './promo/PoemmaUtmPage';
import { PoemmaSegmentsPage } from './segments/PoemmaSegmentsPage';
import { PoemmaSettingsPage } from './settings/PoemmaSettingsPage';
import { PoemmaStrategyPage } from './strategy/PoemmaStrategyPage';
import { PoemmaTeamPage } from './team/PoemmaTeamPage';
import {
	PoemmaAccessDenied,
	PoemmaEyebrowLabel,
	PoemmaHeroPanel,
	PoemmaNoticePanel,
	PoemmaPageShell,
	PoemmaSoonPanel,
	POEMMA_DISPLAY_TITLE_HERO_CLASS,
} from './ui';
import { cn } from '@/utils/cn';
import {
	type PoemmaPage,
	type PoemmaResolvedRoute,
	type PoemmaSession,
	routeAllowedForSession,
} from './poemmaAppRouting';

export function WorkspaceBootstrap({
	onInitialize,
}: {
	onInitialize: () => Promise<void>;
}) {
	return (
		<PoemmaPageShell className="min-h-112 place-items-center">
			<PoemmaHeroPanel className="w-full">
				<div className="space-y-5">
					<PoemmaEyebrowLabel>
						{POEMMA_BOOTSTRAP_COPY.eyebrow}
					</PoemmaEyebrowLabel>
					<div>
						<h2 className={cn('mt-2', POEMMA_DISPLAY_TITLE_HERO_CLASS)}>
							{POEMMA_BOOTSTRAP_COPY.title}
						</h2>
						<p className="mt-3 text-base leading-7 text-(--desktop-text-secondary)">
							{POEMMA_BOOTSTRAP_COPY.description}
						</p>
					</div>
					<DesktopAppButton
						type="button"
						variant="accent"
						onClick={onInitialize}
					>
						{POEMMA_BOOTSTRAP_COPY.action}
					</DesktopAppButton>
				</div>
			</PoemmaHeroPanel>
		</PoemmaPageShell>
	);
}

function PoemmaSoonPlaceholder({ page }: { page: PoemmaPage }) {
	return <PoemmaSoonPanel title={page.title} description={page.note} />;
}

export function PoemmaRouteBody({
	page,
	resolved,
	session,
	ownerUserId,
	hasWorkspace,
	onInitialize,
	onNavigate,
	onOnboardingComplete,
	onPeriodClosed,
}: {
	page: PoemmaPage;
	resolved: PoemmaResolvedRoute;
	session: PoemmaSession;
	ownerUserId: string;
	hasWorkspace: boolean;
	onInitialize: () => Promise<void>;
	onNavigate: (path: string) => void;
	onOnboardingComplete: () => void;
	onPeriodClosed: () => void;
}) {
	if (!hasWorkspace) {
		return <WorkspaceBootstrap onInitialize={onInitialize} />;
	}

	if (!routeAllowedForSession(page, session)) {
		return (
			<PoemmaAccessDenied description={POEMMA_ACCESS_DENIED.ownerDescription} />
		);
	}

	const routeProps = {
		ownerUserId,
		userRole: session.role,
		onNavigate,
	};

	switch (page.path) {
		case '/':
			return (
				<PoemmaHomePage
					ownerUserId={ownerUserId}
					session={session}
					onNavigate={onNavigate}
				/>
			);
		case '/onboarding':
			return (
				<PoemmaOnboarding
					ownerUserId={ownerUserId}
					onComplete={onOnboardingComplete}
				/>
			);
		case '/strategy':
			return (
				<PoemmaStrategyPage
					{...routeProps}
					initialView={resolved.strategyView ?? 'main'}
				/>
			);
		case '/goal':
			return <PoemmaGoalPage {...routeProps} />;
		case '/finance':
			return <PoemmaFinancePage {...routeProps} />;
		case '/segments':
			return <PoemmaSegmentsPage {...routeProps} />;
		case '/customer-path':
			return <PoemmaCustomerPathPage {...routeProps} />;
		case '/ideas':
		case '/ideas/:id':
			return (
				<PoemmaIdeasPage
					{...routeProps}
					ideaId={resolved.ideaId}
					decisionHint={resolved.ideaDecision}
				/>
			);
		case '/promo':
			return <PoemmaPromoPage {...routeProps} />;
		case '/promo/actions/:id':
			return (
				<PoemmaPromoActionPage
					{...routeProps}
					promotionId={resolved.promotionId ?? ''}
				/>
			);
		case '/promo/utm':
			return (
				<PoemmaUtmPage {...routeProps} promotionId={resolved.promotionId} />
			);
		case '/team':
			return <PoemmaTeamPage {...routeProps} />;
		case '/period-close':
			return (
				<PoemmaPeriodClosePage
					{...routeProps}
					onPeriodClosed={onPeriodClosed}
				/>
			);
		case '/guide':
			return (
				<PoemmaGuidePage
					onNavigate={onNavigate}
					initialBranch={resolved.guideBranch}
				/>
			);
		case '/settings':
			return <PoemmaSettingsPage {...routeProps} />;
		case '/happiness':
			return <PoemmaHappinessPage {...routeProps} />;
		case '/export':
			return <PoemmaSoonPlaceholder page={page} />;
		default:
			return <PoemmaSoonPlaceholder page={page} />;
	}
}

export function PoemmaUnauthenticated() {
	return (
		<PoemmaPageShell className="min-h-112 place-items-center">
			<PoemmaNoticePanel
				className="w-full"
				tone="warning"
				title="Нужен вход в Empery"
				description="Войдите в платформу, чтобы открыть вашу карту бизнеса. Данные хранятся отдельно для каждого пользователя."
			/>
		</PoemmaPageShell>
	);
}
