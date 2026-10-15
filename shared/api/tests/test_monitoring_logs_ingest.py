import asyncio
import logging

from api.main import ingest_client_logs


def test_monitoring_logs_ingest_logs_stale_bundle_reload_marker(
    caplog,
) -> None:
    payload = {
        "level": "error",
        "serviceName": "StaleBundleReload",
        "message": "RELOAD_MARKER",
        "stage": "reload_all_tabs_internal",
        "reason": "manual_user",
        "clientBuildId": "client-build-1",
        "serverBuildId": "server-build-2",
        "maintenanceActive": False,
        "reloadHoldActive": True,
    }

    with caplog.at_level(logging.WARNING):
        response = asyncio.run(ingest_client_logs(payload))

    assert response == {"ok": True, "received": True}
    messages = [record.getMessage() for record in caplog.records]
    assert any(
        "Client monitoring raw payload:" in message
        and '"serviceName": "StaleBundleReload"' in message
        and '"message": "RELOAD_MARKER"' in message
        and '"stage": "reload_all_tabs_internal"' in message
        and '"reason": "manual_user"' in message
        for message in messages
    )
    assert any(
        "Client log: StaleBundleReload :: RELOAD_MARKER" in message
        and "stage=reload_all_tabs_internal" in message
        and "reason=manual_user" in message
        and "client_build=client-build-1" in message
        and "server_build=server-build-2" in message
        and "maintenance_active=False" in message
        and "reload_hold=True" in message
        for message in messages
    )
