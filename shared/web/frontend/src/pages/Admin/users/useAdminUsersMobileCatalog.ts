/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * MatchMedia hook for narrow admin Users catalog (card layout below 768px).
 */

import * as React from 'react';

const MOBILE_MQ = '(max-width: 767px)';

export function useAdminUsersMobileCatalog(): boolean {
	const [mobile, setMobile] = React.useState(() => {
		if (typeof window === 'undefined') return false;
		return window.matchMedia(MOBILE_MQ).matches;
	});

	React.useEffect(() => {
		const mq = window.matchMedia(MOBILE_MQ);
		const onChange = () => setMobile(mq.matches);
		onChange();
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	}, []);

	return mobile;
}
