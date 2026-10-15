/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Social Hub phone section wrapper for the mobile app status panel.
 *
 * Invariants:
 * - Reuses MobileAppHubPanel without duplicating mobile API calls in the shell.
 *
 * Related:
 * - SocialHubShell.tsx
 * - ../../components/MobileAppHubPanel.tsx
 */

import MobileAppHubPanel from '../../components/MobileAppHubPanel';

export default function SocialHubPhoneSection(): JSX.Element {
	return <MobileAppHubPanel />;
}
