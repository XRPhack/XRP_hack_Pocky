# Security and Privacy Checklist

This checklist captures the current MVP privacy boundary for document upload, DID, VC, report, and audit-log flows.

## Sensitive Values That Must Not Be Returned

The API and UI must not expose:

- raw uploaded document bodies
- full foreign registration numbers
- raw document verification codes
- raw QR verification URLs
- organization names from employment/school evidence
- role or program names from employment/school evidence
- phone numbers, emails, IP addresses, and device fingerprints in logs
- issuer seeds, private keys, request secrets, and transaction blobs

## Allowed Derived Values

The following values are safe to return:

- document evidence hashes
- field hashes, such as `foreignRegistrationNumberHash`, `organizationNameHash`, `roleOrProgramHash`
- last 4 digits of a foreign registration number when provided or extracted
- authenticity status/method/summary
- manual review ticket id, queue, reason code, and document hash
- report id, DID service references, VC ids, and public XRPL Testnet hashes

## Current Guardrails

- `sendJson` sanitizes known secret-like keys before writing API responses.
- Document adapters hash or omit raw sensitive document fields.
- Manual review tickets contain only hashes and metadata, not source document content.
- `/api/logs` renders document verification status and reason codes, not raw document fields.
- Uploaded verification results expire after the configured TTL and are removed before signing if stale.
- Re-uploading replaces previous verification results for the same session.

## Test Coverage

The current automated checks cover:

- document adapter output omits raw foreign registration numbers, verification codes, QR URLs, organization names, and role/program names
- upload responses omit raw document values
- sign-and-submit, DID, VC, employment VC, and report responses omit uploaded raw values
- document verification logs omit raw document values across success, manual-review, re-upload, and expiry paths
- issuer credentials, seeds, private keys, request secrets, and transaction blobs are not leaked
- landlord confirmation logs omit landlord PII and device data
- encrypted report storage does not expose plaintext report payloads when `VC_ENCRYPTION_KEY` is configured

## Remaining Production Work

- Replace the local in-memory stores with scoped persistent storage that has encrypted fields and retention controls.
- Add authentication/authorization around issuer and audit-log APIs before any remote deployment.
- Ensure any real OCR provider or manual-review queue stores uploaded originals outside public API responses and returns only ticket metadata.
- Add operational deletion/export workflows for user data requests.
