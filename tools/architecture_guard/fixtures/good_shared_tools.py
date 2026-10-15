# Fixture: legal eliteew_api → shared/tools neutral import (must pass).
import sys
from pathlib import Path

_shared = Path(__file__).resolve().parents[3] / "shared" / "tools"
if _shared.is_dir():
    sys.path.insert(0, str(_shared))

from i18n_rewriter.stack2_service import admin_meta  # noqa: E402


def probe() -> dict:
    return admin_meta()
