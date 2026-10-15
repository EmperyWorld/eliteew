/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mount the merged **EWA SVG sprite sheet** once per desktop shell so ``EwaIcon`` can reference symbols via ``<use>``.
 *
 * Invariants:
 * - Render exactly **one** instance (typically in ``EwaDesktopApp``); id collisions are prevented in ``ewa-icons-combined.svg``.
 * - Sprite source text stays out of visible text extraction / accessibility snapshots; only ``EwaIcon`` instances are user-facing.
 *
 * Related:
 * - src/features/ewa/ewaIcons/sprites/ewa-icons-combined.svg
 * - src/features/ewa/ewaIcons/EwaIcon.tsx
 */
import combinedSprite from '@/features/ewa/ewaIcons/sprites/ewa-icons-combined.svg?raw';
import './ewa-icons.css';

export function EwaIconSprites() {
	return (
		<div
			className="ewa-icon-sprites-host"
			aria-hidden
			hidden
			// biome-ignore lint/security/noDangerouslySetInnerHtml: static SVG sprite from repo assets
			dangerouslySetInnerHTML={{ __html: combinedSprite }}
		/>
	);
}
