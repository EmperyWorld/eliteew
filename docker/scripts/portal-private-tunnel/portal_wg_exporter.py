#!/usr/bin/env python3
# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Minimal loopback Prometheus exporter for a single WireGuard interface (wg-portal).
# Invariants:
# - Bind address must be 127.0.0.1 (or ::1); refuse 0.0.0.0 / public binds.
# - Interface must be exactly wg-portal; never dump all / wg-mobile / Meet.
# Related:
# - documentation/platform/docker-re_doc/PORTAL-PRIVATE-TUNNEL-EDGE.md
# ---

from __future__ import annotations

import argparse
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


ALLOWED_IFACES = frozenset({"wg-portal"})
ALLOWED_BINDS = frozenset({"127.0.0.1", "::1"})


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="EliteEW portal WireGuard metrics exporter")
    p.add_argument("--listen", default="127.0.0.1")
    p.add_argument("--port", type=int, default=9586)
    p.add_argument("--interface", default="wg-portal")
    return p.parse_args()


def assert_safe(listen: str, iface: str) -> None:
    if listen not in ALLOWED_BINDS:
        raise SystemExit(f"FAIL: listen must be loopback only (got {listen!r})")
    if iface not in ALLOWED_IFACES:
        raise SystemExit(f"FAIL: interface must be wg-portal (got {iface!r})")


def wg_dump(iface: str) -> str:
    # Never pass "all".
    proc = subprocess.run(
        ["wg", "show", iface, "dump"],
        check=False,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"wg show {iface} dump failed: {err}")
    return proc.stdout


def prom_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')


def metrics_text(iface: str) -> str:
    lines_out: list[str] = [
        "# HELP portal_wg_exporter_up 1 if wg dump succeeded",
        "# TYPE portal_wg_exporter_up gauge",
    ]
    try:
        raw = wg_dump(iface)
    except RuntimeError as exc:
        lines_out.append(f'portal_wg_exporter_up{{interface="{iface}"}} 0')
        lines_out.append(f"# error {prom_escape(str(exc))}")
        return "\n".join(lines_out) + "\n"

    lines_out.append(f'portal_wg_exporter_up{{interface="{iface}"}} 1')
    lines_out.extend(
        [
            "# HELP wireguard_sent_bytes Bytes sent to the peer",
            "# TYPE wireguard_sent_bytes counter",
            "# HELP wireguard_received_bytes Bytes received from the peer",
            "# TYPE wireguard_received_bytes counter",
            "# HELP wireguard_latest_handshake_seconds Unix timestamp of latest handshake",
            "# TYPE wireguard_latest_handshake_seconds gauge",
            "# HELP wireguard_peers Number of peers on the interface",
            "# TYPE wireguard_peers gauge",
        ]
    )

    rows = [ln for ln in raw.splitlines() if ln.strip()]
    if not rows:
        lines_out.append(f'wireguard_peers{{interface="{iface}"}} 0')
        return "\n".join(lines_out) + "\n"

    # First line is interface private-key header; peers follow.
    peer_rows = rows[1:]
    lines_out.append(f'wireguard_peers{{interface="{iface}"}} {len(peer_rows)}')
    for row in peer_rows:
        parts = row.split("\t")
        if len(parts) < 7:
            continue
        public_key, _psk, _endpoint, allowed_ips, handshake, rx, tx = parts[:7]
        labels = (
            f'interface="{prom_escape(iface)}",'
            f'public_key="{prom_escape(public_key)}",'
            f'allowed_ips="{prom_escape(allowed_ips)}"'
        )
        lines_out.append(f"wireguard_sent_bytes{{{labels}}} {tx}")
        lines_out.append(f"wireguard_received_bytes{{{labels}}} {rx}")
        lines_out.append(f"wireguard_latest_handshake_seconds{{{labels}}} {handshake}")
    return "\n".join(lines_out) + "\n"


def make_handler(iface: str):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args) -> None:  # noqa: A003
            # Keep journal noise low.
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

        def do_GET(self) -> None:  # noqa: N802
            if self.path.split("?", 1)[0] not in ("/metrics", "/"):
                self.send_response(404)
                self.end_headers()
                return
            body = metrics_text(iface).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return Handler


def main() -> int:
    args = parse_args()
    assert_safe(args.listen, args.interface)
    server = ThreadingHTTPServer((args.listen, args.port), make_handler(args.interface))
    print(
        f"[portal-wg-exporter] listen={args.listen}:{args.port} interface={args.interface}",
        flush=True,
    )
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
