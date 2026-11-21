# PROVED 쿠팡 가격 파이프라인 장애 수정 보고

2026-11-17, V1.4.0. 코드·SQL·격리 테스트 제공. 운영 배포·수집 재가동·일괄 재처리는 실행하지 않았다.

## 원인과 조사 근거

GitHub `provedcat/Proved` main (`653b1a9caca5fb5d79704d93fc33345fdaae84ec`)에는 GAS 코드가 없어 사용자가 제공한 Drive `PROVED-V1.3.0.zip`을 원본으로 사용했다. 운영 Supabase의 스키마·인덱스·RPC 정의와 실측을 대조했다. 실행 중 GAS와 ZIP의 바이트 일치는 확인하지 못했다.

원본 ZIP SHA-256: `40593d0721f4f132e10df506ff0465df59ffd47dc8a45943db039823930a2dc8`.

원본 `continueCoupangPriceCollection()`은 상품 오류 시 커서를 갱신하지 않고 60초 뒤 동일 상품을 재실행했다. 이 경로는 jobs.next_retry_at을 검사하지 않았다. Gemini 처리에도 횟수·대기 검사가 없었고 HTTP 429 원문에서 quota metric, RetryInfo, Retry-After를 버렸다. DB `proved_save_coupang_job()`은 저장마다 attempts를 증가시키고 횟수와 무관하게 15분 뒤를 지정했다. 재처리 루프도 첫 오류에서 멈췄다.

문제 작업 `cat|361b8bb1-5d7d-4017-89d6-cad445c57cd3`는 조사 시 **1,061회**였다. attempts는 결과 저장 횟수이며 정확한 과거 API 호출 총수가 아니다. audit.calls는 덮어써져 누적 수로 사용할 수 없다. 저장된 자료만으로 해당 429가 RPM·TPM·RPD·지출 한도 중 무엇 때문인지 확정할 수 없다. 사용자는 별도로 `gen-lang-client-0337797752`의 **월 5,000원 예산 소진**을 확인했다.

## 변경 전후

| 항목 | 원본 | V1.4.0 |
|---|---|---|
| 상품 오류 | 같은 상품에서 전체 정체 | 오류 영속 저장 후 다음 상품, 독립 재시도 큐 |
| 재시도 | 무제한, 수집기 대기 무시 | 호출 전 대기 검사, 총 5회 상한 |
| 한도 초과 | 429 문자열만 보존 | quota 구분·서버 대기·프로젝트 circuit |
| 예산 소진 | 요청 반복 | 기본 예산 차단, 자동 해제 없음 |
| 중복 판단 | 일부 부족 결과만 캐시 | 정책·모델·증거별 검증된 의미 판정 재사용 |
| 사람 검수 | 미분류 357건 | 원본 보존, 명시적 충돌만 별도 view 노출 |

## 수정·추가 함수

- 수집: `startCoupangPriceCollection`, `continueCoupangPriceCollection`, `_writeCoupangCollectionState`, `_scheduleCoupangCollectionContinuation`, `resumeCoupangPriceCollection`, `_runCoupangPricePipeline`, `_runCoupangPricePipelineUnlocked`, `_priceJobGate`.
- Gemini: `_geminiResolveAmbiguousDecision`, `_callGeminiPriceJudge`, `_geminiHttpError`, `_reserveGeminiCall`, `_finishGeminiCall`, `_priceFingerprint`.
- 재처리·운영: `reprocessCoupangDeferredJobs`, `reprocessCoupangOpenReviewsWithGemini`, `previewCoupangReviewTriage`, `getCoupangGeminiUsage`, `checkCoupangPipelineSafety`, `requeueCoupangBlockedJob`.
- DB: `proved_save_coupang_job` 수정, `proved_reserve_gemini_call`·`proved_finish_gemini_call` 추가. quota/calls 테이블과 triage/usage view 추가, manual_reviews view 교체.

기존 동일성·습식 최소 포장·건식 1~2kg·정상가 검증 및 가격 저장 RPC는 유지했다.

## 재시도 정책

최초 실행 포함 **5회**, 최대 재시도 4회다. 기존 attempts를 그대로 반영한다. attempts에는 과거 정보 부족 처리도 포함되므로 보수적 제한이다. Gemini 예약도 제품당 5회로 제한해 API 호출 후 강제 종료된 경우를 제한한다.

대기는 `min(3600초, 60초 × 2^(attempts-1)) × [0.5,1.0)`이다. 첫 구간은 30~60초, 다음은 60~120초다. 서버 RetryInfo/Retry-After가 더 긴 대기를 지정하면 그 시각을 우선한다. GAS sleep 대신 next_retry_at으로 재개한다. 예약 차단으로 실제 HTTP를 보내지 못하면 attempts를 소모하지 않는다.

한도 초과는 retry_exhausted 및 무한대 next_retry_at으로 보존한다. 1,061회 작업도 다음 제한 검사에서 횟수를 초기화하거나 늘리지 않고 격리한다. 인증·모델 설정·월 예산 문제는 blocked_error로 보존한다. 일반 재시도 큐는 두 상태를 선택하지 않는다.

수집은 약 210초에서 새 제품 착수를 멈추고 체크포인트를 보존한다. 시작 시 7분 후 복구 트리거를 예약해 강제 종료에 대비하고, 정상 종료 시 60초 뒤로 조정한다. 영속 저장 실패 시에는 커서를 넘기지 않는다. ScriptLock을 공용 경로에 적용했으며 재개 함수는 기존 커서·카운터를 초기화하지 않는다.

## 할당량·비용 관리

