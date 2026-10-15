from __future__ import annotations
import argparse
import asyncio
import json
import shutil
import sys
import types
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast
from uuid import uuid4

def _stub_minio_module() -> None:
    if 'minio' in sys.modules:
        return
    module = types.ModuleType('minio')
    module.__path__ = []
    error_module = types.ModuleType('minio.error')
    sseconfig_module = types.ModuleType('minio.sseconfig')

    class _DummyMinio:

        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

    class _DummyS3Error(Exception):
        pass

    class _DummyRule:

        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

    class _DummySSEConfig:

        def __init__(self, *args: object, **kwargs: object) -> None:
            pass
    minio_stub = cast(Any, module)
    minio_stub.Minio = _DummyMinio
    error_stub = cast(Any, error_module)
    error_stub.S3Error = _DummyS3Error
    sse_stub = cast(Any, sseconfig_module)
    sse_stub.Rule = _DummyRule
    sse_stub.SSEConfig = _DummySSEConfig
    sys.modules['minio'] = module
    sys.modules['minio.error'] = error_module
    sys.modules['minio.sseconfig'] = sseconfig_module
_stub_minio_module()
from api.core.http_clients import close_http_clients, init_http_clients
from api.services.site_studio_runtime_service import build_site_studio_internal_api_base_url, build_site_studio_internal_public_url, get_site_studio_runtime_manager, resolve_site_studio_template_root

def _build_instance(slug: str) -> SimpleNamespace:
    return SimpleNamespace(id=uuid4(), user_id=uuid4(), site_slug=slug, template_key='olenti', site_title='Neutral Provision Smoke', public_hostname=f'{slug}-site.eliteew.ru', admin_email=f'admin+{slug}@site-studio.local', admin_password_encrypted=None, compose_project_name=None, compose_file_path=None, api_base_url=None, public_url=None, ports_json={}, runtime_dir=None, db_name=None)

def _assert_staged_neutral_markers(runtime_dir: Path) -> None:
    source = runtime_dir / 'source'
    routes = (source / 'src' / 'constants' / 'routes.ts').read_text(encoding='utf-8')
    assert 'SHOP_CATALOG' in routes and '/shop/catalog' in routes
    content_routes = (source / 'server' / 'src' / 'routes' / 'content.ts').read_text(encoding='utf-8')
    assert 'value_block' in content_routes and 'aromatherapy' in content_routes
    products = (source / 'server' / 'products.json').read_text(encoding='utf-8')
    assert 'starter' in products and 'signature' in products
    assert 'perfume' not in products.lower()

async def _run_prepare_only(*, slug: str | None) -> int:
    template_root = resolve_site_studio_template_root('olenti')
    if not template_root.exists():
        print(f'ERROR: olenti template root missing: {template_root}', file=sys.stderr)
        return 1
    chosen_slug = slug or f'neutral-prepare-{uuid4().hex[:8]}'
    instance = _build_instance(chosen_slug)
    manager = get_site_studio_runtime_manager()
    layout = manager._layout(instance)
    print(f'[provision-smoke] prepare-only slug={chosen_slug} template={template_root}')
    try:
        metadata, _password = manager._prepare_runtime_files(instance, force_refresh_source=True)
        compose_text = Path(metadata['compose_file_path']).read_text(encoding='utf-8')
        if 'networks:' not in compose_text or 'eliteew-shared:' not in compose_text:
            print('ERROR: compose missing required networks', file=sys.stderr)
            return 1
        _assert_staged_neutral_markers(layout.runtime_dir)
        print(f"[provision-smoke] prepare-only OK runtime_dir={metadata.get('runtime_dir')}")
        return 0
    finally:
        if layout.runtime_dir.exists():
            shutil.rmtree(layout.runtime_dir, ignore_errors=True)
            print(f'[provision-smoke] prepare-only cleanup slug={chosen_slug}')

