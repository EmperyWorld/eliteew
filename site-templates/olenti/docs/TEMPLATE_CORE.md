# Template core boundary

The core is the React/Vite frontend, the Express API and PostgreSQL/Prisma model under [the template root](../README.md). Frontend builds select combined public/admin or storefront entries. Notification scheduling and rate limiting are currently in memory; Redis/BullMQ is not a runtime dependency of those implementations.

Environment variables own infrastructure, credentials and allowed origins. [The `site` Config namespace](../server/src/services/siteSettings.ts) owns public contact details, title/description, theme and public URLs. Template/demo seeds are data initialization inputs, not production defaults or evidence that a database has been provisioned.

Public UI token selection and admin UI token selection use separate clients. The server verifies JWTs and requires the database `ADMIN` role for admin operations; it retains cookie fallbacks, so do not claim strictly isolated cookie realms. Sharing code does not make the template part of the shared FastAPI authentication boundary.

Use [technical overview](CURRENT_TECHNICAL_OVERVIEW.md), [HTTP reference](ADMIN_API_CONTRACT.md) and [container packaging limits](DOCKER_REBUILD.md). Deployment acceptance, schema upgrades, persistent scheduling and external notification delivery require separate work/evidence.
