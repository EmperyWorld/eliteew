/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helper: whether offline shell should be blocked by denylist.
 */

export function shouldBlockShellForDenylist(revoked: boolean | null | undefined): boolean {
	return revoked === true;
}
