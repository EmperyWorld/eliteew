# ADR-005: EliteEW adopts MIT

- Status: accepted
- Date: 2026-10-16
- Supersedes: [ADR-003](ADR-003-license-layers.md)

## Decision

At the project owner's request, first-party monorepo software defaults to MIT
unless a file or nearer component license states otherwise. The root LICENSE
contains the complete MIT text with the existing copyright holders; NOTICE,
package metadata, interface labels, and current product documentation use MIT.

Existing MIT grants remain MIT. Third-party code, dependency packages, firmware,
fonts, media, and patches against upstream files retain their own licenses.
The external EmpiierOS repository is outside this decision's scope.
Previously distributed releases retain the licenses delivered with them.

## Consequences

Preserve the MIT copyright and permission notice in copies or substantial
portions of the software. MIT does not require publication of modifications
or corresponding source for a network service. Existing public source links
remain available as project transparency features.

GPL/AGPL dependencies, including html2text and PyMuPDF in the API graph, retain
their own obligations. This decision does not declare combined distributions
MIT-only or replace the dependency compatibility review and release SBOM.
Trademark policy and official hosted service entitlements remain separate.
