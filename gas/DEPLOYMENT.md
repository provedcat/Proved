# PROVED 쿠팡 가격 파이프라인 V1.3.0

> 원본 ZIP의 과거 기록이다. 현재 배포에는 [V1.4.0 안내](DEPLOYMENT-1.4.0.md)를 사용한다.

2026-11-13 검증 결과. 운영 가격 변경, 운영 마이그레이션, 대량 재처리는 실행하지 않았다.

원래 지정된 `/codex/browser/projectless/0002-files-pasted-by-the-user-uploaded-pasted-text-po/output`은 연결된 실행 환경에서 생성할 수 없어, 실제 파일은 공유 작업공간 `/workspace/output/`에 저장했다.

## 제공 파일

- `ProvedCoupangV1_3_0.gs`: 기존 스크립트를 교체하는 전체 실행 코드. 패치만 추가하는 방식이 아니다.
- `schema-proposal.sql`: 실제 운영 스키마를 조사한 뒤 작성한 별도 SQL 제안. 아직 운영에 적용하지 않았다.
- `test-pipeline.cjs`: Node.js 표준 라이브러리만 사용하는 오프라인 GAS 테스트.
- `test-database.sql`, `test-db-base.sql`, `test-database.sh`: 격리 PostgreSQL에서만 실행하는 SQL 검증.
- `test-results.json`: 최종 JavaScript 검증 결과.

## 분석한 연결 구조와 수정

기존 검색 `_searchCoupangCandidatesV53` → `_analyzeCandidate` → 영구 옵션 메타데이터 → 보너스 수량 → `_decideCandidateV53` → `_geminiResolveAmbiguousDecision` → 가격/검수 저장 흐름을 유지했다. 기존 조회·HMAC·캐시·공식가격 보호·수집 트리거·수동 옵션 확인·공개 테스트 함수도 유지했다.

| 문제 | 변경 |
|---|---|
| 브랜드가 없으면 일치 처리 | `_calculateIdentityScore`에서 `matched/mismatched/unknown` 분리. `brand_match`는 matched만 true. 힐스·지위픽·퓨리나 별칭 추가 |
| GI Biome/Stress, 종/제형 혼동 | `_clinicalVariantConflict`, `_formConflict`, `_candidateSpeciesStatus` 추가. 기존 종·레시피·성장단계·샘플 차단 유지. 명시적 차단은 AI가 해제할 수 없음 |
| AI가 하나의 포장만 고르도록 강요 | 모든 안전 후보의 의미적 동일성과 항목별 근거를 평가. 포장은 코드의 `_selectPackage`에서 선정 |
| 동점 후보만 비교 | 동일성 통과 후보 전체에서 단품 또는 최소 묶음 비교. 건식 1~2kg 우선, 5kg 미만 대체 규칙 유지 |
| 중량만으로 단품 가정 | `_packageIsProven`으로 차단. 미표시 경쟁 옵션은 최소 묶음 확정을 막음. 파서는 관측 중량을 보존하되 수량 추정은 저장 불가 |
| 포장 숫자 생성/혼합 | `_parsePackageInfo`, `_geminiPackageEvidenceIsSafe`, `_validateGeminiJudgments`에서 실제 중량·수량 쌍, 후보 ID, 스키마, 보너스, 상충 중량 검증 |
| 현재 판매가를 정상가로 저장 | `_finalizePriceDecision` 및 `_upsertReferencePrice`가 독립적인 정상가 증빙 요구. `productPrice`는 검색 관측값일 뿐임 |
| 정보 부족과 API 장애가 사람 목록에 누적 | 별도 jobs 테이블과 사람 검수 전용 view. 기존 open 기록은 보존하며 view에서 분리 |
| 재처리 반복/중복/재시작 | 공유 잠금, 영속 커서, 제품 중복 제거, 240초 배치 제한, 후보 지문과 Gemini 분석 재사용, 처리 전후 상태 및 호출 통계 |
| GET 후 INSERT 경쟁 | DB RPC의 INSERT ON CONFLICT DO NOTHING으로 중복 방지. 기존 공식/수입사/쿠팡 가격은 갱신하지 않음 |

