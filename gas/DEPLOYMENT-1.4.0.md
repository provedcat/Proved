# V1.4.0 배포·검증 순서

운영 배포·일괄 재처리·수집 재가동은 실행하지 않았다. 기존 GAS 구현을 새 파일로 교체하고 두 버전의 함수를 동시에 넣지 않는다. ZIP과 실제 운영 소스의 차이를 먼저 확인한다.

## 로컬·staging 검증

```powershell
cd gas
npm ci
npm test
```

Node 24에서 검증했다. PGlite는 테스트용이며 GAS에 올리지 않는다. test-db-base.sql, schema-proposal.sql, test-database.sql은 새 메모리 DB에서만 실행한다. upgrade-1.4.0.sql은 기존 1.3.1 스키마용이다. staging PostgreSQL에서는 동시 예약·동시 가격 저장을 별도로 검증한다.

## 전환 준비

1. 기존 GAS의 `getCoupangPriceCollectionStatus()` 결과(phase, last_id, 카운터)를 보관한다.
2. 기존 GAS에서 `stopCoupangPriceCollection()` 실행 후 현재 실행 종료를 확인한다. 별도로 설정한 재처리 트리거도 중단한다. 이전 GAS는 next_retry_at을 무시하므로 SQL만 적용해서는 호출을 막을 수 없다.
3. 소스·Script Properties를 안전하게 백업한다. 키를 GitHub에 넣지 않는다.
4. staging에서 `upgrade-1.4.0.sql` 적용·검증 후 운영에 한 번 적용한다. 기존 job·검수·가격 행을 갱신/삭제하지 않는다. view 교체에 따라 검수 화면의 분류는 달라진다.
5. 기존 GAS를 `ProvedCoupangV1_4_0.gs`로 교체한다. 기존 수집 커서를 삭제하지 않는다.

## 현재 Script Properties

기존 COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY, SUPABASE_SERVICE_KEY는 유지한다.

| 속성 | 설정 |
|---|---|
| GEMINI_MODEL | gemini-3-flash-preview |
| GEMINI_QUOTA_SCOPE | gen-lang-client-0337797752 |
| GEMINI_BUDGET_EXHAUSTED | true: 월 5,000원 소진 |
| GEMINI_ENABLED | false 권장: 규칙 엔진 운영 |
| GEMINI_RPM / GEMINI_RPD | AI Studio 실측 확인 전 미설정/0 |

예산은 자동 해제되지 않는다. 예산·한도 확인 전 enabled=true 및 budget_exhausted=false로 바꾸지 않는다. 과거 판정 캐시를 쓰려면 enabled=true인 상태에서도 budget_exhausted=true를 유지할 수 있다. 새 HTTP 요청은 차단된다.

RPM/RPD는 Google이 보장하는 용량이 아니다. 동일 프로젝트의 다른 앱 사용량도 고려해 낮게 설정한다. 모든 협력 실행기는 같은 scope·DB 예약 함수를 사용한다. TPM 실측은 미확인이고 별도 토큰 예약은 구현하지 않았다. 후보·출력 크기 제한과 TPM 429 cooldown·제품 상한을 적용한다.

## 교체 후 GAS 실행 순서

1. `checkCoupangPipelineSafety()` — 새 테이블·view 읽기, 모델, budget_exhausted=true, 기존 커서 확인. 읽기 전용이며 실제 RPC 쓰기 권한까지 검증하는 함수는 아니다.
2. `testCoupangCurrentPricePolicy()` — OK 확인.
3. `testCoupangPriceMatchingFixtures()` — failed=0 확인.
4. `testCoupangGeminiEvidenceFixtures()` — passed=total 확인.
5. `previewCoupangReviewTriage()` — 읽기 전용 분류 확인. 357건을 재검색·Gemini 재판정하거나 가격으로 저장하지 않는다.
6. `runCoupangPricePipeline10ProductsDryRun()` — 우선 GEMINI_ENABLED=false로 실행. 쿠팡 검색은 수행하지만 가격은 쓰지 않는다. 향후 Gemini 활성화 dry run도 호출 예약 이력은 기록한다.
7. staging의 정상가 증빙을 가진 상품으로 단일 write를 검사한다. `runCoupangPricePipelineOneWriteTest()`는 고정된 첫 상품용이다. 증빙이 없으면 insufficient_evidence가 정상이다. 현재 운영 증빙 0건에서 검증을 우회하지 않는다.
8. 안전성 검증 후 단건 정리는 `reprocessCoupangDeferredJobs(1)`. DB 쓰기를 수행한다. 1,061회 작업이 선택되면 횟수 보존·retry_exhausted·HTTP 0회 확인. 첫 선택은 정렬·due 시각에 따라 다르다. 일괄 확대 전에 검토한다.
9. 운영 재가동은 별도 결정 후 `resumeCoupangPriceCollection()` 실행. 기존 커서 유지. `startCoupangPriceCollection()`은 새 수집 주기용이므로 기존 작업 재개에 사용하지 않는다. phase=done이면 재개할 체크포인트가 없다.
10. `getCoupangPriceCollectionStatus()`·`getCoupangGeminiUsage()` 확인. 실제 검수는 proved_coupang_manual_reviews, 보존 원본은 food_price_review_queue, 분류 전체는 proved_coupang_review_triage에서 확인한다.

위 운영 함수·SQL·재가동은 이 작업에서 실행하지 않았다.

## 차단 해제·롤백

인증·모델·예산 원인 해결 후 `requeueCoupangBlockedJob('cat','<feed UUID>')` 또는 dog로 특정 blocked_error 작업만 해제할 수 있다. 예산 소진 플래그가 true이면 거부한다. attempts·증거·호출 이력은 초기화하지 않는다. retry_exhausted는 자동 해제하지 않는다.

문제 발생 시 수집을 중단하고 예산 차단을 유지한다. 새 호출 이력이나 retry_exhausted 기록을 삭제하지 않는다. 이전 GAS를 그대로 재실행하면 무한 재시도가 재발할 수 있어 수정 배포로 복구한다. 실제 한도·정상가 증빙·staging 동시 실행·GAS 종료 복구 검증은 운영 확대 전 남은 조건이다.
