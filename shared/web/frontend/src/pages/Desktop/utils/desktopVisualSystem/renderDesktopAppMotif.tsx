/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared painted motif overlays for DesktopAppSymbol and DesktopFolderSymbol.
 *
 * Invariants:
 * - Motif keys stay aligned with DesktopAppMotif in appGlyphMap.
 * - No infinite CSS animation on glyph chrome.
 *
 * Related:
 * - `DesktopAppSymbol.tsx` / `DesktopFolderSymbol.tsx`
 * - `documentation/product/DESKTOP-WINDOW-SHELL-STYLE.md`
 */
import type { DesktopAppMotif, DesktopAppVisualPreset } from './appGlyphMap';
import { DesktopPaintedSpan } from './paintedSpan';

export function renderDesktopAppMotif(
	motif: DesktopAppMotif,
	visual: DesktopAppVisualPreset
) {
	const vk = `${visual.primary}|${visual.secondary}|${visual.tertiary}|${visual.glow}`;
	switch (motif) {
		case 'beam':
			return (
				<>
					<DesktopPaintedSpan
						className="absolute left-[18%] top-[14%] h-[18%] w-[54%] rounded-full opacity-90 blur-[2px]"
						depsKey={`beam-a-${vk}`}
						paint={(el) => {
							el.style.background = `linear-gradient(90deg, ${visual.secondary}, transparent)`;
						}}
					/>
					<DesktopPaintedSpan
						className="absolute right-[12%] bottom-[16%] h-[26%] w-[22%] rounded-full opacity-80 blur-sm"
						depsKey={`beam-b-${vk}`}
						paint={(el) => {
							el.style.background = visual.primary;
						}}
					/>
				</>
			);
		case 'wave':
			return (
				<>
					<DesktopPaintedSpan
						className="absolute left-[16%] right-[16%] top-[28%] h-[9%] rounded-full opacity-90"
						depsKey={`wave-1-${vk}`}
						paint={(el) => {
							el.style.background = `linear-gradient(90deg, transparent, ${visual.secondary}, transparent)`;
						}}
					/>
					<DesktopPaintedSpan
						className="absolute left-[22%] right-[22%] top-[42%] h-[9%] rounded-full opacity-80"
						depsKey={`wave-2-${vk}`}
						paint={(el) => {
							el.style.background = `linear-gradient(90deg, transparent, ${visual.primary}, transparent)`;
						}}
					/>
					<DesktopPaintedSpan
						className="absolute left-[28%] right-[28%] top-[56%] h-[9%] rounded-full opacity-70"
						depsKey={`wave-3-${vk}`}
						paint={(el) => {
							el.style.background = `linear-gradient(90deg, transparent, ${visual.secondary}, transparent)`;
						}}
					/>
				</>
			);
		case 'grid':
			return (
				<>
					{[
						{ left: '18%', top: '18%' },
						{ left: '58%', top: '18%' },
						{ left: '18%', top: '58%' },
						{ left: '58%', top: '58%' },
					].map((cell) => (
						<DesktopPaintedSpan
							key={`${cell.left}-${cell.top}`}
							className="absolute h-[14%] w-[14%] rounded-[35%] opacity-85"
							depsKey={`grid-${cell.left}-${cell.top}-${vk}`}
							paint={(el) => {
								el.style.left = cell.left;
								el.style.top = cell.top;
								el.style.background = `linear-gradient(145deg, ${visual.secondary}, ${visual.primary})`;
							}}
						/>
					))}
				</>
			);
		case 'orbit':
			return (
				<>
					<DesktopPaintedSpan
						className="absolute inset-[10%] rounded-full border opacity-50"
						depsKey={`orbit-a-${vk}`}
						paint={(el) => {
							el.style.borderColor = `${visual.secondary}80`;
						}}
					/>
					<DesktopPaintedSpan
						className="absolute right-[16%] top-[16%] h-[14%] w-[14%] rounded-full opacity-90"
						depsKey={`orbit-b-${vk}`}
						paint={(el) => {
							el.style.background = visual.secondary;
						}}
					/>
				</>
			);
		case 'chat':
			return (
				<>
					<DesktopPaintedSpan
						className="absolute left-[16%] top-[18%] h-[42%] w-[48%] rounded-[42%] opacity-70"
						depsKey={`chat-a-${vk}`}
						paint={(el) => {
							el.style.background = `${visual.secondary}2a`;
						}}
					/>
					<DesktopPaintedSpan
						className="absolute right-[18%] bottom-[18%] h-[26%] w-[28%] rounded-[42%] opacity-80"
						depsKey={`chat-b-${vk}`}
						paint={(el) => {
							el.style.background = `${visual.primary}38`;
						}}
					/>
				</>
			);
		case 'bars':
			return (
				<>
					{[22, 36, 50].map((left, index) => (
						<DesktopPaintedSpan
							key={left}
							className="absolute bottom-[18%] w-[10%] rounded-full opacity-90"
							depsKey={`bars-${left}-${index}-${vk}`}
							paint={(el) => {
								el.style.left = `${left}%`;
								el.style.height = `${24 + index * 12}%`;
								el.style.background = `linear-gradient(180deg, ${visual.secondary}, ${visual.primary})`;
							}}
						/>
					))}
				</>
			);
		case 'pulse':
			return (
				<>
					<DesktopPaintedSpan
						className="absolute inset-[16%] rounded-full border opacity-45"
						depsKey={`pulse-a-${vk}`}
						paint={(el) => {
							el.style.borderColor = `${visual.secondary}88`;
						}}
					/>
					<DesktopPaintedSpan
						className="absolute left-[22%] right-[22%] top-1/2 h-[10%] -translate-y-1/2 opacity-90"
						depsKey={`pulse-b-${vk}`}
						paint={(el) => {
							el.style.background = `linear-gradient(90deg, transparent 0%, ${visual.secondary} 18%, ${visual.primary} 48%, ${visual.secondary} 78%, transparent 100%)`;
							el.style.clipPath =
								'polygon(0 52%, 18% 52%, 32% 20%, 45% 86%, 58% 40%, 72% 40%, 100% 40%, 100% 60%, 70% 60%, 56% 60%, 44% 94%, 30% 30%, 20% 68%, 0 68%)';
						}}
					/>
				</>
			);
		default:
			return (
				<>
					<DesktopPaintedSpan
						className="absolute left-[20%] top-[16%] h-[16%] w-[16%] rotate-45 rounded-[35%] opacity-90"
						depsKey={`def-a-${vk}`}
						paint={(el) => {
							el.style.background = visual.secondary;
						}}
					/>
					<DesktopPaintedSpan
						className="absolute right-[14%] bottom-[18%] h-[20%] w-[20%] rounded-full opacity-75 blur-[1px]"
						depsKey={`def-b-${vk}`}
						paint={(el) => {
							el.style.background = visual.primary;
						}}
					/>
				</>
			);
	}
}
