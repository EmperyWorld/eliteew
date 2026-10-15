/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Quieter step navigation for launcher journey (home → tunnel → license → shell).
 *
 * Invariants:
 * - Only reachable steps are clickable (isStepReachable).
 *
 * Related:
 * - lib/launcher/stepGates.ts
 * - features/chrome/LauncherHero.tsx
 */

import {
	isStepReachable,
	launcherStepsForUi,
	STEP_META,
	type LauncherStep,
} from '../../lib/launcher/stepGates';
import './chrome.css';

type StepRailProps = {
	step: LauncherStep;
	nativeReady: boolean;
	onStepChange: (step: LauncherStep) => void;
};

export function StepRail({ step, nativeReady, onStepChange }: StepRailProps) {
	const steps = launcherStepsForUi();
	const activeIndex = Math.max(0, steps.indexOf(step));

	return (
		<nav className="hero-nav" aria-label="Этапы подключения">
			<ul className="step-rail">
				{steps.map((key, displayIndex) => {
					const reachable = isStepReachable(step, key);
					return (
						<li
							key={key}
							data-active={step === key ? 'true' : 'false'}
							data-done={displayIndex < activeIndex ? 'true' : 'false'}
						>
							<button
								type="button"
								className="step-rail-btn"
								disabled={!reachable}
								aria-current={step === key ? 'step' : undefined}
								onClick={() => {
									if (reachable) onStepChange(key);
								}}
							>
								<span className="step-rail-index" aria-hidden="true">
									{displayIndex + 1}
								</span>
								<span className="step-rail-label">{STEP_META[key].label}</span>
							</button>
						</li>
					);
				})}
			</ul>
			{!nativeReady ? (
				<p className="native-ping" role="status">
					Ожидаем ядро приложения…
				</p>
			) : null}
		</nav>
	);
}
