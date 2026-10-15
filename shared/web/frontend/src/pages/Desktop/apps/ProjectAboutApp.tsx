/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop shell for the offline product presentation served from `public/o-proekte/`,
 * with guided tour over shell chrome and the embedded iframe viewport.
 *
 * Invariants:
 * - Presentation assets load same-origin (`/o-proekte/index.html`); no direct file:// or external CDN.
 * - Probe presentation before iframe mount — never load SPA index fallback into the frame
 *   (FoFline missing asset group would otherwise nest desktop-in-desktop).
 * - Shell chrome owns window sizing and tour launch; iframe content is read-only for the tour spotlight.
 *
 * Related:
 * - documentation/product/eliteew-product-card/ELITEEW-PRODUCT-PRESENTATION.html
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §17 (o-proekte group)
 * - shared/api/migrations/applied/20260606_04_desktop_app_catalog_about_project.sql
 */

import { cn } from '@/utils/cn';
import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type ReactElement,
} from 'react';
import { useTranslation } from 'react-i18next';
import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import {
	DesktopAppContentWrapper,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	PROJECT_ABOUT_GUIDE_AUDIO_LS_KEY,
	PROJECT_ABOUT_GUIDE_ROOT_ID,
	PROJECT_ABOUT_GUIDE_STEP_DEFS,
	PROJECT_ABOUT_GUIDE_TOUR_FOLDER,
} from './projectAboutGuideConstants';

const PROJECT_ABOUT_PRESENTATION_PATH = '/o-proekte/index.html';

type PresentationStatus = 'checking' | 'ready' | 'missing';

async function probePresentationReady(): Promise<boolean> {
	try {
		const res = await fetch(PROJECT_ABOUT_PRESENTATION_PATH, {
			method: 'GET',
			credentials: 'same-origin',
			headers: { Accept: 'text/html' },
			cache: 'no-store',
		});
		if (!res.ok) return false;
		const ctype = (res.headers.get('content-type') || '').toLowerCase();
		if (ctype.includes('text/html')) {
			const sample = (await res.text()).slice(0, 800).toLowerCase();
			// SPA index fallback would embed the desktop shell — reject as missing.
			if (
				sample.includes('eliteewfoflineclient') ||
				sample.includes('id="root"') ||
				sample.includes("id='root'")
			) {
				return false;
			}
			if (sample.includes('<!doctype html') || sample.includes('<html')) {
				return true;
			}
		}
		return res.ok;
	} catch {
		return false;
	}
}

export function ProjectAboutApp(): ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'projectAbout' });
	const guideLabels = useMemo(() => guideTourLabelsFromI18n(t, 'guide'), [t]);
	const guideSteps = useBuiltGuideSteps(
		t,
		'guide.steps',
		PROJECT_ABOUT_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = useState(false);
	const [presentation, setPresentation] =
		useState<PresentationStatus>('checking');
	const openGuideTour = useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour);

	const recheckPresentation = useCallback(() => {
		setPresentation('checking');
		void probePresentationReady().then((ok) => {
			setPresentation(ok ? 'ready' : 'missing');
		});
	}, []);

	useEffect(() => {
		recheckPresentation();
	}, [recheckPresentation]);

	return (
		<DesktopAppContentWrapper
			appComponent="ProjectAboutApp"
			id={PROJECT_ABOUT_GUIDE_ROOT_ID}
			mode="passthrough"
			className="flex h-full min-h-0 flex-col overflow-hidden bg-(--desktop-surface-panel)"
		>
			<div
				data-project-about-guide="shell-header"
				className="relative shrink-0 border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_95%,transparent)] px-4 py-2.5"
			>
				<div className="flex min-w-0 flex-col gap-0.5">
					<h1
						className={cn(
							DESKTOP_TYPOGRAPHY.subtitle,
							'text-(--desktop-text-primary)'
						)}
					>
						{t('title')}
					</h1>
					<p
						data-project-about-guide="navigation"
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'max-w-3xl text-(--desktop-text-secondary)'
						)}
					>
						{t('navigationHint')}
					</p>
				</div>
			</div>
			<DesktopAppSurface
				padding="none"
				className="relative min-h-0 flex-1 overflow-hidden rounded-none border-0 bg-transparent shadow-none"
			>
				{presentation === 'ready' ? (
					<div data-desktop-iframe-host="" className="h-full min-h-0 w-full">
						<iframe
							data-project-about-guide="presentation"
							allow="fullscreen"
							className="h-full w-full border-0"
							src={PROJECT_ABOUT_PRESENTATION_PATH}
							title={t('iframeTitle')}
						/>
					</div>
				) : (
					<div
						data-project-about-guide="presentation"
						className="flex h-full min-h-0 flex-col items-start justify-center gap-3 px-6"
						role="status"
					>
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.subtitle,
								'text-(--desktop-text-primary)'
							)}
						>
							{presentation === 'checking'
								? t('presentationChecking')
								: t('presentationMissingTitle')}
						</p>
						{presentation === 'missing' ? (
							<>
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.caption,
										'max-w-xl text-(--desktop-text-secondary)'
									)}
								>
									{t('presentationMissingBody')}
								</p>
								<button
									type="button"
									className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-1.5 text-sm text-(--desktop-text-primary) hover:bg-(--desktop-surface-soft-hover)"
									onClick={recheckPresentation}
								>
									{t('presentationRetry')}
								</button>
							</>
						) : null}
					</div>
				)}
			</DesktopAppSurface>
			<SpotlightGuideModal
				open={guideOpen}
				onClose={() => setGuideOpen(false)}
				rootId={PROJECT_ABOUT_GUIDE_ROOT_ID}
				steps={guideSteps}
				audioLocalStorageKey={PROJECT_ABOUT_GUIDE_AUDIO_LS_KEY}
				tourAudioFolder={PROJECT_ABOUT_GUIDE_TOUR_FOLDER}
				labels={guideLabels}
				spotlightLayoutKey={String(guideOpen)}
				dialogTitleId="project-about-guide-title"
			/>
		</DesktopAppContentWrapper>
	);
}

export default ProjectAboutApp;
