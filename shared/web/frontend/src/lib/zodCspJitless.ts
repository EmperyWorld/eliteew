/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Enable Zod v4 `jitless` before schema parse so prod CSP (`script-src` without
 * `unsafe-eval`) does not report Zod's `new Function("")` allowsEval probe.
 *
 * Invariants:
 * - Must be imported before other app modules that parse Zod schemas.
 * - Complements `public/zod-csp-jitless.js` (earliest classic-script path).
 *
 * Related:
 * - documentation/platform/FRONTEND-SECURITY-NGINX-STATIC.md
 * - public/zod-csp-jitless.js
 */

import { z } from 'zod';

z.config({ jitless: true });
