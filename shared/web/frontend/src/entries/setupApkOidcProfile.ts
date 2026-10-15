/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Must be the first import of `/mobile-app/` entry — switches OIDC to empery-apk-distro.
 */

import { setOidcRuntimeProfile } from '@/services/keycloakProfile';

setOidcRuntimeProfile('apk');
