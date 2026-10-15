/**
 * Enable Zod v4 jitless mode before any SPA module imports `zod`.
 * Prod CSP is `script-src 'self'` without `unsafe-eval`. Zod's allowsEval probe
 * uses dynamic Function construction inside try/catch; browsers still report CSP
 * violations. See: node_modules/zod/v4/core/util.js (allowsEval / jitless).
 */
(() => {
	var g = globalThis;
	var cfg = g.__zod_globalConfig;
	if (!cfg || typeof cfg !== 'object') {
		cfg = {};
		g.__zod_globalConfig = cfg;
	}
	cfg.jitless = true;
})();
