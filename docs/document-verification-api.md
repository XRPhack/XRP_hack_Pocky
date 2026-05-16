# 문서 검증 API 계약

이 문서는 비자, 고용 또는 재학 문서 업로드를 처리하는 로컬 MVP API 계약을 설명합니다. 이 API는 공공기관의 공식 조회 API가 아닙니다. 현재 구현은 사용자가 업로드한 증빙에서 안전하게 공개 가능한 필드만 추출하고, 정제된 검증 결과만 메모리에 저장한 뒤, 그 결과를 DID/VC/리포트 데이터 생성에 사용합니다.

## 엔드포인트

`POST /api/verification-documents`

이 엔드포인트는 현재 세션에 대해 업로드된 문서 하나 또는 두 개를 검증합니다. 세션은 다음 방식 중 하나로 전달할 수 있습니다.

- `x-session-id` 헤더
- 요청 본문의 `sessionId` 필드
- 쿼리 파라미터 `sessionId`
- `Authorization: Bearer <sessionId>`

세션이 없으면 `subjectId`가 필요합니다. 이후 `POST /api/sign-and-submit`은 명시된 세션 ID로 검증 결과를 읽기 때문에, 세션 기반 업로드를 권장합니다. 서버는 최신 세션을 자동으로 재사용하지 않습니다.

## 지원 파일

각 문서 payload는 JSON 객체입니다.

```json
{
  "filename": "foreign-registration.json",
  "mimeType": "application/json",
  "base64": "eyJ2aXNhVHlwZSI6IkUtOSJ9"
}
```

지원 MIME 타입:

- `application/json`
- `text/plain`
- `application/pdf`
- `image/png`
- `image/jpeg`

현재 동작:

- JSON과 일반 텍스트는 직접 파싱할 수 있습니다.
- 텍스트 기반 PDF는 경량 텍스트 추출기로 파싱합니다.
- 스캔 PDF와 이미지 전용 PDF는 보통 `review-needed`를 반환합니다.
- PNG/JPEG는 API 형식상 허용하지만, 이 MVP에서는 수동 검토/OCR 대상으로 처리합니다.
- 임차인 UI는 업로드 전에 5 MB를 초과하는 파일을 차단합니다.

## 요청 본문

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

필드:

| 필드 | 필수 여부 | 설명 |
| --- | --- | --- |
| `sessionId` | 권장 | 이후 서명/리포트 생성 단계에서 검증 결과를 연결하는 세션입니다. |
| `subjectId` | 세션이 없을 때 필수 | 로컬에서 안정적으로 사용하는 subject ID입니다. |
| `visaDocument` | 선택 | 업로드된 비자 또는 외국인등록 관련 증빙입니다. |
| `employmentDocument` | 선택 | 업로드된 고용, 보험, 연금 또는 재학 증빙입니다. |

`visaDocument` 또는 `employmentDocument` 중 최소 하나는 있어야 합니다.

## 파싱되는 비자 필드

JSON 필드 또는 텍스트 key/value에 대응되는 값입니다.

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

응답에는 안전하게 가공된 값만 포함됩니다. 전체 외국인등록번호는 해시 처리하거나 마지막 4자리로 축약합니다. 원본 `documentVerificationCode`와 원본 `qrVerificationUrl`은 반환하지 않습니다.

## 파싱되는 고용/재학 필드

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

지원되는 `verificationChannel` 값:

- `employment-insurance`
- `health-insurance`
- `national-pension`
- `school`

검증 결과에서 `organizationName`과 `roleOrProgram`은 해시 처리됩니다.

## 성공 응답

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

예시 JSON 안의 `summary`, `title`, `message`, `action` 값은 현재 구현에서 반환하는 영문 메시지를 그대로 보여줍니다.

## 검토 필요 응답

HTTP `201`

