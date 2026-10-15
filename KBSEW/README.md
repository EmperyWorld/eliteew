# KBSEW — knowledge ingestion and retrieval service

KBSEW is a standalone FastAPI application. It manages knowledge barrels, durable ingestion jobs, asset revisions and vector search. It is separate from the shared API even though both Python packages are named `api`; select the working directory and import path deliberately.

## Implementation and dependencies

[Bootstrap](api/main.py) creates the PostgreSQL pool and runs the ingestion worker during application lifespan. Database schema provisioning uses the checked-in application SQL migrations; bootstrap does not apply them. [The worker](api/services/ingestion_worker.py) claims PostgreSQL queue rows with `FOR UPDATE SKIP LOCKED`. Ingest endpoints enqueue durable jobs rather than performing indexing inside the request.

- PostgreSQL stores metadata and jobs under the `kbsew` schema.
- [Qdrant](api/services/qdrant_store.py) stores barrel vector collections.
- [The MinIO client](api/services/object_store.py) accesses S3-compatible raw-file storage; the compose deployment uses SeaweedFS.
- [PDF processing](api/drivers/pdf.py) calls the stack4 Tika/OCR path. [Embeddings](api/services/embedding_client.py) come from a configured remote service.
- [Revision services](api/services/revision_service.py) and [search](api/services/search_service.py) distinguish indexed asset/pipeline revisions and stale data.

The [lazy registry](api/drivers/registry.py) currently includes `pdf`, `markdown`, `code_python` and `code_typescript`. [BaseIngestionDriver](api/drivers/base.py) defines URL validation, metadata extraction, chunking and indexing; `BytesUploadDriver` describes upload support. A new driver must satisfy the actual interface and be registered. A hypothetical `web_scrape` driver is not implemented.

## HTTP interfaces

[Barrel routes](api/routers/barrels.py), [search](api/routers/search.py), [barrel DTOs](api/schemas/barrels.py) and [search DTOs](api/schemas/search.py) are the source contract. The [registered route catalog](../documentation/api/REGISTERED-ROUTES.md) contains all 14 static route traces, including three service probes.

Under `/api/v1/kbsew`, the service provides driver listing; barrel listing/creation/deletion/enabling; URL and multipart upload ingestion; barrel/asset force reindexing; barrel status; and semantic search. URL ingestion uses a validated `source_url`; upload uses multipart fields from the handler signature. Reindex endpoints return HTTP 202. Barrel creation returns 201; successful deletion returns 204. The [HTTP reference](../documentation/api/SOURCE-HTTP-REFERENCE.md) explains search fields, responses and errors.

[Authentication](api/core/auth.py) accepts Keycloak JWTs with `admin` or `emperyworld_admin` for administration. Read dependencies also accept a matching `X-KBSEW-Service-Token`. Mutation dependencies permit service-token writes only when `KBSEW_SERVICE_CAN_MUTATE=true`; this applies to deletion/reindexing too. The service principal is not an admin JWT. Keep the flag disabled unless the caller is intended to receive those privileges.

`/health` is liveness. `/ready` checks PostgreSQL, Qdrant and the S3 bucket and returns HTTP 503 on degraded readiness; it does not test OCR, embedding or a complete ingestion transaction. `/metrics` exports Prometheus metrics. The shared API has a separate authenticated [KBSEW gateway](../shared/api/routers/kbsew_gateway.py); reaching the gateway is not equivalent to direct service authentication.

## Configuration and local development

[Settings](api/core/config.py) load environment variables, with no automatic dotenv file. [The dependency list](requirements.txt) uses lower bounds rather than an exact lock. The [container](Dockerfile) uses Python 3.12 and starts `uvicorn api.main:app` on port 8030.

For an isolated local environment, from the repository root:

```bash
cd KBSEW
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
# Supply settings and reachable dependency services before starting.
.venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8030
```

Commands were checked against source; dependency installation and service startup were not executed during the documentation audit. Tests under [tests/](tests/) need their test tooling in addition to runtime requirements.

Use the redacted [environment template](../docker/env_file/.env.kbsew.example) to identify PostgreSQL, Qdrant, S3, Keycloak, embedding, chunk/upload limits and worker settings. Do not copy live secret values into documentation. The compose file [kbsew.yml](../docker/stack/kbsew.yml) maps the service/container environment and host port. Creating an env file alone does not provision dependency services, external networks or schema permissions.

## Deployment and operations

The repository deployment policy builds on command-center and runs production on prod-core. Use [the deployment helper](../docker/scripts/kbsew-deploy-prod-core.sh), [the infrastructure guide](../documentation/platform/INFRASTRUCTURE-SOURCE-GUIDE.md) and [topology state](../documentation/platform/PRODUCTION-TOPOLOGY-STATE.md) for an operator-approved rollout. No deployment or migration was performed in this audit.

The Unified Admin Shell has a `kbsew` section; see [KBSEW product documentation](../documentation/product/KBSEW.md) and [admin shell](../documentation/platform/UNIFIED-ADMIN-SHELL.md). The product document is a separate, detailed contract that still requires a full semantic review; this README validates the service entry points, not every UI/operational claim.
