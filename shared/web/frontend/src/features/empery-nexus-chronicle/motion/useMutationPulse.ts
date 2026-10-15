/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Continuous Motion mutation pulse for domain node scale/orbit drift.
 *
 * Invariants:
 * - One looping timeline per mount; killed on unmount.
 *
 * Related:
 * - scene/DomainConstellation.tsx
 */

import { animate } from 'framer-motion';
import { useEffect, useRef } from 'react';

export function useMutationPulse(seed: number) {
	const scaleMul = useRef(1);
	const phaseDrift = useRef(0);

	useEffect(() => {
		const scaleTarget = 1.12 + (seed % 5) * 0.02;
		const animation = animate(0, 1, {
			duration: 3.5 + (seed % 7) * 0.35,
			repeat: Number.POSITIVE_INFINITY,
			repeatType: 'reverse',
			ease: 'easeInOut',
			onUpdate: (progress) => {
				scaleMul.current = 1 + (scaleTarget - 1) * progress;
				phaseDrift.current = Math.PI * 2 * progress * 0.04;
			},
		});
		return () => {
			animation.stop();
		};
	}, [seed]);

	return { scaleMul, phaseDrift };
}
