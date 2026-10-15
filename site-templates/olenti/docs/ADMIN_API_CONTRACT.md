# Template HTTP and admin integration reference

Reference · source-derived, 2026-10-11. The literal Express route index below belongs to Olenti's API and is separate from the shared FastAPI catalog. Methods/paths are statically traced from [index.ts](../server/src/index.ts) and router declarations; request/response execution and Swagger freshness were not verified.

## Admin login and authorization

`POST /api/admin/login` accepts JSON `email` and `password`. Missing fields return 400; invalid database credentials/role return 401; caught failures return 500. It issues a JWT with a 24-hour expiry and responds with `user` (`id`, `email`, `name`, `role`) and `token`, also setting `admin_auth_token` as HttpOnly/Secure/SameSite=None for `/`. If configured, optional environment bootstrap credentials are checked before database bcrypt credentials; the special input `admin` can normalize to the configured email. Do not publish those values or describe this as read-only login: the bootstrap branch can create an admin user.

[authenticate](../server/src/middleware/auth.ts) prefers Bearer headers, otherwise selects cookies with fallback across admin/public/legacy names. It verifies JWT signatures, reloads an active user from Prisma, and then [requireAdmin](../server/src/middleware/auth.ts) enforces the `ADMIN` role. Missing/invalid/inactive authentication returns 401; role denial returns 403. Route-specific authentication middleware still determines access. This is not a Keycloak token contract.

## Public and admin settings

`GET /api/settings` is public read. `GET`, `PUT` and `PATCH /api/admin/site-settings` require authentication and admin role. [The settings service](../server/src/services/siteSettings.ts) reads/writes `Config` namespace `site`: contact phone/email/address, working hours, site title/description, default theme, frontend URL and shop URL. Writes process provided non-null fields individually. The implementation does not wrap all settings writes into one atomic transaction or make PUT a complete replacement. Output includes `id: "main"` and a synthesized `updatedAt` timestamp.

Read [public settings](../server/src/routes/settings.ts) and [admin settings](../server/src/routes/admin-site-settings.ts) for error behavior. Other route bodies use their own validators and Prisma contracts; do not derive them merely from an endpoint name.

## Declared routes

Each source link is a handler declaration. The list records literal route mounts; it does not expand every middleware dependency, parameter validator, response model or business ACL. Router parameters use Express `:name` syntax. `GET /api/health` is declared directly in the entry point; `/api/docs` serves configured Swagger UI.


### /api/auth

