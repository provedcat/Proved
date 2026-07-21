# Proved

Proved 통합 서비스입니다. GitHub Pages 배포 주소는 `https://provedcat.github.io/proved/`이며 Vite `base`도 `/proved/`로 설정되어 있습니다.

## Routes

- `/proved/`: Proved 메인 화면
- `/proved/cat/calculator`: 고양이 급여 계산기
- `/proved/cat/food-finder`: 고양이 사료 후보 찾기
- `/proved/dog/calculator`: 강아지 급여 계산기 준비 중 화면
- `/proved/records`: 사용자 반려동물 체중 기록

## Supabase

기존 Supabase 프로젝트를 유지하려면 GitHub Pages 빌드 환경에 아래 환경변수를 설정하세요.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

현재 앱은 기존 Auth 세션을 유지하고, `cat_foods` 및 `pet_weight_records` 테이블을 조회합니다. 테이블명이나 컬럼명이 기존 프로젝트와 다르면 `src/main.tsx`의 조회 부분만 기존 스키마에 맞게 조정하면 됩니다. 저장소 내부에 기존 데이터 덤프가 없으므로 별도 데이터 마이그레이션은 필요하지 않습니다.

## GitHub Pages deep link fallback

`public/404.html`은 `/proved/cat/calculator` 같은 하위 주소로 직접 접속하거나 새로고침했을 때 GitHub Pages 404 대신 SPA 라우트로 복구합니다.
