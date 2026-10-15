# Host selection for eliteew-cc-block-tld-refresh (no network).
from __future__ import annotations

import re


def blocked_tld_hosts_from_metalink(xml: str, zones: list[str]) -> list[str]:
    hosts: set[str] = set()
    for m in re.finditer(r"<url[^>]*>([^<]+)</url>", xml, re.I):
        u = m.group(1).strip()
        m2 = re.match(r"https?://([^/:]+)", u)
        if not m2:
            continue
        h = m2.group(1).lower()
        for z in zones:
            if h == z or h.endswith("." + z):
                hosts.add(h)
                break
    return sorted(hosts)


SAMPLE = """
<metalink>
  <url location="UA">https://mirror.shared.net/fedora/</url>
  <url location="DE">https://mirror.de.example/fedora/</url>
  <url location="UA">https://dl.real.ua/fedora/</url>
  <url>https://ftp.other.ua/path</url>
</metalink>
"""


def test_only_ua_tld_not_location_ua() -> None:
    got = blocked_tld_hosts_from_metalink(SAMPLE, ["ua"])
    assert got == ["dl.real.ua", "ftp.other.ua"]
    assert "mirror.shared.net" not in got
