# 보안 및 개인정보 체크리스트

이 체크리스트는 문서 업로드, DID, VC, report, audit-log 흐름에서 현재 MVP가 지켜야 할 개인정보 경계를 정리합니다.

## 반환하면 안 되는 민감 값

API와 UI는 다음 값을 노출하면 안 됩니다.

- 업로드된 원본 document body
- 전체 외국인등록번호
- 원본 document verification code
- 원본 QR verification URL
- employment/school evidence에 포함된 organization name
- employment/school evidence에 포함된 role 또는 program name
- log 안의 phone number, email, IP address, device fingerprint
- issuer seed, private key, request secret, transaction blob

## 반환 가능한 파생 값

다음 값은 반환해도 안전합니다.

- document evidence hash
- `foreignRegistrationNumberHash`, `organizationNameHash`, `roleOrProgramHash` 같은 field hash
- 제공되었거나 추출된 foreign registration number의 마지막 4자리
- authenticity status/method/summary
- manual review ticket id, queue, reason code, document hash
- report id, DID service reference, VC id, public XRPL Testnet hash

## 현재 Guardrail

- `sendJson`은 API response를 작성하기 전에 secret처럼 보이는 알려진 key를 sanitize합니다.
- Document adapter는 원본 민감 document field를 hash 처리하거나 생략합니다.
- Manual review ticket에는 source document content가 아니라 hash와 metadata만 포함됩니다.
- `/api/logs`는 원본 document field가 아니라 document verification status와 reason code를 렌더링합니다.
- 업로드된 verification result는 설정된 TTL 이후 만료되며, 오래된 경우 signing 전에 제거됩니다.
- 같은 session에 다시 업로드하면 이전 verification result를 대체합니다.

## 테스트 범위

현재 자동화 테스트는 다음 항목을 확인합니다.

- document adapter output이 원본 foreign registration number, verification code, QR URL, organization name, role/program name을 생략하는지
- upload response가 원본 document value를 생략하는지
- sign-and-submit, DID, VC, employment VC, report response가 업로드된 원본 값을 생략하는지
- document verification log가 success, manual-review, re-upload, expiry 경로 전반에서 원본 document value를 생략하는지
- issuer credential, seed, private key, request secret, transaction blob이 유출되지 않는지
- landlord confirmation log가 landlord PII와 device data를 생략하는지
- `VC_ENCRYPTION_KEY`가 설정된 경우 encrypted report storage가 plaintext report payload를 노출하지 않는지

## 운영 전 남은 작업

- 로컬 in-memory store를 encrypted field와 retention control이 있는 범위 제한 persistent storage로 교체합니다.
- 원격 배포 전 issuer API와 audit-log API에 authentication/authorization을 추가합니다.
- 실제 OCR provider 또는 manual-review queue가 public API response 밖에 업로드 원본을 저장하고 ticket metadata만 반환하도록 보장합니다.
- user data request를 위한 운영용 deletion/export workflow를 추가합니다.
