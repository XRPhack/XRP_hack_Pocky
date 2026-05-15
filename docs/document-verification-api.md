# Document Verification API Contract

This document describes the local MVP contract for uploaded visa and employment or school documents. It is not a public government API integration. The current implementation accepts user-uploaded evidence, extracts safe fields, stores only sanitized verification output in memory, and uses that output to build DID/VC/report data.

## Endpoint

`POST /api/verification-documents`

The endpoint verifies one or both uploaded documents for the current session. A session can be provided with any of these mechanisms:

- `x-session-id` header
- `sessionId` request body field
- `sessionId` query parameter
- `Authorization: Bearer <sessionId>`

If no session is available, `subjectId` is required. Session-backed uploads are preferred because later `POST /api/sign-and-submit` reads the verification result by session id.

## Supported Files

Each document payload is a JSON object:

```json
{
  "filename": "foreign-registration.json",
  "mimeType": "application/json",
  "base64": "eyJ2aXNhVHlwZSI6IkUtOSJ9"
}
```

Supported MIME types:

- `application/json`
- `text/plain`
- `application/pdf`
- `image/png`
- `image/jpeg`

Current behavior:

- JSON and plain text can be parsed directly.
- Text-based PDF is parsed with a lightweight text extractor.
- Scanned PDFs and image-only PDFs usually return `review-needed`.
- PNG/JPEG are accepted by the API shape but are treated as manual-review/OCR cases in this MVP.
- The tenant UI blocks files larger than 5 MB before upload.

## Request Body

```json
{
  "sessionId": "sess_abc123",
  "subjectId": "tenant_mina_p",
  "visaDocument": {
    "filename": "foreign-registration.json",
    "mimeType": "application/json",
    "base64": "..."
  },
  "employmentDocument": {
    "filename": "employment.json",
    "mimeType": "application/json",
    "base64": "..."
  }
}
```

Fields:

| Field | Required | Description |
| --- | --- | --- |
| `sessionId` | Recommended | Session that later links the verification result to signing/report creation. |
| `subjectId` | Required if no session | Stable local subject id. |
| `visaDocument` | Optional | Uploaded visa or foreign-registration evidence. |
| `employmentDocument` | Optional | Uploaded employment, insurance, pension, or school evidence. |

At least one of `visaDocument` or `employmentDocument` must be present.

## Parsed Visa Fields

JSON fields or text key/value equivalents:

```json
{
  "documentType": "foreign-registration-certificate",
  "subjectId": "tenant_mina_p",
  "visaType": "E-9",
  "nationality": "Kyrgyzstan",
  "expiresAt": "2027-11-30T00:00:00.000Z",
  "issuedAt": "2026-05-01T00:00:00.000Z",
  "issuer": "Ministry of Justice Mock",
  "foreignRegistrationNumber": "900101-5123456",
  "foreignRegistrationNumberLast4": "3456",
  "documentVerificationCode": "MOJ-2027-API",
  "qrVerificationUrl": "https://verify.example.test/visa/abc"
}
```

Only safe derived values are returned. Full foreign registration numbers are hashed or reduced to last 4 digits. Raw `documentVerificationCode` and raw `qrVerificationUrl` are not returned.

## Parsed Employment/School Fields

```json
{
  "documentType": "employment-confirmation",
  "subjectId": "tenant_mina_p",
  "verificationChannel": "school",
  "organizationName": "Busan Technical College",
  "roleOrProgram": "International Welding Program",
  "acquiredAt": "2025-03-01T00:00:00.000Z",
  "lostAt": null,
  "issuedAt": "2026-05-01T00:00:00.000Z",
  "issuer": "School Mock Registry",
  "documentVerificationCode": "SCH-2027-API",
  "qrVerificationUrl": "https://verify.example.test/employment/abc"
}
```

Supported `verificationChannel` values:

- `employment-insurance`
- `health-insurance`
- `national-pension`
- `school`

`organizationName` and `roleOrProgram` are hashed in verification output.

## Success Response

HTTP `201`

```json
{
  "ok": true,
  "verificationId": "sess_abc123",
  "subjectId": "tenant_mina_p",
  "status": "verified",
  "retention": {
    "expiresAt": "2026-05-15T14:30:00.000Z",
    "ttlMs": 1800000,
    "replacedPrevious": false
  },
  "reviewReasons": [],
  "visa": {
    "success": true,
    "source": "uploaded-document:foreign-registration-certificate",
    "verifiedAt": "2026-05-15T14:00:00.000Z",
    "evidenceHash": "sha256...",
    "data": {
      "subjectId": "tenant_mina_p",
      "visaType": "E-9",
      "nationality": "Kyrgyzstan",
      "expiryStatus": "valid",
      "verified": true,
      "issuer": "Ministry of Justice Mock",
      "expiresAt": "2027-11-30T00:00:00.000Z",
      "foreignRegistrationNumberLast4": "3456",
      "foreignRegistrationNumberHash": "hash...",
      "authenticity": {
        "status": "ready",
        "method": "document-code",
        "verificationCodeHash": "hash...",
        "summary": "Document verification code is present; external authenticity check is ready."
      },
      "summary": "Uploaded visa document has a future expiry date."
    }
  },
  "employment": {
    "success": true,
    "source": "uploaded-document:employment",
    "verifiedAt": "2026-05-15T14:00:00.000Z",
    "evidenceHash": "sha256...",
    "data": {
      "subjectId": "tenant_mina_p",
      "verificationChannel": "school",
      "status": "verified",
      "issuer": "School Mock Registry",
      "acquiredAt": "2025-03-01T00:00:00.000Z",
      "organizationNameHash": "hash...",
      "roleOrProgramHash": "hash...",
      "authenticity": {
        "status": "ready",
        "method": "qr-url",
        "qrVerificationUrlHash": "hash...",
        "summary": "QR verification URL is present; external authenticity check is ready."
      },
      "summary": "Uploaded employment document shows an active status."
    }
  }
}
```

