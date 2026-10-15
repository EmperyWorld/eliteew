# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression tests for Air edge SG admission and local-first cleanup.
# ---

from __future__ import annotations

import copy
import sys
import tempfile
import time
import unittest
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any

MODULE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MODULE_DIR))

from eliteew_air_enroll_edge import (
    ControllerError,
    EdgeController,
    Settings,
)

SESSION_ID = "123e4567-e89b-12d3-a456-426614174000"
DEDICATED_SG_ID = "sg-air"
BASELINE_SG_ID = "sg-baseline"


class FakeYandex:
    def __init__(self) -> None:
        self.events: list[tuple[str, Any]] = []
        self.next_rule = 1
        self.instance = {
            "id": "edge-instance",
            "folderId": "folder",
            "networkInterfaces": [
                {"securityGroupIds": [BASELINE_SG_ID, DEDICATED_SG_ID]}
            ],
        }
        self.groups = {
            DEDICATED_SG_ID: {
                "id": DEDICATED_SG_ID,
                "name": "eliteew_air_enroll_security_group",
                "status": "ACTIVE",
                "rules": [],
            },
            BASELINE_SG_ID: {
                "id": BASELINE_SG_ID,
                "name": "empery_world_security_group",
                "status": "ACTIVE",
                "rules": [],
            },
        }

    def instance_id(self) -> str:
        return "edge-instance"

    def get_instance(self, instance_id: str) -> dict[str, Any]:
        assert instance_id == "edge-instance"
        return copy.deepcopy(self.instance)

    def list_instances(self, folder_id: str) -> list[dict[str, Any]]:
        assert folder_id == "folder"
        return [copy.deepcopy(self.instance)]

    def get_security_group(self, group_id: str) -> dict[str, Any]:
        return copy.deepcopy(self.groups[group_id])

    def update_rules(
        self,
        security_group_id: str,
        *,
        delete_rule_ids: Iterable[str] = (),
        additions: Iterable[Mapping[str, Any]] = (),
    ) -> None:
        assert security_group_id == DEDICATED_SG_ID
        delete_rule_ids = list(delete_rule_ids)
        rules = self.groups[security_group_id]["rules"]
        if delete_rule_ids:
            self.events.append(("sg_delete", tuple(delete_rule_ids)))
            rules[:] = [
                rule for rule in rules if rule.get("id") not in delete_rule_ids
            ]
        for addition_value in additions:
            addition = dict(addition_value)
            self.events.append(("sg_add", addition["description"]))
            rule = copy.deepcopy(addition)
            rule["id"] = f"rule-{self.next_rule}"
            self.next_rule += 1
            rules.append(rule)


class InMemoryController(EdgeController):
    def __init__(self, settings: Settings, yandex: FakeYandex) -> None:
        super().__init__(settings, yandex)
        self.nft: set[int] = set()
        self.events = yandex.events

    def ensure_nft_contract(self) -> None:
        return

    def listener_ready(self) -> bool:
        return True

    def nft_add(self, port: int, expires_at: int) -> None:
        assert expires_at > int(time.time())
        self.events.append(("nft_add", port))
        self.nft.add(port)

    def nft_delete(self, port: int) -> None:
        self.events.append(("nft_delete", port))
        self.nft.discard(port)

    def nft_ports(self) -> set[int]:
        return set(self.nft)


class EdgeControllerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        temporary_path = Path(self.temporary.name)
        self.settings = Settings(
            security_group_id=DEDICATED_SG_ID,
            expected_security_group_name="eliteew_air_enroll_security_group",
            expected_instance_id="edge-instance",
            network_interface_index=0,
            state_dir=temporary_path / "state",
            lock_path=temporary_path / "controller.lock",
            ingress_port=39443,
            operation_timeout_seconds=30,
            metadata_base="http://metadata.invalid",
            compute_api_base="https://compute.invalid",
            vpc_api_base="https://vpc.invalid",
            operation_api_base="https://operation.invalid",
        )
        self.yandex = FakeYandex()
        self.controller = InMemoryController(self.settings, self.yandex)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def future_expiry(self) -> int:
        return int(time.time()) + 600

    def test_open_and_close_use_exact_rule_and_local_first_cleanup(self) -> None:
        opened = self.controller.open(SESSION_ID, 62273, self.future_expiry())
        self.assertEqual(opened["status"], "ready")
        self.assertIn(62273, self.controller.nft)

        self.yandex.events.clear()
        closed = self.controller.close(SESSION_ID)

        self.assertEqual(closed["status"], "closed")
        self.assertEqual(self.yandex.events[0], ("nft_delete", 62273))
        self.assertEqual(self.yandex.events[1][0], "sg_delete")
        self.assertNotIn(62273, self.controller.nft)
        self.assertEqual(self.yandex.groups[DEDICATED_SG_ID]["rules"], [])

    def test_baseline_tcp_overlap_blocks_admission(self) -> None:
        self.yandex.groups[BASELINE_SG_ID]["rules"] = [
            {
                "id": "broad",
                "direction": "INGRESS",
                "protocolName": "TCP",
                "ports": {"fromPort": "60000", "toPort": "64000"},
                "cidrBlocks": {"v4CidrBlocks": ["0.0.0.0/0"]},
            }
        ]

        with self.assertRaisesRegex(
            ControllerError,
            "overlapping TCP ingress",
        ):
            self.controller.preflight()

    def test_dedicated_group_attached_to_other_instance_is_rejected(self) -> None:
        original_list = self.yandex.list_instances

        def list_with_second_attachment(folder_id: str) -> list[dict[str, Any]]:
            instances = original_list(folder_id)
            other = copy.deepcopy(instances[0])
            other["id"] = "other-instance"
            instances.append(other)
            return instances

        self.yandex.list_instances = list_with_second_attachment  # type: ignore[method-assign]

        with self.assertRaisesRegex(ControllerError, "attached only"):
            self.controller.preflight()

    def test_reconcile_removes_sg_rule_when_local_timeout_is_missing(self) -> None:
        self.controller.open(SESSION_ID, 62999, self.future_expiry())
        self.controller.nft.clear()
        self.yandex.events.clear()

        result = self.controller.reconcile()

        self.assertEqual(result, {"status": "reconciled", "rules_removed": 1})
        self.assertEqual(self.yandex.events[0], ("nft_delete", 62999))
        self.assertEqual(self.yandex.events[1][0], "sg_delete")
        self.assertEqual(self.yandex.groups[DEDICATED_SG_ID]["rules"], [])


if __name__ == "__main__":
    unittest.main()
