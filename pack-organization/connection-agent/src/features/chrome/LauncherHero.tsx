/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-bleed professional top chrome for the desktop-client launcher.
 *
 * Invariants:
 * - Hero spans the window edge-to-edge; product name dominates the first band.
 * - Version is a soft chip — never louder than the brand.
 * - Hidden ops escape: N version taps unlock debug UI (not a visible Advanced door).
 *
 * Related:
 * - features/chrome/StepRail.tsx
 * - lib/launcher/retailSealed.ts
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 */

import type { ReactNode } from 'react';
import { APP_VERSION } from '../../lib/launcher/appVersion';
import './chrome.css';

type LauncherHeroProps = {
	children?: ReactNode;
	/** Hidden ops escape: repeated version taps unlock debug UI. */
	onVersionTap?: () => void;
};

export function LauncherHero({ children, onVersionTap }: LauncherHeroProps) {
	return (
		<header className="hero" data-layout="full-top">
			<div className="hero-inner">
				<div className="hero-brand">
					<div className="hero-mark" aria-hidden="true">
						<img src="/brand-mark.png" alt="" width={72} height={72} />
					</div>
					<div className="hero-copy">
						<div className="hero-meta">
							<p className="eyebrow">EliteEW · Empery World</p>
							<span
								className="hero-version"
								role={onVersionTap ? 'button' : undefined}
								tabIndex={onVersionTap ? 0 : undefined}
								onClick={onVersionTap}
								onKeyDown={
									onVersionTap
										? (e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													onVersionTap();
												}
											}
										: undefined
								}
							>
								v{APP_VERSION}
							</span>
						</div>
						<h1>Рабочий стол EliteEW</h1>
						<p className="lead">
							Ваше место на устройстве: лицензия, офлайн-пакет и облако по
							защищённому каналу.
						</p>
					</div>
				</div>
				{children}
			</div>
		</header>
	);
}
