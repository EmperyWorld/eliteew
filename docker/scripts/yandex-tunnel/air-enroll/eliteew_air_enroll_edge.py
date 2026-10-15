#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fail-closed edge controller for one-shot Air enrollment SG and nft leases.
# ---

from __future__ import annotations

import argparse
import contextlib
import dataclasses
import fcntl
import hashlib
import ipaddress
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any, NoReturn

PORT_MIN = 62200
PORT_MAX = 63200
INGRESS_PORT = 39443
MAX_SECURITY_GROUPS_PER_NIC = 5
MAX_RULES_PER_SECURITY_GROUP = 50
RULE_PREFIX = "air-enroll"
RULE_PATTERN = re.compile(
    r"^air-enroll:(?P<session>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-"
    r"[0-9a-f]{4}-[0-9a-f]{12}):(?P<expires>[0-9]{10})$"
)
NFT_FAMILY = "inet"
NFT_TABLE = "eliteew_air_enroll"
NFT_SET = "active_ports"
DEFAULT_STATE_DIR = Path("/var/lib/eliteew-air-enroll")
DEFAULT_LOCK_PATH = Path("/run/lock/eliteew-air-enroll.lock")
METADATA_BASE = "http://169.254.169.254/computeMetadata/v1/instance"
COMPUTE_API_BASE = "https://compute.api.cloud.yandex.net/compute/v1"
VPC_API_BASE = "https://vpc.api.cloud.yandex.net/vpc/v1"
OPERATION_API_BASE = "https://operation.api.cloud.yandex.net"


class ControllerError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclasses.dataclass(frozen=True)
class Settings:
    security_group_id: str
    expected_security_group_name: str
    expected_instance_id: str | None
    network_interface_index: int
    state_dir: Path
    lock_path: Path
    ingress_port: int
    operation_timeout_seconds: int
    metadata_base: str
    compute_api_base: str
    vpc_api_base: str
    operation_api_base: str

    @classmethod
    def from_environment(cls) -> Settings:
        security_group_id = os.environ.get("ELITEEW_AIR_ENROLL_SG_ID", "").strip()
        if not security_group_id:
            raise ControllerError(
                "config_missing",
                "ELITEEW_AIR_ENROLL_SG_ID is required",
            )
        expected_name = os.environ.get(
            "ELITEEW_AIR_ENROLL_SG_NAME",
            "eliteew_air_enroll_security_group",
        ).strip()
        if expected_name != "eliteew_air_enroll_security_group":
            raise ControllerError(
                "config_invalid",
                "dedicated security group name must be eliteew_air_enroll_security_group",
            )
        expected_instance_id = (
            os.environ.get("ELITEEW_AIR_ENROLL_INSTANCE_ID", "").strip() or None
        )
        try:
            interface_index = int(
                os.environ.get("ELITEEW_AIR_ENROLL_NIC_INDEX", "0")
            )
            ingress_port = int(
                os.environ.get(
                    "ELITEEW_AIR_ENROLL_INGRESS_PORT",
                    str(INGRESS_PORT),
                )
            )
            operation_timeout = int(
                os.environ.get("ELITEEW_AIR_ENROLL_OPERATION_TIMEOUT", "90")
            )
        except ValueError as exc:
            raise ControllerError(
                "config_invalid",
                "numeric edge configuration is invalid",
            ) from exc
        if interface_index < 0:
            raise ControllerError(
                "config_invalid",
                "network interface index must be non-negative",
            )
        if ingress_port != INGRESS_PORT:
            raise ControllerError(
                "config_invalid",
                f"isolated ingress port must remain {INGRESS_PORT}",
            )
        if not 15 <= operation_timeout <= 300:
            raise ControllerError(
                "config_invalid",
                "operation timeout must be between 15 and 300 seconds",
            )
        return cls(
            security_group_id=security_group_id,
            expected_security_group_name=expected_name,
            expected_instance_id=expected_instance_id,
            network_interface_index=interface_index,
            state_dir=Path(
                os.environ.get(
                    "ELITEEW_AIR_ENROLL_STATE_DIR",
                    str(DEFAULT_STATE_DIR),
                )
            ),
            lock_path=Path(
                os.environ.get(
                    "ELITEEW_AIR_ENROLL_LOCK_PATH",
                    str(DEFAULT_LOCK_PATH),
                )
            ),
            ingress_port=ingress_port,
            operation_timeout_seconds=operation_timeout,
            metadata_base=os.environ.get(
                "ELITEEW_AIR_ENROLL_METADATA_BASE",
                METADATA_BASE,
            ).rstrip("/"),
            compute_api_base=os.environ.get(
                "ELITEEW_AIR_ENROLL_COMPUTE_API_BASE",
                COMPUTE_API_BASE,
            ).rstrip("/"),
            vpc_api_base=os.environ.get(
                "ELITEEW_AIR_ENROLL_VPC_API_BASE",
                VPC_API_BASE,
            ).rstrip("/"),
            operation_api_base=os.environ.get(
                "ELITEEW_AIR_ENROLL_OPERATION_API_BASE",
                OPERATION_API_BASE,
            ).rstrip("/"),
        )


