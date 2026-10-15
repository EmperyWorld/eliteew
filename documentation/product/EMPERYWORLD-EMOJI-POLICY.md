# Empery World naming and emoji policy (EliteEW)

## Scope

This note captures **layers** for `emperyworld_*` identifiers and a **logging policy for emojis**. Role and schema renames need IdP + app + DB alignment (see migrations, `token_roles.py`, and `api/migrations/pending/`).

## Layer A — Roles, API, storage

- **Keycloak / JWT:** client roles and realm roles may appear under `resource_access` (e.g. `empery-api`, `empery-web`). Role strings are an auth contract; changes need IdP updates and mapping in `shared/api/core/token_roles.py` and frontend role checks.
- **API:** route guards use canonical realm roles (`emperyworld_admin`, `emperyworld_member`, etc.). Former realm role aliases are **ignored** in `collect_token_roles` (not granted and not surfaced in role lists).
- **Storage:** chat-related PostgreSQL tables use `emperyworld_*` names after migration `20260506_rename_brotherhood_tables_to_emperyworld.sql` (Elasticsearch index for document service: `emperyworld_documents`).

## Layer B — Branding and copy

- User-visible strings (desktop labels, marketing) can be updated independently of internal role names when product agrees.

## Layer C — Services and integrations

- External systems that key on old strings: treat as **contract**; document before rename.

## Emoji policy (logs and server output)

- **Prefer structured text** in API and worker logs; avoid emoji in **new** log lines.
- **Existing** lines with emoji: clean up opportunistically when touching a file for other reasons.
- **User-facing UI** may use icons/emojis per design; this policy targets **operator logs**.

## Related

- Keycloak / clients: [platform/docker-re_doc/KEYCLOAK-ELITEEW.md](../platform/docker-re_doc/KEYCLOAK-ELITEEW.md)
- SPA OIDC roles consumption: [FRONTEND-AUTH.md](FRONTEND-AUTH.md)
- Vite client ids: [FRONTEND-ENV.md](FRONTEND-ENV.md)
