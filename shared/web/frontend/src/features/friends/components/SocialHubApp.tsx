/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop registry entry for Social Hub; delegates to SocialHubShell.
 *
 * Invariants:
 * - Component name `SocialHubApp` is stable for notifications and desktop items.
 *
 * Related:
 * - ../social-hub/SocialHubShell.tsx
 */

import SocialHubShell, {
	type SocialHubShellProps,
} from '../social-hub/SocialHubShell';

export type SocialHubAppProps = SocialHubShellProps;

export default SocialHubShell;
