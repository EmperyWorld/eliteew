/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * i18n keys for operator hints when Redis is down but Redis-dependent catalog filters are active.
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx`
 */

export function buildAdminUsersRedisFilterHintKeys(opts: {
	redisAvailable: boolean | undefined;
	onlineOnly: boolean;
	anomalyOnly: boolean;
	mismatchOnly: boolean;
}): string[] {
	if (opts.redisAvailable !== false) return [];
	const keys: string[] = [];
	if (opts.onlineOnly) keys.push('adminUsersHub.redis.hintOnline');
	if (opts.anomalyOnly) keys.push('adminUsersHub.redis.hintAnomaly');
	if (opts.mismatchOnly) keys.push('adminUsersHub.redis.hintMismatch');
	return keys;
}
