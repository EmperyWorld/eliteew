/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Legacy SPA route — immediate redirect to standalone /mobile-app/ page.
 */

import { useEffect } from 'react';

export default function MobileAppDownloadPage(): null {
	useEffect(() => {
		const target = `/mobile-app/${window.location.search}${window.location.hash}`;
		window.location.replace(target);
	}, []);

	return null;
}
