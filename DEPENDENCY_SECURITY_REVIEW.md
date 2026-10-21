# BhoomiMitra V1 Dependency Security Review

Review date: 2026-10-21

## Open advisory

The production-dependency audit reports four moderate findings, but they all
originate from one advisory propagated through the dependency tree:

- GitHub advisory: `GHSA-w5hq-g745-h8pq`
- CVE: `CVE-2026-41907`
- npm advisory source ID: `1119441`
- Title: `uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided`
- Direct affected package: `uuid < 11.1.1` (also `12.0.0` and `13.0.0`)
- Installed dependency path:
  `googleapis@144.0.0` -> `googleapis-common@7.2.0` and
  `gaxios@6.7.1` -> `uuid@9.0.1`
- npm's propagated affected ranges:
  `googleapis 33.0.0-149.0.0`, `googleapis-common <=7.2.0`,
  `gaxios 6.4.0-6.7.1`, and `uuid <11.1.1`

The four audit entries are not four independent vulnerabilities.

## Exploit conditions and application relevance

The issue occurs only when `uuid.v3()`, `uuid.v5()`, or `uuid.v6()` is called
with a caller-provided output buffer whose size or offset cannot contain the
full 16-byte UUID. The affected methods can silently perform a partial write.
The advisory explicitly states that `uuid.v4()` performs the required bounds
check and is not affected.

BhoomiMitra does not import or call `uuid`. Inspection of the installed
dependency code found that `gaxios@6.7.1` and
`googleapis-common@7.2.0` call only `uuid.v4()` to create internal multipart
request boundaries. They do not pass a caller-controlled output buffer or
offset. BhoomiMitra's Google integration uses JWT service-account
authentication and Google Sheets v4 metadata/value operations. It does not
expose a multipart/media upload endpoint or pass farmer input to UUID buffer
arguments.

The vulnerable execution condition is therefore not reachable through the
current BhoomiMitra V1 application paths. The residual practical risk for a
restricted pilot is assessed as low, while the dependency scanner finding
remains open and must not be represented as resolved.

## Compatible remediation review

There is no safe patched release inside the current compatible dependency
line:

- `googleapis@144.0.0` is the only published `144.x` release.
- `googleapis-common@7.2.0` is the latest published `7.x` release.
- `gaxios@6.7.1` is the latest published `6.x` release.
- Installing `uuid@11.1.1` directly would not satisfy the transitive
  dependencies' `^9.x` ranges.
- Forcing `uuid@11.1.1` through an override would place an untested major
  version outside those declared ranges and is not approved.
- npm recommends `googleapis@187.0.0`; that is a breaking major upgrade from
  `144.0.0`, changes the supporting dependency line, and requires Node 22 or
  newer. It is outside this V1 Redis integration change.

No dependency version or override was changed by this review.

## Compensating controls

- Application code has no direct `uuid` dependency or UUID buffer API usage.
- Current transitive callers use the unaffected `uuid.v4()` method only.
- Google access is limited to the configured service account and the existing
  Sheets API operations; no public Google media-upload surface is exposed.
- Farmer-controlled webhook content cannot select UUID methods, buffers, or
  offsets.
- The pilot remains restricted, and production dependency audits should be
  monitored for a compatible upstream patch or migration path.

## Recommended remediation

Plan a separate, explicitly approved `googleapis` upgrade with a supported
Node runtime, a committed lockfile, complete automated tests, and authorised
non-production Google Sheets read/write integration tests. Remove this
exception only after a production dependency audit confirms that
`GHSA-w5hq-g745-h8pq` is no longer present.

References:

- https://github.com/advisories/GHSA-w5hq-g745-h8pq
- https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq
- https://github.com/googleapis/gaxios/blob/main/CHANGELOG.md
- https://github.com/googleapis/nodejs-googleapis-common/blob/main/CHANGELOG.md