@dataclasses.dataclass(frozen=True)
class ManagedRule:
    rule_id: str
    session_id: str
    port: int
    expires_at: int


@dataclasses.dataclass
class Lease:
    session_id: str
    port: int
    expires_at: int
    rule_id: str | None
    phase: str
    updated_at: int
    closed_at: int | None = None

    @classmethod
    def from_json(cls, payload: Mapping[str, Any]) -> Lease:
        session_id = validate_session_id(payload.get("session_id"))
        port = validate_port(payload.get("port"))
        expires_at = validate_epoch(payload.get("expires_at"), allow_past=True)
        rule_id_value = payload.get("rule_id")
        rule_id = rule_id_value if isinstance(rule_id_value, str) else None
        phase_value = payload.get("phase")
        if phase_value not in {
            "ready",
            "local_closed",
            "cleanup_degraded",
            "closed",
        }:
            raise ControllerError("state_invalid", "lease phase is invalid")
        updated_at = payload.get("updated_at")
        closed_at = payload.get("closed_at")
        if not isinstance(updated_at, int):
            raise ControllerError("state_invalid", "lease updated_at is invalid")
        if closed_at is not None and not isinstance(closed_at, int):
            raise ControllerError("state_invalid", "lease closed_at is invalid")
        return cls(
            session_id=session_id,
            port=port,
            expires_at=expires_at,
            rule_id=rule_id,
            phase=phase_value,
            updated_at=updated_at,
            closed_at=closed_at,
        )


class YandexClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._token: str | None = None

    def metadata_text(self, path: str) -> str:
        request = urllib.request.Request(
            f"{self.settings.metadata_base}/{path.lstrip('/')}",
            headers={"Metadata-Flavor": "Google"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.read(65536).decode("utf-8").strip()
        except (urllib.error.URLError, TimeoutError, UnicodeDecodeError) as exc:
            raise ControllerError(
                "metadata_unavailable",
                "Yandex instance metadata is unavailable",
            ) from exc

    def instance_id(self) -> str:
        instance_id = self.metadata_text("id")
        if not instance_id or len(instance_id) > 128:
            raise ControllerError(
                "metadata_invalid",
                "Yandex metadata returned an invalid instance id",
            )
        return instance_id

    def iam_token(self) -> str:
        if self._token is not None:
            return self._token
        raw = self.metadata_text("service-accounts/default/token")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ControllerError(
                "metadata_invalid",
                "Yandex metadata returned an invalid service-account token response",
            ) from exc
        token = payload.get("access_token")
        if not isinstance(token, str) or len(token) < 32:
            raise ControllerError(
                "metadata_invalid",
                "attached service account did not provide an IAM token",
            )
        self._token = token
        return token

    def request_json(
        self,
        method: str,
        url: str,
        body: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        data = None
        headers = {
            "Authorization": f"Bearer {self.iam_token()}",
            "Accept": "application/json",
        }
        if body is not None:
            data = json.dumps(body, separators=(",", ":")).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(
            url,
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                raw = response.read(1024 * 1024)
        except urllib.error.HTTPError as exc:
            message = f"Yandex API returned HTTP {exc.code}"
            with contextlib.suppress(json.JSONDecodeError, UnicodeDecodeError):
                error_payload = json.loads(exc.read(16384).decode("utf-8"))
                detail = error_payload.get("message")
                if isinstance(detail, str) and detail:
                    message = f"{message}: {detail[:200]}"
            raise ControllerError("yandex_api_failed", message) from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise ControllerError(
                "yandex_api_unavailable",
                "Yandex API request failed",
            ) from exc
        try:
            payload = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ControllerError(
                "yandex_api_invalid",
                "Yandex API returned invalid JSON",
            ) from exc
        if not isinstance(payload, dict):
            raise ControllerError(
                "yandex_api_invalid",
                "Yandex API response must be an object",
            )
        return payload

    def get_instance(self, instance_id: str) -> dict[str, Any]:
        encoded = urllib.parse.quote(instance_id, safe="")
        return self.request_json(
            "GET",
            f"{self.settings.compute_api_base}/instances/{encoded}",
        )

    def list_instances(self, folder_id: str) -> list[dict[str, Any]]:
        instances: list[dict[str, Any]] = []
        page_token: str | None = None
        while True:
            query: dict[str, str] = {
                "folderId": folder_id,
                "pageSize": "1000",
            }
            if page_token:
                query["pageToken"] = page_token
            payload = self.request_json(
                "GET",
                f"{self.settings.compute_api_base}/instances?"
                f"{urllib.parse.urlencode(query)}",
            )
            page = payload.get("instances", [])
            if not isinstance(page, list):
                raise ControllerError(
                    "yandex_api_invalid",
                    "instance list is invalid",
                )
            instances.extend(item for item in page if isinstance(item, dict))
            next_token = payload.get("nextPageToken")
            if not isinstance(next_token, str) or not next_token:
                break
            page_token = next_token
        return instances

    def get_security_group(self, security_group_id: str) -> dict[str, Any]:
        encoded = urllib.parse.quote(security_group_id, safe="")
        return self.request_json(
            "GET",
            f"{self.settings.vpc_api_base}/securityGroups/{encoded}",
        )

    def update_rules(
        self,
        security_group_id: str,
        *,
        delete_rule_ids: Iterable[str] = (),
        additions: Iterable[Mapping[str, Any]] = (),
    ) -> None:
        encoded = urllib.parse.quote(security_group_id, safe="")
        operation = self.request_json(
            "PATCH",
            f"{self.settings.vpc_api_base}/securityGroups/{encoded}/rules",
            {
                "deletionRuleIds": list(delete_rule_ids),
                "additionRuleSpecs": list(additions),
            },
        )
        operation_id = operation.get("id")
        if not isinstance(operation_id, str) or not operation_id:
            raise ControllerError(
                "yandex_api_invalid",
                "security-group update did not return an operation id",
            )
        deadline = time.monotonic() + self.settings.operation_timeout_seconds
        while True:
            current = self.request_json(
                "GET",
                f"{self.settings.operation_api_base}/operations/"
                f"{urllib.parse.quote(operation_id, safe='')}",
            )
            if current.get("done") is True:
                error = current.get("error")
                if isinstance(error, dict):
                    detail = error.get("message")
                    message = (
                        detail[:200]
                        if isinstance(detail, str) and detail
                        else "Yandex operation failed"
                    )
                    raise ControllerError("yandex_operation_failed", message)
                return
            if time.monotonic() >= deadline:
                raise ControllerError(
                    "yandex_operation_timeout",
                    "Yandex security-group operation timed out",
                )
            time.sleep(1)


def validate_session_id(value: Any) -> str:
    if not isinstance(value, str):
        raise ControllerError("input_invalid", "session id must be a string")
    try:
        parsed = uuid.UUID(value)
    except (ValueError, AttributeError) as exc:
        raise ControllerError("input_invalid", "session id is invalid") from exc
    canonical = str(parsed)
    if value != canonical:
        raise ControllerError(
            "input_invalid",
            "session id must use canonical lowercase UUID form",
        )
    return canonical


def validate_port(value: Any) -> int:
    if isinstance(value, bool):
        raise ControllerError("input_invalid", "port is invalid")
    try:
        port = int(value)
    except (TypeError, ValueError) as exc:
        raise ControllerError("input_invalid", "port is invalid") from exc
    if not PORT_MIN <= port <= PORT_MAX:
        raise ControllerError(
            "input_invalid",
            f"port must be between {PORT_MIN} and {PORT_MAX}",
        )
    return port


def validate_epoch(value: Any, *, allow_past: bool = False) -> int:
    if isinstance(value, bool):
        raise ControllerError("input_invalid", "expiry is invalid")
    try:
        expires_at = int(value)
    except (TypeError, ValueError) as exc:
        raise ControllerError("input_invalid", "expiry is invalid") from exc
    now = int(time.time())
    if not allow_past and not now + 15 <= expires_at <= now + 900:
        raise ControllerError(
            "input_invalid",
            "expiry must be 15 to 900 seconds in the future",
        )
    if expires_at < 0 or expires_at > 9_999_999_999:
        raise ControllerError("input_invalid", "expiry is out of range")
    return expires_at


def rule_ports(rule: Mapping[str, Any]) -> tuple[int, int]:
    ports = rule.get("ports")
    if not isinstance(ports, Mapping):
        return 0, 65535
    try:
        start = int(ports.get("fromPort", 0))
        end = int(ports.get("toPort", start))
    except (TypeError, ValueError) as exc:
        raise ControllerError(
            "security_group_invalid",
            "security-group rule has invalid ports",
        ) from exc
    if not 0 <= start <= end <= 65535:
        raise ControllerError(
            "security_group_invalid",
            "security-group rule port range is invalid",
        )
    return start, end


def is_ingress_tcp(rule: Mapping[str, Any]) -> bool:
    direction = str(rule.get("direction", "")).upper()
    protocol_name = str(rule.get("protocolName", "")).upper()
    protocol_number = str(rule.get("protocolNumber", ""))
    return direction == "INGRESS" and (
        protocol_name in {"TCP", "ANY"}
        or protocol_number in {"6", "-1"}
        or (not protocol_name and not protocol_number)
    )


def overlaps(start: int, end: int, wanted_start: int, wanted_end: int) -> bool:
    return start <= wanted_end and wanted_start <= end


def parse_managed_rule(rule: Mapping[str, Any]) -> ManagedRule | None:
    description = rule.get("description")
    rule_id = rule.get("id")
    if not isinstance(description, str) or not isinstance(rule_id, str):
        return None
    match = RULE_PATTERN.fullmatch(description)
    if match is None or not is_ingress_tcp(rule):
        return None
    start, end = rule_ports(rule)
    if start != end or not PORT_MIN <= start <= PORT_MAX:
        raise ControllerError(
            "security_group_invalid",
            "managed Air rule has an invalid port range",
        )
    cidr_blocks = rule.get("cidrBlocks")
    if not isinstance(cidr_blocks, Mapping):
        raise ControllerError(
            "security_group_invalid",
            "managed Air rule has no CIDR target",
        )
    if cidr_blocks.get("v4CidrBlocks") != ["0.0.0.0/0"]:
        raise ControllerError(
            "security_group_invalid",
            "managed Air rule has an unexpected source",
        )
    return ManagedRule(
        rule_id=rule_id,
        session_id=match.group("session"),
        port=start,
        expires_at=int(match.group("expires")),
    )


def managed_description(session_id: str, expires_at: int) -> str:
    return f"{RULE_PREFIX}:{session_id}:{expires_at}"


def validate_global_ip(value: str) -> bool:
    try:
        return ipaddress.ip_address(value).is_global
    except ValueError:
        return False


class EdgeController:
    def __init__(
        self,
        settings: Settings,
        yandex: YandexClient | None = None,
    ) -> None:
        self.settings = settings
        self.yandex = yandex or YandexClient(settings)
        self.leases_dir = settings.state_dir / "leases"

    @contextlib.contextmanager
    def locked(self) -> Iterable[None]:
        self.settings.lock_path.parent.mkdir(parents=True, exist_ok=True)
        with self.settings.lock_path.open("a+", encoding="utf-8") as lock_file:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            yield

    def log(self, event: str, **fields: Any) -> None:
        safe_fields = {
            key: value
            for key, value in fields.items()
            if key
            in {
                "session_id",
                "port",
                "expires_at",
                "rule_id",
                "count",
                "phase",
            }
        }
        print(
            json.dumps(
                {
                    "component": "eliteew_air_enroll_edge",
                    "event": event,
                    **safe_fields,
                },
                separators=(",", ":"),
                sort_keys=True,
            ),
            file=sys.stderr,
        )

    def lease_path(self, session_id: str) -> Path:
        digest = hashlib.sha256(session_id.encode("ascii")).hexdigest()
        return self.leases_dir / f"{digest}.json"

    def write_lease(self, lease: Lease) -> None:
        self.leases_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        payload = dataclasses.asdict(lease)
        fd, temporary_name = tempfile.mkstemp(
            prefix=".lease-",
            dir=self.leases_dir,
        )
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, separators=(",", ":"), sort_keys=True)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_name, self.lease_path(lease.session_id))
        except BaseException:
            with contextlib.suppress(FileNotFoundError):
                Path(temporary_name).unlink()
            raise

    def read_lease(self, session_id: str) -> Lease | None:
        path = self.lease_path(session_id)
        try:
            raw = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return None
        except OSError as exc:
            raise ControllerError("state_unavailable", "cannot read lease state") from exc
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ControllerError("state_invalid", "lease state is not JSON") from exc
        if not isinstance(payload, dict):
            raise ControllerError("state_invalid", "lease state must be an object")
        lease = Lease.from_json(payload)
        if lease.session_id != session_id:
            raise ControllerError("state_invalid", "lease identity mismatch")
        return lease

    def all_leases(self) -> dict[str, Lease]:
        leases: dict[str, Lease] = {}
        if not self.leases_dir.exists():
            return leases
        for path in self.leases_dir.glob("*.json"):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                if not isinstance(payload, dict):
                    raise TypeError("not an object")
                lease = Lease.from_json(payload)
            except (
                OSError,
                json.JSONDecodeError,
                TypeError,
                ControllerError,
            ) as exc:
                raise ControllerError(
                    "state_invalid",
                    f"invalid lease state file {path.name}",
                ) from exc
            expected_name = f"{hashlib.sha256(lease.session_id.encode('ascii')).hexdigest()}.json"
            if path.name != expected_name:
                raise ControllerError(
                    "state_invalid",
                    "lease filename identity mismatch",
                )
            leases[lease.session_id] = lease
        return leases

    def run_nft(
        self,
        arguments: list[str],
        *,
        check: bool = True,
    ) -> subprocess.CompletedProcess[str]:
        try:
            return subprocess.run(
                ["nft", *arguments],
                check=check,
                capture_output=True,
                text=True,
                timeout=10,
            )
        except FileNotFoundError as exc:
            raise ControllerError("nft_unavailable", "nft is not installed") from exc
        except subprocess.TimeoutExpired as exc:
            raise ControllerError("nft_failed", "nft command timed out") from exc
        except subprocess.CalledProcessError as exc:
            raise ControllerError("nft_failed", "nft command failed") from exc

    def ensure_nft_contract(self) -> None:
        self.run_nft(["list", "set", NFT_FAMILY, NFT_TABLE, NFT_SET])

    def nft_add(self, port: int, expires_at: int) -> None:
        timeout_seconds = max(1, expires_at - int(time.time()))
        self.nft_delete(port)
        self.run_nft(
            [
                "add",
                "element",
                NFT_FAMILY,
                NFT_TABLE,
                NFT_SET,
                f"{{ {port} timeout {timeout_seconds}s }}",
            ]
        )

    def nft_delete(self, port: int) -> None:
        self.run_nft(
            [
                "delete",
                "element",
                NFT_FAMILY,
                NFT_TABLE,
                NFT_SET,
                f"{{ {port} }}",
            ],
            check=False,
        )

    def nft_ports(self) -> set[int]:
        result = self.run_nft(
            ["-j", "list", "set", NFT_FAMILY, NFT_TABLE, NFT_SET]
        )
        try:
            payload = json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            raise ControllerError("nft_failed", "nft returned invalid JSON") from exc
        ports: set[int] = set()
        entries = payload.get("nftables", []) if isinstance(payload, dict) else []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            set_payload = entry.get("set")
            if not isinstance(set_payload, dict):
                continue
            for element in set_payload.get("elem", []):
                value: Any = element
                if isinstance(element, dict):
                    nested = element.get("elem", element)
                    value = nested.get("val") if isinstance(nested, dict) else nested
                try:
                    port = int(value)
                except (TypeError, ValueError):
                    continue
                if PORT_MIN <= port <= PORT_MAX:
                    ports.add(port)
        return ports

    def listener_ready(self) -> bool:
        try:
            with socket.create_connection(
                ("127.0.0.1", self.settings.ingress_port),
                timeout=1,
            ):
                return True
        except OSError:
            return False

    def current_context(
        self,
    ) -> tuple[str, dict[str, Any], list[str], dict[str, dict[str, Any]]]:
        instance_id = self.yandex.instance_id()
        if (
            self.settings.expected_instance_id is not None
            and instance_id != self.settings.expected_instance_id
        ):
            raise ControllerError(
                "instance_mismatch",
                "controller is not running on the configured edge instance",
            )
        instance = self.yandex.get_instance(instance_id)
        interfaces = instance.get("networkInterfaces")
        if not isinstance(interfaces, list) or not (
            0 <= self.settings.network_interface_index < len(interfaces)
        ):
            raise ControllerError(
                "instance_invalid",
                "configured edge network interface does not exist",
            )
        interface = interfaces[self.settings.network_interface_index]
        if not isinstance(interface, dict):
            raise ControllerError("instance_invalid", "edge network interface is invalid")
        attached = interface.get("securityGroupIds")
        if not isinstance(attached, list) or not all(
            isinstance(item, str) for item in attached
        ):
            raise ControllerError(
                "instance_invalid",
                "edge network interface security groups are invalid",
            )
        if self.settings.security_group_id not in attached:
            raise ControllerError(
                "security_group_detached",
                "dedicated Air security group is not attached to the edge NIC",
            )
        if len(attached) > MAX_SECURITY_GROUPS_PER_NIC:
            raise ControllerError(
                "security_group_invalid",
                "edge NIC exceeds the supported security-group count",
            )
        groups = {
            group_id: self.yandex.get_security_group(group_id)
            for group_id in attached
        }
        return instance_id, instance, attached, groups

    def audit_security_groups(
        self,
    ) -> tuple[dict[str, Any], list[ManagedRule], int]:
        instance_id, instance, attached, groups = self.current_context()
        dedicated = groups[self.settings.security_group_id]
        if dedicated.get("name") != self.settings.expected_security_group_name:
            raise ControllerError(
                "security_group_mismatch",
                "configured security group has an unexpected name",
            )
        if dedicated.get("status") != "ACTIVE":
            raise ControllerError(
                "security_group_busy",
                "dedicated Air security group is not ACTIVE",
            )
        folder_id = instance.get("folderId")
        if not isinstance(folder_id, str) or not folder_id:
            raise ControllerError("instance_invalid", "edge instance folder id is missing")
        attachments: list[tuple[str, int]] = []
        for candidate in self.yandex.list_instances(folder_id):
            candidate_id = candidate.get("id")
            interfaces = candidate.get("networkInterfaces", [])
            if not isinstance(candidate_id, str) or not isinstance(interfaces, list):
                continue
            for index, interface in enumerate(interfaces):
                if not isinstance(interface, dict):
                    continue
                group_ids = interface.get("securityGroupIds", [])
                if (
                    isinstance(group_ids, list)
                    and self.settings.security_group_id in group_ids
                ):
                    attachments.append((candidate_id, index))
        expected_attachment = (instance_id, self.settings.network_interface_index)
        if attachments != [expected_attachment]:
            raise ControllerError(
                "security_group_shared",
                "dedicated Air security group must be attached only to the canonical edge NIC",
            )

        managed: list[ManagedRule] = []
        for group_id in attached:
            group = groups[group_id]
            rules = group.get("rules", [])
            if not isinstance(rules, list):
                raise ControllerError(
                    "security_group_invalid",
                    "security-group rules are invalid",
                )
            for rule in rules:
                if not isinstance(rule, dict) or not is_ingress_tcp(rule):
                    continue
                start, end = rule_ports(rule)
                if group_id == self.settings.security_group_id:
                    parsed = parse_managed_rule(rule)
                    if parsed is not None:
                        managed.append(parsed)
                        continue
                if overlaps(start, end, PORT_MIN, PORT_MAX) or overlaps(
                    start,
                    end,
                    self.settings.ingress_port,
                    self.settings.ingress_port,
                ):
                    raise ControllerError(
                        "security_group_overlap",
                        "an attached security group has an overlapping TCP ingress rule",
                    )
        rules = dedicated.get("rules", [])
        assert isinstance(rules, list)
        available_rules = MAX_RULES_PER_SECURITY_GROUP - len(rules)
        if available_rules < 0:
            raise ControllerError(
                "security_group_capacity",
                "dedicated Air security group exceeds its rule limit",
            )
        return dedicated, managed, available_rules

    def preflight(self) -> dict[str, Any]:
        with self.locked():
            self.ensure_nft_contract()
            if not self.listener_ready():
                raise ControllerError(
                    "ingress_unavailable",
                    "isolated Air TLS ingress is not listening",
                )
            _, managed, available_rules = self.audit_security_groups()
            return {
                "status": "ready",
                "available_rules": available_rules,
                "managed_rules": len(managed),
                "port_min": PORT_MIN,
                "port_max": PORT_MAX,
            }

    def addition_spec(
        self,
        session_id: str,
        port: int,
        expires_at: int,
    ) -> dict[str, Any]:
        return {
            "description": managed_description(session_id, expires_at),
            "direction": "INGRESS",
            "ports": {
                "fromPort": str(port),
                "toPort": str(port),
            },
            "protocolName": "TCP",
            "cidrBlocks": {"v4CidrBlocks": ["0.0.0.0/0"]},
        }

    def get_new_rule(
        self,
        session_id: str,
        port: int,
        expires_at: int,
    ) -> ManagedRule:
        group = self.yandex.get_security_group(self.settings.security_group_id)
        if group.get("status") != "ACTIVE":
            raise ControllerError(
                "security_group_busy",
                "dedicated Air security group did not return to ACTIVE",
            )
        matches: list[ManagedRule] = []
        rules = group.get("rules", [])
        if not isinstance(rules, list):
            raise ControllerError(
                "security_group_invalid",
                "security-group rules are invalid",
            )
        for rule in rules:
            if not isinstance(rule, dict):
                continue
            parsed = parse_managed_rule(rule)
            if (
                parsed is not None
                and parsed.session_id == session_id
                and parsed.port == port
                and parsed.expires_at == expires_at
            ):
                matches.append(parsed)
        if len(matches) != 1:
            raise ControllerError(
                "security_group_readback_failed",
                "exact Air security-group rule was not read back",
            )
        return matches[0]

    def open(self, session_value: Any, port_value: Any, expiry_value: Any) -> dict[str, Any]:
        session_id = validate_session_id(session_value)
        port = validate_port(port_value)
        expires_at = validate_epoch(expiry_value)
        with self.locked():
            self.ensure_nft_contract()
            if not self.listener_ready():
                raise ControllerError(
                    "ingress_unavailable",
                    "isolated Air TLS ingress is not listening",
                )
            _, managed, available_rules = self.audit_security_groups()
            leases = self.all_leases()
            for other in leases.values():
                if (
                    other.session_id != session_id
                    and other.port == port
                    and other.phase == "ready"
                    and other.expires_at > int(time.time())
                ):
                    raise ControllerError(
                        "port_conflict",
                        "port is already owned by another live lease",
                    )
            for rule in managed:
                if rule.session_id != session_id and rule.port == port:
                    raise ControllerError(
                        "port_conflict",
                        "port is already owned by another security-group rule",
                    )

            existing = [rule for rule in managed if rule.session_id == session_id]
            if (
                len(existing) == 1
                and existing[0].port == port
                and existing[0].expires_at == expires_at
            ):
                rule = existing[0]
            else:
                if existing:
                    self.nft_delete(existing[0].port)
                    self.yandex.update_rules(
                        self.settings.security_group_id,
                        delete_rule_ids=[rule.rule_id for rule in existing],
                    )
                if available_rules < 1 and not existing:
                    raise ControllerError(
                        "security_group_capacity",
                        "dedicated Air security group has no free rule slot",
                    )
                self.yandex.update_rules(
                    self.settings.security_group_id,
                    additions=[self.addition_spec(session_id, port, expires_at)],
                )
                rule = self.get_new_rule(session_id, port, expires_at)

            lease = Lease(
                session_id=session_id,
                port=port,
                expires_at=expires_at,
                rule_id=rule.rule_id,
                phase="ready",
                updated_at=int(time.time()),
            )
            self.write_lease(lease)
            try:
                self.nft_add(port, expires_at)
            except ControllerError:
                lease.phase = "cleanup_degraded"
                lease.updated_at = int(time.time())
                self.write_lease(lease)
                with contextlib.suppress(ControllerError):
                    self.yandex.update_rules(
                        self.settings.security_group_id,
                        delete_rule_ids=[rule.rule_id],
                    )
                raise
            self.log(
                "lease_ready",
                session_id=session_id,
                port=port,
                expires_at=expires_at,
                rule_id=rule.rule_id,
            )
            return {
                "status": "ready",
                "session_id": session_id,
                "port": port,
                "expires_at": expires_at,
                "rule_id": rule.rule_id,
            }

    def close_locked(self, session_id: str) -> dict[str, Any]:
        lease = self.read_lease(session_id)
        if lease is not None:
            self.nft_delete(lease.port)
            lease.phase = "local_closed"
            lease.updated_at = int(time.time())
            self.write_lease(lease)

        _, managed, _ = self.audit_security_groups()
        rules = [rule for rule in managed if rule.session_id == session_id]
        if lease is None and not rules:
            return {"status": "closed", "session_id": session_id, "already_closed": True}
        if lease is None:
            for rule in rules:
                self.nft_delete(rule.port)

        stored_rule_id = lease.rule_id if lease is not None else None
        if stored_rule_id is not None:
            delete_ids = [stored_rule_id]
            unexpected = [rule.rule_id for rule in rules if rule.rule_id != stored_rule_id]
            if unexpected:
                if lease is not None:
                    lease.phase = "cleanup_degraded"
                    lease.updated_at = int(time.time())
                    self.write_lease(lease)
                raise ControllerError(
                    "security_group_duplicate",
                    "unexpected duplicate Air rule requires reconcile",
                )
        else:
            delete_ids = [rule.rule_id for rule in rules]

        try:
            if delete_ids:
                self.yandex.update_rules(
                    self.settings.security_group_id,
                    delete_rule_ids=delete_ids,
                )
            group = self.yandex.get_security_group(self.settings.security_group_id)
            remaining_ids = {
                str(rule.get("id"))
                for rule in group.get("rules", [])
                if isinstance(rule, dict)
            }
            if any(rule_id in remaining_ids for rule_id in delete_ids):
                raise ControllerError(
                    "security_group_readback_failed",
                    "Air security-group rule remains after deletion",
                )
        except ControllerError:
            if lease is not None:
                lease.phase = "cleanup_degraded"
                lease.updated_at = int(time.time())
                self.write_lease(lease)
            self.log("cleanup_degraded", session_id=session_id)
            raise

        if lease is not None:
            lease.rule_id = None
            lease.phase = "closed"
            lease.updated_at = int(time.time())
            lease.closed_at = lease.updated_at
            self.write_lease(lease)
        self.log("lease_closed", session_id=session_id)
        return {"status": "closed", "session_id": session_id}

    def close(self, session_value: Any) -> dict[str, Any]:
        session_id = validate_session_id(session_value)
        with self.locked():
            self.ensure_nft_contract()
            return self.close_locked(session_id)

    def reconcile(self) -> dict[str, Any]:
        now = int(time.time())
        with self.locked():
            self.ensure_nft_contract()
            leases = self.all_leases()
            nft_ports = self.nft_ports()
            for lease in leases.values():
                if lease.phase != "ready" or lease.expires_at <= now:
                    self.nft_delete(lease.port)
                    nft_ports.discard(lease.port)

            _, managed, _ = self.audit_security_groups()
            rules_by_session = {rule.session_id: rule for rule in managed}

            delete_ids: list[str] = []
            for rule in managed:
                lease = leases.get(rule.session_id)
                valid = (
                    lease is not None
                    and lease.phase == "ready"
                    and lease.port == rule.port
                    and lease.rule_id == rule.rule_id
                    and lease.expires_at == rule.expires_at
                    and lease.expires_at > now
                    and rule.port in nft_ports
                )
                if not valid:
                    self.nft_delete(rule.port)
                    delete_ids.append(rule.rule_id)
                    if lease is not None:
                        lease.phase = "local_closed"
                        lease.updated_at = now
                        self.write_lease(lease)

            for port in nft_ports:
                owner = next(
                    (
                        lease
                        for lease in leases.values()
                        if lease.port == port
                        and lease.phase == "ready"
                        and lease.expires_at > now
                    ),
                    None,
                )
                if owner is None or owner.session_id not in rules_by_session:
                    self.nft_delete(port)

            if delete_ids:
                try:
                    self.yandex.update_rules(
                        self.settings.security_group_id,
                        delete_rule_ids=delete_ids,
                    )
                except ControllerError:
                    for lease in leases.values():
                        if lease.rule_id in delete_ids:
                            lease.phase = "cleanup_degraded"
                            lease.updated_at = now
                            self.write_lease(lease)
                    raise

            group = self.yandex.get_security_group(self.settings.security_group_id)
            remaining = {
                str(rule.get("id"))
                for rule in group.get("rules", [])
                if isinstance(rule, dict)
            }
            if any(rule_id in remaining for rule_id in delete_ids):
                raise ControllerError(
                    "security_group_readback_failed",
                    "reconciled Air rules remain in the security group",
                )

            for lease in leases.values():
                if lease.rule_id in delete_ids:
                    lease.rule_id = None
                    lease.phase = "closed"
                    lease.updated_at = now
                    lease.closed_at = now
                    self.write_lease(lease)
                if (
                    lease.phase == "closed"
                    and lease.closed_at is not None
                    and lease.closed_at < now - 86400
                ):
                    with contextlib.suppress(FileNotFoundError):
                        self.lease_path(lease.session_id).unlink()

            self.log("reconciled", count=len(delete_ids))
            return {
                "status": "reconciled",
                "rules_removed": len(delete_ids),
            }


def run_selftest() -> dict[str, Any]:
    session_id = "123e4567-e89b-12d3-a456-426614174000"
    assert validate_session_id(session_id) == session_id
    assert validate_port(PORT_MIN) == PORT_MIN
    assert overlaps(62000, 62200, PORT_MIN, PORT_MAX)
    assert not overlaps(1, 443, PORT_MIN, PORT_MAX)
    rule = {
        "id": "rule-id",
        "description": managed_description(session_id, 2_000_000_000),
        "direction": "INGRESS",
        "ports": {"fromPort": str(PORT_MIN), "toPort": str(PORT_MIN)},
        "protocolName": "TCP",
        "cidrBlocks": {"v4CidrBlocks": ["0.0.0.0/0"]},
    }
    parsed = parse_managed_rule(rule)
    assert parsed is not None
    assert parsed.session_id == session_id
    assert parsed.port == PORT_MIN
    assert validate_global_ip("93.77.165.185")
    assert not validate_global_ip("10.77.77.2")
    return {"status": "selftest_ok"}


def emit(payload: Mapping[str, Any]) -> None:
    print(json.dumps(payload, separators=(",", ":"), sort_keys=True))


def fail(error: ControllerError) -> NoReturn:
    emit({"status": "error", "code": error.code, "message": error.message})
    raise SystemExit(1)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="EliteEW Air enrollment edge controller",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("selftest")
    subparsers.add_parser("preflight")
    open_parser = subparsers.add_parser("open")
    open_parser.add_argument("session_id")
    open_parser.add_argument("port")
    open_parser.add_argument("expires_at")
    close_parser = subparsers.add_parser("close")
    close_parser.add_argument("session_id")
    subparsers.add_parser("reconcile")
    return parser


def main() -> None:
    arguments = build_parser().parse_args()
    try:
        if arguments.command == "selftest":
            emit(run_selftest())
            return
        settings = Settings.from_environment()
        controller = EdgeController(settings)
        if arguments.command == "preflight":
            emit(controller.preflight())
        elif arguments.command == "open":
            emit(
                controller.open(
                    arguments.session_id,
                    arguments.port,
                    arguments.expires_at,
                )
            )
        elif arguments.command == "close":
            emit(controller.close(arguments.session_id))
        elif arguments.command == "reconcile":
            emit(controller.reconcile())
        else:
            raise ControllerError("input_invalid", "unsupported command")
    except ControllerError as exc:
        fail(exc)


if __name__ == "__main__":
    main()
