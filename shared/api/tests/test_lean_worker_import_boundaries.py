# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Lock lean-worker import path: site-studio queue boot must not require elasticsearch.
# Related:
# - api/services/business_intelligence/__init__.py
# - api/services/unified_content/processors/__init__.py
# - docker/builders/stack0-api/requirements/site-studio-worker.in
# ---

from __future__ import annotations

import subprocess
import sys


def _assert_clean_import(source: str) -> None:
    # Import-boundary probes must not evict modules held by already-collected tests.
    result = subprocess.run(
        [sys.executable, "-c", "import importlib, sys\n" + source],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_business_intelligence_package_import_does_not_load_elasticsearch() -> None:
    _assert_clean_import(
        "importlib.import_module('api.services.business_intelligence')\n"
        "assert 'api.services.business_intelligence.elasticsearch_service' not in sys.modules\n"
        "assert 'elasticsearch' not in sys.modules\n"
    )


def test_tika_service_import_does_not_require_elasticsearch() -> None:
    _assert_clean_import(
        "mod = importlib.import_module('api.services.business_intelligence.tika_service')\n"
        "assert hasattr(mod, 'TikaService')\n"
        "assert 'elasticsearch' not in sys.modules\n"
    )


def test_processors_base_import_does_not_load_document_processor() -> None:
    _assert_clean_import(
        "importlib.import_module('api.services.unified_content.processors.base')\n"
        "assert 'api.services.unified_content.processors.document_processor' not in sys.modules\n"
    )


def test_site_studio_runtime_helpers_import_without_elasticsearch() -> None:
    """Mirrors site-studio-worker boot in an independent interpreter."""
    _assert_clean_import(
        "importlib.import_module('api.services.site_studio_runtime.helpers')\n"
        "assert 'elasticsearch' not in sys.modules\n"
    )