## Review Needed Response

HTTP `201`

The API returns `201` even when the upload needs review because the upload was accepted and evaluated. Credential issuance is paused by the tenant wizard when `status !== "verified"`.

```json
{
  "ok": true,
  "verificationId": "sess_abc123",
  "subjectId": "tenant_mina_p",
  "status": "review-needed",
  "retention": {
    "expiresAt": "2026-05-15T14:30:00.000Z",
    "ttlMs": 1800000,
    "replacedPrevious": true
  },
  "reviewReasons": [
    {
      "kind": "visa",
      "code": "parse-failed",
      "title": "Visa document could not be read.",
      "message": "Only JSON, text, or text-based PDF documents are supported in this MVP.",
      "action": "Upload JSON, plain text, or a text-based PDF. Scanned images and image-only PDFs need manual review or OCR first."
    },
    {
      "kind": "employment",
      "code": "authenticity-missing",
      "title": "Employment authenticity check is incomplete.",
      "message": "No document verification code or QR verification URL was found.",
      "action": "Upload a version that includes a document verification code, issue number, or QR verification URL."
    }
  ]
}
```

Review reason codes:

| Code | Meaning | Expected user action |
| --- | --- | --- |
| `parse-failed` | The file could not be parsed. Common for images or image-only PDFs. | Upload JSON, plain text, or text-based PDF, or route to OCR/manual review. |
| `verification-failed` | Parsed fields did not satisfy business rules. | Upload a current visa or active employment/school evidence. |
| `authenticity-missing` | No document verification code, issue number, or QR verification URL was found. | Upload a version that includes a verification code or QR URL. |

## Authenticity Object

`authenticity` is safe metadata, not a live government authenticity check.

```json
{
  "status": "ready",
  "method": "document-code",
  "verificationCodeHash": "hash...",
  "summary": "Document verification code is present; external authenticity check is ready."
}
```

Possible values:

| Field | Values |
| --- | --- |
| `status` | `ready`, `not-checked`, `failed` |
| `method` | `document-code`, `qr-url`, `missing` |

Raw verification codes and raw QR URLs are intentionally omitted from all API responses, logs, VC payloads, and DID documents.

## Retention and Re-upload Policy

Uploaded verification output is stored in memory by session id.

- Default TTL: 30 minutes.
- Override for tests/local runs: `DOCUMENT_VERIFICATION_TTL_MS`.
- Re-uploading with the same session id replaces the previous verification result.
- `retention.replacedPrevious` indicates whether an earlier result was replaced.
- Expired verification data is deleted and is not used by `POST /api/sign-and-submit`.

If data expires before signing, the report is still generated from fallback/default inputs, but `documentVerification` and `authenticityChecks` are absent.

## Audit Logs

Document verification emits `document.verification` events through `GET /api/logs`.

Log-safe details include:

- `verificationId`
- `status`
- `documentKinds`
- `reviewReasonCount`
- `reviewReasons`
- `retentionTtlMinutes`
- `replacedPrevious`
- `expiresAt`

The logs summary includes:

```json
{
  "summary": {
    "documentVerification": {
      "total": 2,
      "validated": 1,
      "reviewNeeded": 1,
      "expired": 0
    }
  }
}
```

Logs must not contain raw document bodies, raw foreign registration numbers, raw document verification codes, QR verification URLs, phone numbers, emails, IP addresses, private keys, or seeds.

## Error Responses

The endpoint returns HTTP `400` for malformed API usage:

| Code | When |
| --- | --- |
| `SESSION_OR_SUBJECT_REQUIRED` | No session and no `subjectId`. |
| `DOCUMENT_REQUIRED` | Neither `visaDocument` nor `employmentDocument` is present or valid. |
| `BAD_REQUEST` | Request body is not valid JSON or another unexpected parsing error escapes route handling. |

General error shape:

```json
{
  "ok": false,
  "error": {
    "code": "DOCUMENT_REQUIRED",
    "message": "Upload at least one visaDocument or employmentDocument."
  }
}
```

## Downstream Use

`POST /api/sign-and-submit` reads the latest non-expired session verification result.

When available, uploaded document verification affects:

- visa/employment badge status in the public report
- `report.authenticityChecks`
- stored DID service references
- stored VC credential subjects
- VC evidence hashes

The downstream payloads contain only sanitized values and hashes, never uploaded document originals.
