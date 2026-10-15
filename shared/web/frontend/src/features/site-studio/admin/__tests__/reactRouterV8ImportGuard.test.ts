/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock: Site Studio admin must import from `react-router` v8
 * (package `react-router-dom` removed upstream; GHSA-qwww-vcr4-c8h2).
 *
 * Invariants:
 * - No `react-router-dom` import strings under site-studio admin/desktop shells.
 * - Declarative APIs used by embedded admin resolve from `react-router`.
 *
 * Related:
 * - documentation/platform/FRONTEND-TOOLCHAIN-AND-BUILD.md
 * - documentation/platform/ELITEEW-TECH-STACK-SUMMARY.md
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	Link,
	MemoryRouter,
	Navigate,
	Outlet,
	Route,
	Routes,
	resolvePath,
	useLocation,
	useNavigate,
	useParams,
	useSearchParams,
} from 'react-router';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const siteStudioRoot = join(here, '../..');

function collectSourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === '__tests__') continue;
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) {
			out.push(...collectSourceFiles(full));
			continue;
		}
		if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
			out.push(full);
		}
	}
	return out;
}

describe('react-router v8 import guard (site-studio)', () => {
	it('does not import retired react-router-dom package', () => {
		const files = collectSourceFiles(siteStudioRoot);
		const offenders: string[] = [];
		for (const file of files) {
			const text = readFileSync(file, 'utf8');
			if (
				text.includes("from 'react-router-dom'") ||
				text.includes('from "react-router-dom"')
			) {
				offenders.push(relative(siteStudioRoot, file));
			}
		}
		expect(offenders).toEqual([]);
	});

	it('resolves declarative router APIs from react-router', () => {
		expect(typeof MemoryRouter).toBe('function');
		expect(typeof Route).toBe('function');
		expect(typeof Routes).toBe('function');
		expect(typeof Outlet).toBe('function');
		expect(typeof Navigate).toBe('function');
		expect(typeof Link).toBe('object');
		expect(typeof useLocation).toBe('function');
		expect(typeof useNavigate).toBe('function');
		expect(typeof useParams).toBe('function');
		expect(typeof useSearchParams).toBe('function');
		expect(typeof resolvePath).toBe('function');
	});
});