기존 함수 중 직접 수정한 것은 `_runCoupangPricePipeline`, `continueCoupangPriceCollection`, `_coupangSearchProducts`, `_coupangSearchWithRetry`, `_analyzeCandidate`, `_calculateIdentityScore`, `_candidateIdentityEligible`, `_applyExplicitBonusPackaging`, `_decideCandidateV53`, `_selectPackage`, `_geminiResolveAmbiguousDecision`, `_geminiPackageEvidenceIsSafe`, `_callGeminiPriceJudge`, `reprocessCoupangOpenReviewsWithGemini`, `_referenceWriteAction`, `_upsertReferencePrice`, `_buildReviewPayloadV53`, `_parsePackageInfo`, `testCoupangCurrentPricePolicy`다. 마지막 테스트 함수는 이전 공개 이름을 보존했고 기존 검사 내용도 유지했다.

신규 함수는 `_geminiPriceJudgeSchema`, `_priceCandidateId`, `_hardIdentityBlock`, `_clinicalVariantConflict`, `_formConflict`, `_packageIsProven`, `_validateGeminiJudgments`, `_priceFingerprint`, `_loadPriceJob`, `_normalPriceIsProven`, `_attachNormalPrice`, `_finalizePriceDecision`, `_savePriceJob`, `_candidateSpeciesStatus`, `reprocessCoupangDeferredJobs`, `prepareCoupangNormalPriceEvidence`다.

## 실제 Supabase 조사 결과

대상 프로젝트: `qpklvtgnhrdmzxzlstpp`. 연결 도구로 컬럼·제약·인덱스·가격 생성 컬럼·트리거를 읽기 전용 조사했다.

- 검수 `status`는 `open/resolved/dismissed`만 허용한다. 상태와 review_action/reviewed_at의 조합 제약도 있다.
- 검수 issue_type은 한정되어 있고 `search_failed`는 허용되지 않는다.
- 검수에는 고양이/강아지별 open feed+issue 고유 인덱스가 있다.
- 기준가격에는 feed_id/dog_feed_id별 고유 인덱스가 있다.
- `reference_price_krw`와 `price_per_100g_krw`는 DB 생성 컬럼이다. 직접 쓰지 않는다.
- 기존 옵션 메타데이터는 product_id+item_id로 고유하다.

기존 테이블 제약을 바꾸지 않는다. `proved_coupang_jobs`, `proved_coupang_normal_price_evidence`, `proved_coupang_manual_reviews`, RPC 2개를 추가하는 제안이다. 신규 테이블은 RLS를 켜고 service_role만 허용한다. RPC/view는 security invoker이고 anon/authenticated에는 권한이 없다. 기존 UI의 인증 방식을 추정해 공개 정책을 추가하지 않았다.

## 처리 상태와 사람 검수 화면

- `accepted`: 상품·포장·독립 정상가 증빙 통과. 실제 저장 성공 후 jobs에 기록.
- `insufficient_evidence`: 검색 없음, 불명확한 동일성/포장, 정상가 없음 등. jobs에 보관하며 사람 view에서는 제외.
- `manual_review`: 관련 상품의 포장 증빙 충돌 또는 유효 정상가 증빙 간 충돌. 기존 검수 테이블에도 기록.
- `retryable_error`: 검색/Gemini/운영 오류. 사람 검수에 신규 등록하지 않고 jobs에서 재시도.

**기존 화면이 `food_price_review_queue where status='open'`를 계속 조회하면 기존 기록은 그대로 보인다.** 검수 목록 조회를 `proved_coupang_manual_reviews`로 전환해야 실제로 정보 부족/재시도 항목이 분리된다. 기존 기록은 삭제·일괄 변경하지 않는다. 새 view는 기본 service_role 전용이므로 서버에서 조회한다. 브라우저에서 직접 service key를 사용하면 안 된다. 기존 사용자용 서버 API 또는 별도 검토한 RLS 정책으로 연결해야 한다. UI 코드는 제공되지 않아 변경하지 않았다.

`jobs.feed_id`는 species로 구분하는 공통 제품 ID이며 기존 price/review 테이블의 고양이용 feed_id와는 의미가 다르다. 데이터 보존을 위해 이 운영 처리 테이블에는 제품 삭제 cascade를 추가하지 않았다.

## 정상가 증빙 등록

검색 API의 `productPrice`, 추정 원가, 할인율 역산, AI 출력은 정상가 증빙이 아니다. 따라서 검색 API만으로는 신규 가격이 승인되지 않는 것이 의도된 결과다.

