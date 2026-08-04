# 제품명 기반 사료 등록 적용 방법

이 기능은 별도의 Apps Script 프로젝트를 만들지 않고, 현재 이미지 업로드에 사용하는 기존 Apps Script 프로젝트에 추가한다.

## 1. 파일 추가

기존 Apps Script 편집기에서 새 스크립트 파일을 만들고 이름을 `TextFeedRequest`로 지정한 뒤, 이 폴더의 `TextFeedRequest.gs` 전체 내용을 붙여넣는다.

기존 Script Properties는 그대로 사용한다.

- `GEMINI_API_KEY`
- `SUPABASE_SERVICE_KEY`

## 2. `Code.gs`의 `doPost`에 분기 추가

기존 `if (action === 'upload') { ... }` 블록 다음, `알 수 없는 액션입니다` 응답 전에 아래 코드를 추가한다.

```javascript
if (action === 'text_request') {
  if (_isOverDailyLimit()) {
    output.setContent(JSON.stringify({
      성공: false,
      오류: '오늘 등록 요청 한도(150건)를 초과했습니다.'
    }));
    return output;
  }

  const result = _handleTextFeedRequest(body);
  output.setContent(JSON.stringify(result));
  return output;
}
```

최종 구조는 다음과 같다.

```javascript
if (action === 'upload') {
  // 기존 이미지 업로드 처리
}

if (action === 'text_request') {
  // 제품명 검색·등록 처리
}

// 알 수 없는 액션 응답
```

## 3. 웹 앱 다시 배포

Apps Script에서 다음 순서로 배포한다.

1. `배포` → `배포 관리`
2. 현재 웹 앱 배포의 수정 버튼 선택
3. 버전을 `새 버전`으로 변경
4. 배포

기존 배포를 수정하면 웹 앱 URL은 유지되므로 GitHub의 `APPS_SCRIPT_URL`을 바꿀 필요가 없다.

## 처리 흐름

1. 기존 `feeds` 또는 `dog_feeds`에서 중복 후보 확인
2. Gemini 3.5 Flash-Lite + Google Search로 공식 자료 URL 탐색
3. URL Context로 해당 URL의 내용을 다시 확인
4. 자료 충돌 시 Gemini 3.5 Flash로 한 번 더 검토
5. `verified=false`로 Supabase에 임시 저장
6. 열량이 있고 충돌 상태가 아니면 사이트 검색에 `검수 전`으로 노출
7. Supabase 대시보드에서 `verified=true`로 바꾸면 승인 상태로 변경되고 태그 제거

## Supabase에서 검수할 필드

- `requested_query`: 사용자가 입력한 검색어
- `source_urls`: 조사에 사용한 URL 목록
- `source_level`: 제조사·수입사·라벨·판매처 구분
- `source_region`: 한국판·글로벌판 지역
- `formula_match_status`: `same`, `different`, `unknown`
- `ai_review_note`: Gemini 검토 메모
- `needs_nutrition_review`: 영양성분 추가 확인 필요 여부
- `needs_calorie_review`: 열량 추가 확인 필요 여부
- `verification_status`: `pending_review`, `needs_label`, `conflict`, `approved`, `rejected`
- `verified`: 최종 승인 스위치

`verified=true`로 변경하면 데이터베이스 트리거가 `verification_status=approved`, `searchable_before_review=false`로 자동 변경한다.
