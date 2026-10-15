/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock launcher + native icons to EliteEW brand logo SoT (not placeholder SVG).
 *
 * Related:
 * - src-tauri/app-icon-src/logo.png
 * - documentation/product/desktop/DESKTOP-CLIENT-WINDOWS-BUILD-VM.md
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = dirname(fileURLToPath(import.meta.url));
const root = join(srcDir, '..');

describe('brand mark SoT', () => {
	it('launcher uses brand-mark.png from public/', () => {
		const hero = readFileSync(
			join(srcDir, 'features/chrome/LauncherHero.tsx'),
			'utf8'
		);
		const html = readFileSync(join(root, 'index.html'), 'utf8');
		expect(hero).toContain('/brand-mark.png');
		expect(hero).not.toContain('brand-mark.svg');
		expect(html).toContain('/brand-mark.png');
		expect(html).not.toContain('brand-mark.svg');
		expect(existsSync(join(root, 'public/brand-mark.png'))).toBe(true);
	});

	it('keeps tauri icon SoT and generated ico', () => {
		expect(existsSync(join(root, 'src-tauri/app-icon-src/logo.png'))).toBe(true);
		expect(existsSync(join(root, 'src-tauri/icons/icon.ico'))).toBe(true);
		expect(existsSync(join(root, 'src-tauri/icons/icon.png'))).toBe(true);
		// Freedesktop/GNOME app-grid sizes (beyond Tauri defaults 32/128/@2x).
		expect(existsSync(join(root, 'src-tauri/icons/48x48.png'))).toBe(true);
		expect(existsSync(join(root, 'src-tauri/icons/64x64.png'))).toBe(true);
		expect(existsSync(join(root, 'src-tauri/icons/256x256.png'))).toBe(true);
		expect(existsSync(join(root, 'src-tauri/icons/512x512.png'))).toBe(true);
	});

	it('lists freestanding hicolor sizes in tauri.conf bundle.icon', () => {
		const conf = JSON.parse(
			readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8')
		) as { bundle: { icon: string[] } };
		for (const rel of [
			'icons/48x48.png',
			'icons/64x64.png',
			'icons/96x96.png',
			'icons/256x256.png',
			'icons/512x512.png',
		]) {
			expect(conf.bundle.icon).toContain(rel);
		}
	});

	it('scripts/regenerate-icons.sh is a thin wrapper to packaging/', () => {
		const wrapper = join(root, 'scripts/regenerate-icons.sh');
		expect(existsSync(wrapper)).toBe(true);
		const body = readFileSync(wrapper, 'utf8');
		expect(body).toContain('packaging/linux/regenerate-icons.sh');
		expect(body).toMatch(/\bexec bash\b/);
		expect(body).not.toContain('logo-apps-plate');
	});

	it('keeps app-grid icons plated and tray icon transparent', () => {
		const script = readFileSync(
			join(root, 'packaging/linux/regenerate-icons.sh'),
			'utf8'
		);
		expect(script).toContain('EliteEW/image/logo.png');
		expect(script).toContain('logo-apps-plate');
		expect(script).toContain('transparent tray');
		expect(existsSync(join(root, 'src-tauri/icons/96x96.png'))).toBe(true);

		const measure = (rel: string) => {
			const abs = join(root, rel);
			const out = execFileSync(
				'python3',
				[
					'-c',
					'from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert("RGBA");'
					+ 'px=list(im.getdata()); n=sum(1 for p in px if p[3]>=200);'
					+ 'print(n, im.size[0]*im.size[1], im.getpixel((0,0))[3])',
					abs,
				],
				{ encoding: 'utf8' }
			).trim();
			const [opaque, total, corner] = out.split(/\s+/).map(Number);
			return { opaque: opaque!, total: total!, corner: corner! };
		};
		const plate = measure('src-tauri/icons/128x128.png');
		const tray = measure('src-tauri/icons/icon.png');
		expect(plate.opaque / plate.total).toBeGreaterThan(0.5);
		expect(tray.opaque / tray.total).toBeLessThan(0.15);
		expect(plate.corner).toBe(0);
	});

	it('bakes rpm postinstall icon-cache refresh and desktop Categories', () => {
		const desk = readFileSync(
			join(root, 'packaging/linux/desktop-template.desktop'),
			'utf8'
		);
		const conf = readFileSync(join(root, 'src-tauri/tauri.conf.json'), 'utf8');
		expect(desk).toContain('Categories=Network;Utility;');
		expect(conf).toContain('rpm-postinstall.sh');
		expect(existsSync(join(root, 'packaging/linux/rpm-postinstall.sh'))).toBe(
			true
		);
	});
});