async def _run_full_smoke(*, keep: bool, slug: str | None) -> int:
    template_root = resolve_site_studio_template_root('olenti')
    if not template_root.exists():
        print(f'ERROR: olenti template root missing: {template_root}', file=sys.stderr)
        return 1
    chosen_slug = slug or f'neutral-smoke-{uuid4().hex[:8]}'
    instance = _build_instance(chosen_slug)
    manager = get_site_studio_runtime_manager()
    exit_code = 1
    print(f'[provision-smoke] slug={chosen_slug} template={template_root}')
    await init_http_clients()
    try:
        metadata = await manager.provision(instance, force_refresh_source=True)
        for key in ('public_url', 'api_base_url', 'compose_project_name', 'runtime_mode'):
            print(f'[provision-smoke] {key}={metadata.get(key)}')
        compose_project_name = str(metadata.get('compose_project_name') or '')
        instance.compose_project_name = compose_project_name
        instance.compose_file_path = metadata.get('compose_file_path')
        instance.public_url = metadata.get('public_url')
        instance.api_base_url = metadata.get('api_base_url')
        instance.ports_json = metadata.get('ports_json') or {}
        health = await manager.health(instance)
        print(f'[provision-smoke] health={json.dumps(health, ensure_ascii=False)}')
        if not health.get('api_ok') or not health.get('public_ok'):
            print('ERROR: runtime health check failed', file=sys.stderr)
            return 1
        import httpx
        internal_public = build_site_studio_internal_public_url(compose_project_name) or str(metadata.get('public_url') or '')
        internal_api = build_site_studio_internal_api_base_url(compose_project_name) or str(metadata.get('api_base_url') or '')
        client = httpx.AsyncClient(timeout=30.0)
        try:
            storefront = await client.get(f"{internal_public.rstrip('/')}/shop/catalog")
            legacy = await client.get(f"{internal_public.rstrip('/')}/shop/perfumes")
            blocks = await client.get(f"{internal_api.rstrip('/')}/content/blocks?page=home&section=value_block")
            print(f'[provision-smoke] GET /shop/catalog -> {storefront.status_code}; /shop/perfumes -> {legacy.status_code}; value_block blocks -> {blocks.status_code}')
            if storefront.status_code >= 400 or legacy.status_code >= 400:
                print('ERROR: storefront route smoke failed', file=sys.stderr)
                return 1
            if blocks.status_code >= 400:
                print('ERROR: value_block content API smoke failed', file=sys.stderr)
                return 1
            payload = blocks.json()
            block_sections = {item.get('section') for item in payload.get('data', [])}
            if block_sections and 'value_block' not in block_sections and ('aromatherapy' not in block_sections):
                print(f'ERROR: unexpected sections in value_block response: {block_sections}', file=sys.stderr)
                return 1
        finally:
            await client.aclose()
        print('[provision-smoke] OK')
        exit_code = 0
        return exit_code
    finally:
        await close_http_clients()
        if keep:
            print(f'[provision-smoke] --keep: runtime left at slug={chosen_slug}')
        else:
            print(f'[provision-smoke] cleanup slug={chosen_slug}')
            await manager.destroy(instance, preserve_runtime_data=False)

def main() -> int:
    parser = argparse.ArgumentParser(description='Site Studio olenti provision smoke')
    parser.add_argument('--keep', action='store_true', help='Do not destroy runtime after smoke')
    parser.add_argument('--prepare-only', action='store_true', help='Only stage template + compose (no podman up); for host CI without ew_net_6211')
    parser.add_argument('--slug', default=None, help='Fixed site slug (default: neutral-smoke-<random>)')
    args = parser.parse_args()
    if args.prepare_only:
        return asyncio.run(_run_prepare_only(slug=args.slug))
    return asyncio.run(_run_full_smoke(keep=args.keep, slug=args.slug))
if __name__ == '__main__':
    raise SystemExit(main())