- 모델은 `gemini-3-flash-preview` 유지. 정확도 비교 실험·실제 계정 한도가 없으므로 임의 교체하지 않았다.
- 월 예산 소진을 반영해 `GEMINI_BUDGET_EXHAUSTED` 기본값은 true. 달이 바뀌어도 자동 해제하지 않는다. `GEMINI_ENABLED=false`여도 규칙 엔진은 동작한다.
- 실제 AI Studio 한도 확인 전 RPM/RPD는 0으로 두고 호출을 차단한다. 실제 RPM/RPD/TPM은 아직 미확인이다.
- DB 트랜잭션으로 프로젝트·모델별 최근 60초 RPM, Pacific 날짜 RPD, 동시성 1을 검사하고 예약한다. 협력 실행기는 같은 scope를 사용해야 한다. 여러 실행기의 설정이 다르면 저장된 한도와의 최솟값을 적용한다.
- 일일 quota 429는 Pacific 다음 자정까지 circuit을 연다. 더 긴 서버 대기는 우선한다. RPM/원인 불명 429도 전역 cooldown을 적용하며 구분 기록한다. 잠금·7분 lease로 재개를 제한하고 실패·강제 종료 예약도 한도에 포함한다.
- 검증된 의미 판정은 fingerprint별 재사용한다. 변동 가격·추적 URL을 제외하고 제목·옵션·포장·모델·정책 버전을 포함한다. 정상가 증빙은 저장 시 다시 검사한다.
- 후보 최대 12개, 제목 최대 2,000자, 출력 최대 8,192토큰. 규칙 확정 상품과 명백히 불일치한 후보에는 Gemini를 호출하지 않는다.
- 토큰·오류 종류·HTTP 코드·quota metric을 호출 이력에 기록한다. usage view는 작업별 예약 수, 429 수, 토큰과 현재 모델 기준 USD 추정치를 제공한다. 과거 1,061건의 호출·과금을 역산하지 않는다.
- 비용 추정은 청구서가 아니며 환율·세금·다른 앱 호출을 포함하지 않는다. 재개 전 실제 청구 잔액을 확인해야 한다. 현재는 예산 소진 차단을 유지한다.

공식 문서: [한도](https://ai.google.dev/gemini-api/docs/rate-limits), [가격](https://ai.google.dev/gemini-api/docs/pricing#gemini-3-flash-preview), [GAS 실행 한도](https://developers.google.com/apps-script/guides/services/quotas). 확인 당시 표준 텍스트 입력 $0.50 / 출력·사고 $3.00 per 1M tokens다. 실제 한도는 AI Studio 기준, RPD 초기화는 Pacific 자정이다.

## 기존 검수·가격 데이터

기존 manual_reviews는 357건(매칭 250, 포장 모호 107), 전체 open 이력은 362건이었다. 읽기 전용 새 분류 계산은 전체 open 이력 기준 insufficient_evidence 361, retryable_error 1이다. 기존 view의 357건에는 명시적 포장 충돌·검색 API 오류가 없어 모두 우선 insufficient_evidence로 분리된다. 이는 현재 자료로 충돌을 입증할 수 없다는 뜻이며 자동 승인된다는 뜻이 아니다.

분류 view는 최신 job을 우선하고 기술 오류는 retryable_error, 명시적 동일성·포장·정상가 충돌은 manual_review, 나머지는 insufficient_evidence로 분리한다. accepted는 기존 검증 경로를 통과한 job만 가능하다. 과거 후보 요약만으로 자동 확정하지 않는다. 검수 원본 행은 삭제·일괄 수정하지 않는다.

가격은 159건, 마지막 생성은 11월 12일 15:10:56 KST. 정상가 증빙 테이블은 **0건**이다. 규칙상 동일성이 확실해도 증빙이 없으면 신규 가격 저장은 0건일 수 있다. 기존 per-feed UNIQUE 인덱스와 원자적 RPC가 중복 가격·공식 가격 덮어쓰기를 차단한다.

## 검증과 남은 위험

- 수정 전 GAS: 37/37. 수정 후 기존 GAS: 37/37. 첫 오류에서 커서를 멈추던 테스트 기대값은 새 요구사항에 맞춰 변경했다.
- 장애 회귀: 20/20. 상한, 서버 대기, 오류 구분, 개별 실패, 저장 실패, 실행 시간, 잠금, 중단·재개, 예산, 캐시, 미터링 실패 차단을 포함한다.
- 메모리 PostgreSQL(PGlite 0.5.16): 기존 SQL 전체와 업그레이드 검증 8개 묶음 통과. 기록 보존, backoff, quota, 캐시, DST, 분류, 가격 불변, 권한 거부를 검증했다.
- 웹: 18개 묶음 중 13 통과·5 실패. 수정하지 않은 main의 design-rules(Windows 줄바꿈), food-coupang-cta(SELECT), layout-contract(헤더), registration-return(PWA), unified-food-finder(메뉴)다. web-test-results.json에 기록했다.
- PGlite는 단일 연결이므로 실제 PostgreSQL 동시 세션 경쟁, GAS 강제 종료·트리거, 실제 Gemini 응답은 staging에서 추가 검증해야 한다. 제공 ZIP과 실행 중 GAS의 버전 차이도 확인한다.
- 운영 데이터·스키마·트리거·API 설정은 변경하지 않았고 실제 Gemini 호출도 하지 않았다.

배포 함수·순서는 `gas/DEPLOYMENT-1.4.0.md`를 따른다. `upgrade-1.4.0.sql`은 기존 스키마용이다. `schema-proposal.sql`은 격리 테스트의 초기 자료이므로 기존 운영 DB에 다시 실행하지 않는다.
