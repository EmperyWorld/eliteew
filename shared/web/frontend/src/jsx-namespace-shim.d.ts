import type { ReactElement } from 'react';

/** TS 6 + React 19: allow legacy `JSX.Element` return types without per-file edits */
declare global {
	namespace JSX {
		type Element = ReactElement;
	}
}
