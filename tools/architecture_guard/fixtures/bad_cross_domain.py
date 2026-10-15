# Fixture: illegal desktop_client → eliteew_api import without shared contract (must fail Check 1).
from ewa_platform.companion.observability.degrade_log import companion_degrade_debug


def probe() -> None:
    companion_degrade_debug("fixture", "should_not_import")