1. 실제 API 후보의 정확한 제목·productId·itemId·vendorItemId로 `prepareCoupangNormalPriceEvidence(...)`를 호출해 초안을 만든다. 이 함수는 DB를 쓰거나 승인하지 않는다.
2. 상세페이지/허용된 검증 수집원에서 **할인 전 정상가**, 실제 단위 중량·수량, 해당 판매자를 독립 확인한다. 세일/쿠폰/와우/즉시할인가를 입력하지 않는다.
3. 초안에 normal_price_krw, `verification_status='verified'`, verification_source(`manual_coupang_detail` 또는 검증된 수집기의 `verified_source_adapter`), 실제 source_url, 증빙 JSON(라벨·캡처/수집 원문 위치·관찰 시간 등), verified_at, valid_until을 채워 증빙 테이블에 INSERT한다. 정상가가 없으면 등록하지 않는다. valid_until은 수집원의 실제 검증 주기에 맞춰 정하며 기본 무기한 승인은 없다.
4. title_hash는 정규화하지 않은 API 제목의 SHA-256이다. 제목/판매자/옵션/수량이 달라지면 새 검증이 필요하다. 검증된 영구 옵션 메타데이터가 수량을 제공하는 경우 초안의 null 중량·수량을 그 확인값으로 채운다.
5. 유효한 증빙이 하나의 정상가에 합의할 때만 승인한다. 여러 유효 증빙이 다른 정상가를 주장하면 사람 검수로 보낸다.

이 전달물은 새로운 상세페이지 스크레이퍼를 만들지 않는다. 검증 가능한 독립 정상가 수집원이 없는 환경에서는 정보 부족 상태가 남는다. 자동화 비율을 더 높이려면 실제 정상가를 제공하는 수집 어댑터가 필요하다.

## 배포와 실행 순서

1. 기존 GAS 코드/Script Properties를 백업하고 수집 트리거를 중지한다(`stopCoupangPriceCollection()`).
2. 별도 테스트/스테이징 Supabase에 SQL 제안을 먼저 적용한다. 운영 적용 전 실제 인덱스/권한과 보고서의 조사 결과가 같은지 확인한다. 제안 SQL은 일회성이다. 재실행 시 CREATE 중복으로 실패하므로 적용 이력을 관리한다. 기존 migration 저장소가 있으면 `supabase migration new proved_coupang_evidence`로 파일을 생성하고 본문을 옮긴다.
3. GAS 테스트 복사본의 기존 코드를 `ProvedCoupangV1_3_0.gs` 전체로 교체한다. 동일 이름 함수/const를 옛 코드와 함께 남기지 않는다. 스테이징 사용 시 `PRICE_PIPELINE_CONFIG.SUPABASE_URL`을 스테이징 주소로 바꾼다.
4. 기존 필수 속성 `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`, `SUPABASE_SERVICE_KEY`를 설정한다. `GEMINI_ENABLED=true`이면 `GEMINI_API_KEY`도 필요하다. `GEMINI_MODEL`은 실제 계정에서 사용 가능한 모델을 지정한다. 기본값은 기존 `gemini-3-flash-preview`를 유지했다. `COUPANG_SUB_ID`는 선택이다. 새 필수 비밀 속성은 없다.
5. 로컬 `node test-pipeline.cjs`를 실행한다. GAS에서도 `testCoupangPriceMatchingFixtures()`, `testCoupangCurrentPricePolicy()`, `testCoupangGeminiEvidenceFixtures()`를 순서대로 실행한다. 전자는 `{failed:0}`, 둘째는 `'OK'`, 셋째는 passed=total이어야 한다.
6. `runCoupangPricePipeline10ProductsDryRun()`으로 실 API·Supabase 읽기를 검증한다. 정상가 미증빙은 `insufficient_evidence`가 정상이다. HTTP 4xx/429/5xx·JSON 오류를 감사 로그에서 구분한다.
7. 증빙이 있는 테스트 제품 1개에 대해 `runCoupangPricePipelineOneWriteTest()`를 실행한다. 이 기존 helper는 테스트 목록의 첫 제품이다. 다른 제품은 GAS 편집기의 wrapper에서 `_runCoupangPricePipeline([{species:'cat',feed_id:'정확한 ID'}],true)`를 호출한다. 같은 대상을 한 번 더 실행해 가격 1행·기존가격 유지·처리상태를 확인한다.
8. 스테이징 실검증 후 운영에 SQL과 GAS를 반영하고 검수 화면 조회를 새 view로 연결한다. 운영 신규 가격은 기존 기준가격이 없는 제품만 삽입한다. 기존 가격은 고치거나 지우지 않는다.
9. 과거 검수는 wrapper 함수에서 `reprocessCoupangOpenReviewsWithGemini(1)`로 소량 시작한다. 로그/분류를 확인한 후 5~10개씩 늘린다. 같은 함수를 반복 호출하면 저장 커서 이후를 처리한다. 실패한 행은 커서를 넘기지 않는다. 끝나면 `resetCoupangGeminiReviewCursor()` 후 다음 회차를 시작할 수 있다.
10. 재수집은 `reprocessCoupangDeferredJobs(5)`를 반복 호출한다. API 오류는 15분, 정보 부족은 1일 뒤 재수집 대상이 된다. 증빙을 방금 보강해 즉시 다시 확인하려면 그 제품만 위 단건 wrapper로 실행한다. 이 함수는 자동 트리거를 만들지 않는다.
11. 검증이 끝난 뒤에만 `startCoupangPriceCollection()` → `getCoupangPriceCollectionStatus()`로 신규 누락제품 수집을 시작한다. 계속 실행은 기존 `continueCoupangPriceCollection()` 트리거가 담당한다. 중지 함수는 기존과 같다.