업로드가 검토 필요 상태여도 API는 `201`을 반환합니다. 파일을 접수하고 평가했기 때문입니다. 임차인 wizard는 `status !== "verified"`일 때 Credential 발급을 중단합니다.

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
      "action": "Upload JSON, plain text, or a text-based PDF. Scanned images and image-only PDFs need manual review or OCR first.",
      "manualReview": {
        "id": "0d2f3d7f9f7d63c1b60e218f",
        "kind": "visa",
        "status": "not-configured",
        "queue": "ocr",
        "reasonCode": "parse-failed",
        "documentHash": "hash...",
        "createdAt": "2026-05-15T14:00:00.000Z",
        "summary": "Only JSON, text, or text-based PDF documents are supported in this MVP."
      }
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

검토 사유 코드:

| 코드 | 의미 | 사용자가 해야 할 일 |
| --- | --- | --- |
| `parse-failed` | 파일을 파싱할 수 없습니다. 이미지 또는 이미지 전용 PDF에서 흔합니다. | JSON, 일반 텍스트, 텍스트 기반 PDF를 업로드하거나 OCR/수동 검토로 넘깁니다. |
| `verification-failed` | 파싱된 필드가 비즈니스 규칙을 만족하지 않습니다. | 유효한 비자 또는 활성 고용/재학 증빙을 업로드합니다. |
| `authenticity-missing` | 문서 검증 코드, 발급 번호 또는 QR 검증 URL을 찾지 못했습니다. | 검증 코드 또는 QR URL이 포함된 문서를 업로드합니다. |

## OCR 및 수동 검토 확장 지점

현재 MVP는 OCR을 실행하지 않고 운영자 승인 큐도 제공하지 않습니다. 대신 각 검토 사유에는 향후 OCR/수동 검토 어댑터가 사용할 수 있는 안전한 `manualReview` 티켓이 포함될 수 있습니다.

```json
{
  "id": "0d2f3d7f9f7d63c1b60e218f",
  "kind": "visa",
  "status": "not-configured",
  "queue": "ocr",
  "reasonCode": "parse-failed",
  "documentHash": "hash...",
  "createdAt": "2026-05-15T14:00:00.000Z",
  "summary": "PDF text could not be extracted without an OCR/PDF parser."
}
```

티켓 필드:

| 필드 | 값 |
| --- | --- |
| `status` | 로컬 MVP에서는 `not-configured`, 실제 큐 어댑터에서는 `queued` |
| `queue` | PDF/이미지 후보는 `ocr`, 비즈니스 규칙 또는 진위 확인 검토는 `manual-review` |
| `reasonCode` | 상위 검토 사유와 같은 코드 |

확장 인터페이스는 `src/domain/adapters/document-review.ts`에 있습니다.

- `DocumentReviewQueueAdapter`
- `DocumentManualReviewRequest`
- `DocumentManualReviewTicket`
- `noopDocumentReviewQueueAdapter`

운영용 OCR 또는 운영 큐는 `DocumentReviewQueueAdapter.enqueue`를 구현해야 합니다. 이 어댑터는 업로드 원본을 API 응답 외부에 저장하고, 안전한 티켓 ID, 큐 메타데이터, 사유 코드, 문서 해시만 반환해야 합니다. 원문 텍스트, 이미지 바이트, QR URL, 검증 코드는 티켓에 포함하면 안 됩니다.

## 진위 확인 객체

`authenticity`는 안전한 메타데이터이며, 실시간 정부 진위 확인 결과가 아닙니다.

```json
{
  "status": "ready",
  "method": "document-code",
  "verificationCodeHash": "hash...",
  "summary": "Document verification code is present; external authenticity check is ready."
}
```

가능한 값:

| 필드 | 값 |
| --- | --- |
| `status` | `ready`, `not-checked`, `failed` |
| `method` | `document-code`, `qr-url`, `missing` |

원본 검증 코드와 원본 QR URL은 모든 API 응답, 로그, VC payload, DID 문서에서 의도적으로 제외합니다.

## 보관 및 재업로드 정책

업로드 검증 결과는 세션 ID 기준으로 메모리에 저장됩니다.

