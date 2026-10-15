# Thin convenience targets for Site-Edge Carrier + IoT tools.
# Canon: documentation/platform/SITE-EDGE-CARRIER.md

REPO_ROOT := $(abspath ../..)
CARRIER := $(REPO_ROOT)/docker/scripts/site-edge-carrier-deploy.sh
IOT_PROVISION := $(REPO_ROOT)/docker/scripts/site-edge-iot-provision.sh
IOT_VERIFY := $(REPO_ROOT)/docker/scripts/site-edge-iot-verify.sh

.PHONY: help carrier-dry-run carrier iot-verify

help:
	@echo "make carrier SLUG=demo CONTENT_DIR=/path/to/dist SITE_EDGE_SSH=siteedge@host"
	@echo "make carrier-dry-run SLUG=demo CONTENT_DIR=/path/to/dist"
	@echo "make iot-verify EDGE_HOST=192.168.1.x"

carrier-dry-run:
	@test -n "$(SLUG)" || (echo "SLUG required" >&2; exit 1)
	@test -n "$(CONTENT_DIR)" || (echo "CONTENT_DIR required" >&2; exit 1)
	bash "$(CARRIER)" --slug "$(SLUG)" --content-dir "$(CONTENT_DIR)" --dry-run --yes

carrier:
	@test -n "$(SLUG)" || (echo "SLUG required" >&2; exit 1)
	@test -n "$(CONTENT_DIR)" || (echo "CONTENT_DIR required" >&2; exit 1)
	@test -n "$(SITE_EDGE_SSH)" || (echo "SITE_EDGE_SSH required" >&2; exit 1)
	SITE_EDGE_SSH="$(SITE_EDGE_SSH)" bash "$(CARRIER)" --slug "$(SLUG)" --content-dir "$(CONTENT_DIR)" --yes

iot-verify:
	@test -n "$(EDGE_HOST)" || (echo "EDGE_HOST required" >&2; exit 1)
	bash "$(IOT_VERIFY)" --host "$(EDGE_HOST)"