자동 생성되는 새 상태 속성은 `COUPANG_DEFERRED_CURSOR`다. 기존 `COUPANG_GEMINI_REVIEW_CURSOR` 및 수집 상태 속성도 계속 사용한다. 동일 후보는 영속 지문·감사 모델 버전으로 분석을 재사용하며 정상가 증빙은 매번 다시 확인한다. 정책 또는 모델을 바꾸면 재평가한다.

## 검증 범위와 남은 위험

- JavaScript: 기존 매칭 fixture 34개, 기존 가격 호환 테스트, 기존 Gemini 근거 fixture 5개를 포함해 **37개 테스트 묶음 전부 통과**. 요청한 12가지 사례와 추가 ID/스키마/캐시/커서/미확인 후보/정상가 충돌 회귀 검증 포함.
- PostgreSQL 17 격리 DB: SQL 적용, service_role 권한, 중복 RPC 삽입, 생성 컬럼의 개당/100g 계산, 잘못된 판매자/NULL 증빙 차단, jobs upsert, 공식가격 전체 행 보존, 검수 view 분리·기록 보존, anon 조회/RPC 차단 통과. 동시에 RPC 2개를 실행해 실제 1행만 생성됨을 확인했다.
- 테스트 DB는 조사한 가격 고유 인덱스와 생성 컬럼을 재현한 최소 스키마다. 운영의 모든 트리거/권한/제약을 복제한 전체 Supabase 스테이징은 아니다.
- 실제 GAS 런타임·Gemini 계정·쿠팡 API 호출은 실행하지 않았다. 실제 AI 승인율이나 운영 365건 감소 수치를 주장하지 않는다. 모델 가용성, API JSON 응답, GAS 실행시간/쿼터는 소량 실검증이 필요하다.
- 종·브랜드·처방/레시피의 명시적 충돌은 계속 막는다. 임상 세부어 사전은 모든 제품군을 포괄하지 않으며 검증된 후보 텍스트 자체가 잘못된 경우까지 증명하지 못한다. 불명확한 종/브랜드는 규칙만으로 승인하지 않는다.
- 정상가 증빙의 진위는 수동 검증자/수집 어댑터의 책임이다. 원문 보존과 유효기간을 운영해야 한다. 재검증 없이 현재가를 정상가로 등록하면 안 된다.
- 기본 기존가 보존 정책 때문에 이미 저장된 V1.1.1 현재가는 그대로 남는다. 별도 근거 검증과 명시적 정정 작업 없이는 정상가로 재인증되지 않는다.
- API 4xx 설정 오류도 `retryable_error`에 보관하되 audit의 `configuration_error`로 구별한다. 커서는 해당 제품에서 멈추므로 설정 오류는 운영자가 고친 후 재시도해야 한다.
- 수집/재처리는 GAS 프로젝트 공유 잠금을 사용한다. DB 가격 중복은 별도의 고유 인덱스로 방어한다. 후보 변경이 있으면 Gemini를 다시 부를 수 있다.
