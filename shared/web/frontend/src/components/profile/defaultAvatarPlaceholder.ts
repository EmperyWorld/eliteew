/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bundled default avatar placeholder URL for rejected/unavailable avatar sources.
 *
 * Invariants:
 * - Same-origin asset only; no third-party identity providers.
 *
 * Related:
 * - src/assets/default-avatar.svg
 * - src/components/profile/SecureAvatar.tsx
 */

import defaultAvatarSvg from '@/assets/default-avatar.svg?url';

/** Local bundled SVG — used when avatar URL is missing or untrusted (external). */
export const DEFAULT_AVATAR_PLACEHOLDER_SRC: string = defaultAvatarSvg;
