# Fixture: illegal sys.path from desktop_client into pack-cloud (must fail Check 3).
import sys

sys.path.insert(0, "/opt/not-a-checkout/pack-cloud/mobile")

from nonexistent_mobile_mod import probe  # noqa: E402, F401
