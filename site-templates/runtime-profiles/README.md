# Site template runtime profiles

Reference · source inspection dated 2026-10-11. The checked-in JSON profiles are content/configuration inputs used by Site Studio template runtime setup, not executable applications.

- [olenti.json](olenti.json): `olenti-v1` profile.
- [allenti.json](allenti.json): `allenti-v1` profile.
- [aurelia.json](aurelia.json): `aurelia-v1` profile, including theme and a larger block set.

Each profile supplies `site_settings` and `blocks` identified by page/section/key. Placeholders include `{brand}`, `{topic}` and `{admin_email}`. Inspect [site_studio_runtime](../../shared/api/services/site_studio_runtime/) for consumer behavior; JSON existence does not prove an instance was provisioned or published.

The [Olenti template](../olenti/README.md) owns its API, build commands and database prerequisites. Never place tenant passwords, service tokens or private URLs into public profile content.