- 기본 TTL: 30분
- 테스트/로컬 실행용 override: `DOCUMENT_VERIFICATION_TTL_MS`
- 같은 세션 ID로 재업로드하면 이전 검증 결과를 대체합니다.
- `retention.replacedPrevious`는 이전 결과가 대체되었는지 나타냅니다.
- 만료된 검증 데이터는 삭제되며 `POST /api/sign-and-submit`에서 사용하지 않습니다.

서명 전에 데이터가 만료되면 fallback/default 입력으로 리포트는 계속 생성되지만, `documentVerification`과 `authenticityChecks`는 포함되지 않습니다.

## 감사 로그

문서 검증은 `GET /api/logs`에서 확인할 수 있는 `document.verification` 이벤트를 기록합니다.

로그에 포함해도 안전한 detail:

- `verificationId`
- `status`
- `documentKinds`
- `reviewReasonCount`
- `reviewReasons`
- `retentionTtlMinutes`
- `replacedPrevious`
- `expiresAt`

로그 summary 예시:

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

로그에는 원본 문서 본문, 원본 외국인등록번호, 원본 문서 검증 코드, QR 검증 URL, 전화번호, 이메일, IP 주소, private key, seed가 포함되면 안 됩니다.

## 오류 응답

이 엔드포인트는 잘못된 API 사용에 대해 HTTP `400`을 반환합니다.

| 코드 | 발생 조건 |
| --- | --- |
| `SESSION_OR_SUBJECT_REQUIRED` | 세션도 없고 `subjectId`도 없습니다. |
| `DOCUMENT_REQUIRED` | `visaDocument`와 `employmentDocument`가 모두 없거나 유효하지 않습니다. |
| `BAD_REQUEST` | 요청 본문이 유효한 JSON이 아니거나, 라우트 처리 중 예상하지 못한 파싱 오류가 발생했습니다. |

일반 오류 형식:

```json
{
  "ok": false,
  "error": {
    "code": "DOCUMENT_REQUIRED",
    "message": "Upload at least one visaDocument or employmentDocument."
  }
}
```

## 발급 상태 응답

`POST /api/sign-and-submit`은 `x-session-id`, 요청 본문의 `sessionId`, 쿼리 파라미터 `sessionId`, 또는 `Authorization: Bearer <sessionId>` 중 하나로 세션을 명시해야 합니다. 세션이 없거나 유효하지 않으면 HTTP `401`과 `SESSION_REQUIRED`를 반환합니다.

응답의 `issuance` 객체는 DID/VC/report 단계가 draft인지, Testnet에 제출됐는지, validated 상태인지 구분합니다.

```json
{
  "issuance": {
    "mode": "dry-run",
    "ledger": "XRPL Testnet",
    "didSet": {
      "status": "drafted",
      "transactionType": "DIDSet"
    },
    "credentials": [
      {
        "id": "vc_report_abc",
        "type": "nomokdon-visa",
        "createStatus": "drafted",
        "acceptStatus": "drafted"
      },
      {
        "id": "vc_report_abc_employment",
        "type": "nomokdon-employment",
        "createStatus": "drafted",
        "acceptStatus": "drafted"
      }
    ],
    "report": {
      "id": "report_abc",
      "status": "stored"
    },
    "caveat": "Dry-run mode returns transaction drafts and locally stored report/VC placeholders without submitting to XRPL."
  }
}
```

현재 MVP에서 `dry-run`은 transaction draft와 로컬 report/VC placeholder만 생성합니다. `live-testnet` 모드에서도 VISA `CredentialCreate`만 제출 대상이며, DIDSet, CredentialAccept, employment credential, rent payment, escrow는 draft로 남습니다.

## 후속 사용

`POST /api/sign-and-submit`은 명시된 세션에 연결된 만료되지 않은 최신 검증 결과를 읽습니다.

업로드 문서 검증 결과가 있으면 다음 항목에 영향을 줍니다.

- 공개 리포트의 비자/고용 배지 상태
- `report.authenticityChecks`
- 저장된 DID service reference
- 저장된 VC credential subject
- VC evidence hash

후속 payload에는 정제된 값과 해시만 포함되며, 업로드된 문서 원본은 포함되지 않습니다.
