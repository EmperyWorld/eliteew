/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Branded full-screen boot loading shell (static HTML preloader visual parity).
 *
 * Invariants:
 * - Boot variant preloader only — not for in-app recovery (use EliteRecoveryScreen).
 * - Message is exposed to assistive tech via aria-label on the section.
 *
 * Related:
 * - `components/ui/ElitePreloaderPanel.tsx`
 * - `components/AppRouter.tsx`
 */

import { ElitePreloaderPanel } from '@/components/ui/ElitePreloaderPanel';

export type EliteBootLoadingScreenProps = {
	message?: string;
};

export function EliteBootLoadingScreen({
	message = 'Загрузка…',
}: EliteBootLoadingScreenProps): React.JSX.Element {
	return (
		<section
			className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(217,255,64,0.15),transparent_34rem),radial-gradient(circle_at_20%_85%,rgba(132,255,0,0.1),transparent_26rem),linear-gradient(168deg,rgba(8,10,14,1)_0%,rgba(4,6,10,1)_100%)] p-5 text-white"
			role="status"
			aria-live="polite"
			aria-busy="true"
			aria-label={message}
		>
			<div
				className="pointer-events-none absolute inset-0 bg-linear-to-br from-lime-300/24 via-green-400/14 to-slate-950"
				aria-hidden
			/>
			<div
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,255,64,0.18),transparent_34rem),radial-gradient(circle_at_20%_85%,rgba(132,255,0,0.14),transparent_26rem)]"
				aria-hidden
			/>
			<ElitePreloaderPanel className="relative" />
		</section>
	);
}
