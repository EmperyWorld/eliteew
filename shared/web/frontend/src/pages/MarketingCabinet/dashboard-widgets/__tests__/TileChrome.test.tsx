import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TileChrome } from '../TileChrome';

describe('TileChrome', () => {
	it('matches snapshot for comfortable density with header actions', () => {
		const html = renderToStaticMarkup(
			<TileChrome
				title="Sample tile"
				badge="3"
				headerActions={<button type="button">x</button>}
				footer={<a href="#f">Open</a>}
				tileAriaLabel="Demo tile"
			>
				<p>Body</p>
			</TileChrome>
		);
		expect(html).toMatchSnapshot();
	});

	it('renders belowHeader between header and scroll body', () => {
		const html = renderToStaticMarkup(
			<TileChrome title="T" belowHeader={<p>Controls</p>}>
				<p>Body</p>
			</TileChrome>
		);
		expect(html).toContain('Controls');
		expect(html.indexOf('Controls')).toBeLessThan(html.indexOf('Body'));
	});

	it('sets data-mc-guide when dataMcGuide is passed', () => {
		const html = renderToStaticMarkup(
			<TileChrome title="T" dataMcGuide="widget-chrome">
				<p>Body</p>
			</TileChrome>
		);
		expect(html).toContain('data-mc-guide="widget-chrome"');
	});
});