- `POST /api/auth/register` — [auth.ts:19](../server/src/routes/auth.ts#L19).
- `POST /api/auth/login` — [auth.ts:62](../server/src/routes/auth.ts#L62).
- `GET /api/auth/me` — [auth.ts:113](../server/src/routes/auth.ts#L113).
- `PATCH /api/auth/me` — [auth.ts:140](../server/src/routes/auth.ts#L140).
- `POST /api/auth/change-password` — [auth.ts:164](../server/src/routes/auth.ts#L164).

### /api/products

- `GET /api/products/summary` — [products.ts:17](../server/src/routes/products.ts#L17).
- `POST /api/products/bulk-price` — [products.ts:44](../server/src/routes/products.ts#L44).
- `GET /api/products` — [products.ts:93](../server/src/routes/products.ts#L93).
- `GET /api/products/:id` — [products.ts:169](../server/src/routes/products.ts#L169).
- `POST /api/products` — [products.ts:195](../server/src/routes/products.ts#L195).
- `PATCH /api/products/:id` — [products.ts:244](../server/src/routes/products.ts#L244).
- `DELETE /api/products/:id` — [products.ts:290](../server/src/routes/products.ts#L290).

### /api/consultations

- `GET /api/consultations` — [consultations.ts:10](../server/src/routes/consultations.ts#L10).
- `GET /api/consultations/:slug` — [consultations.ts:25](../server/src/routes/consultations.ts#L25).
- `POST /api/consultations` — [consultations.ts:50](../server/src/routes/consultations.ts#L50).
- `PATCH /api/consultations/:id` — [consultations.ts:109](../server/src/routes/consultations.ts#L109).
- `DELETE /api/consultations/:id` — [consultations.ts:171](../server/src/routes/consultations.ts#L171).

### /api/masterclasses

- `GET /api/masterclasses` — [masterclasses.ts:10](../server/src/routes/masterclasses.ts#L10).
- `GET /api/masterclasses/:slug` — [masterclasses.ts:32](../server/src/routes/masterclasses.ts#L32).
- `POST /api/masterclasses` — [masterclasses.ts:57](../server/src/routes/masterclasses.ts#L57).
- `PATCH /api/masterclasses/:id` — [masterclasses.ts:124](../server/src/routes/masterclasses.ts#L124).
- `DELETE /api/masterclasses/:id` — [masterclasses.ts:194](../server/src/routes/masterclasses.ts#L194).

### /api/bookings

- `GET /api/bookings` — [bookings.ts:10](../server/src/routes/bookings.ts#L10).
- `POST /api/bookings` — [bookings.ts:32](../server/src/routes/bookings.ts#L32).
- `GET /api/bookings/my` — [bookings.ts:135](../server/src/routes/bookings.ts#L135).
- `PATCH /api/bookings/:id/cancel` — [bookings.ts:154](../server/src/routes/bookings.ts#L154).

### /api/orders

- `GET /api/orders` — [orders.ts:39](../server/src/routes/orders.ts#L39).
- `POST /api/orders` — [orders.ts:66](../server/src/routes/orders.ts#L66).
- `GET /api/orders/my` — [orders.ts:193](../server/src/routes/orders.ts#L193).
- `GET /api/orders/:id` — [orders.ts:216](../server/src/routes/orders.ts#L216).

### /api/settings

- `GET /api/settings` — [settings.ts:7](../server/src/routes/settings.ts#L7).

### /api/gallery

- `GET /api/gallery` — [gallery.ts:9](../server/src/routes/gallery.ts#L9).
- `POST /api/gallery` — [gallery.ts:29](../server/src/routes/gallery.ts#L29).
- `PATCH /api/gallery/:id` — [gallery.ts:45](../server/src/routes/gallery.ts#L45).
- `DELETE /api/gallery/:id` — [gallery.ts:62](../server/src/routes/gallery.ts#L62).

### /api/schedule

- `GET /api/schedule` — [schedule.ts:10](../server/src/routes/schedule.ts#L10).
- `POST /api/schedule` — [schedule.ts:84](../server/src/routes/schedule.ts#L84).
- `PATCH /api/schedule/:id` — [schedule.ts:139](../server/src/routes/schedule.ts#L139).
- `DELETE /api/schedule/:id` — [schedule.ts:156](../server/src/routes/schedule.ts#L156).
- `POST /api/schedule/bulk` — [schedule.ts:170](../server/src/routes/schedule.ts#L170).

### /api/admin

- `POST /api/admin/upload` — [admin.ts:62](../server/src/routes/admin.ts#L62).
- `POST /api/admin/login` — [admin.ts:96](../server/src/routes/admin.ts#L96).
- `GET /api/admin/stats` — [admin.ts:193](../server/src/routes/admin.ts#L193).
- `GET /api/admin/consultations` — [admin.ts:256](../server/src/routes/admin.ts#L256).
- `GET /api/admin/masterclasses` — [admin.ts:274](../server/src/routes/admin.ts#L274).
- `GET /api/admin/bookings` — [admin.ts:292](../server/src/routes/admin.ts#L292).
- `PATCH /api/admin/bookings/:id` — [admin.ts:317](../server/src/routes/admin.ts#L317).
- `GET /api/admin/orders` — [admin.ts:422](../server/src/routes/admin.ts#L422).
- `GET /api/admin/orders/summary` — [admin.ts:445](../server/src/routes/admin.ts#L445).
- `PATCH /api/admin/orders/:id` — [admin.ts:480](../server/src/routes/admin.ts#L480).
- `DELETE /api/admin/orders/:id` — [admin.ts:497](../server/src/routes/admin.ts#L497).
- `GET /api/admin/users` — [admin.ts:515](../server/src/routes/admin.ts#L515).
- `GET /api/admin/search` — [admin.ts:540](../server/src/routes/admin.ts#L540).

### /api/admin/site-settings

- `GET /api/admin/site-settings` — [admin-site-settings.ts:7](../server/src/routes/admin-site-settings.ts#L7).
- `PUT /api/admin/site-settings` — [admin-site-settings.ts:17](../server/src/routes/admin-site-settings.ts#L17).
- `PATCH /api/admin/site-settings` — [admin-site-settings.ts:27](../server/src/routes/admin-site-settings.ts#L27).

### /api/admin/config

- `GET /api/admin/config` — [config.ts:15](../server/src/routes/config.ts#L15).
- `GET /api/admin/config/:namespace/:key` — [config.ts:22](../server/src/routes/config.ts#L22).
- `PUT /api/admin/config` — [config.ts:30](../server/src/routes/config.ts#L30).

### /api/admin/flags

- `GET /api/admin/flags` — [feature-flags.ts:10](../server/src/routes/feature-flags.ts#L10).
- `PUT /api/admin/flags` — [feature-flags.ts:18](../server/src/routes/feature-flags.ts#L18).
- `PATCH /api/admin/flags/:key` — [feature-flags.ts:66](../server/src/routes/feature-flags.ts#L66).

### /api/favorites

- `GET /api/favorites` — [favorites.ts:10](../server/src/routes/favorites.ts#L10).
- `POST /api/favorites/:productId` — [favorites.ts:28](../server/src/routes/favorites.ts#L28).
- `DELETE /api/favorites/:productId` — [favorites.ts:71](../server/src/routes/favorites.ts#L71).
- `GET /api/favorites/check/:productId` — [favorites.ts:96](../server/src/routes/favorites.ts#L96).

### /api/content

- `GET /api/content/blocks` — [content.ts:46](../server/src/routes/content.ts#L46).
- `GET /api/content/blocks/admin` — [content.ts:71](../server/src/routes/content.ts#L71).
- `PUT /api/content/blocks` — [content.ts:84](../server/src/routes/content.ts#L84).
- `PUT /api/content/blocks/bulk` — [content.ts:106](../server/src/routes/content.ts#L106).
- `DELETE /api/content/blocks/:id` — [content.ts:132](../server/src/routes/content.ts#L132).
- `GET /api/content/images` — [content.ts:145](../server/src/routes/content.ts#L145).
- `GET /api/content/images/admin` — [content.ts:168](../server/src/routes/content.ts#L168).
- `POST /api/content/images/upload` — [content.ts:181](../server/src/routes/content.ts#L181).
- `PUT /api/content/images/:id` — [content.ts:224](../server/src/routes/content.ts#L224).
- `DELETE /api/content/images/:id` — [content.ts:241](../server/src/routes/content.ts#L241).
- `GET /api/content/structure` — [content.ts:264](../server/src/routes/content.ts#L264).

### /api/presentations

- `GET /api/presentations` — [presentations.ts:10](../server/src/routes/presentations.ts#L10).
- `GET /api/presentations/:id` — [presentations.ts:57](../server/src/routes/presentations.ts#L57).
- `POST /api/presentations` — [presentations.ts:79](../server/src/routes/presentations.ts#L79).
- `PATCH /api/presentations/:id` — [presentations.ts:121](../server/src/routes/presentations.ts#L121).
- `DELETE /api/presentations/:id` — [presentations.ts:170](../server/src/routes/presentations.ts#L170).

## Integration limits

CORS uses public/admin origins and explicit additional origins; it is not authorization. Cross-origin cookie transport needs the intended HTTPS/browser setup. Frontend clients have separate token selection with a hybrid compatibility client. Filesystem upload persistence, in-memory timers and in-memory limiters require deployment-specific assessment; see [technical overview](CURRENT_TECHNICAL_OVERVIEW.md).

This catalog resolves 82 literal router declarations plus the direct health route. It is not complete runtime OpenAPI and does not claim all domains received a full semantic review.
