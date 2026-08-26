# PROVED Company World Model 운영 규격

## 원장 분리

| 원장 | 기준 정보 |
| --- | --- |
| Notion World Model Records | 현재 사실, 문제·신호, 결정, 변경 이유, Decision·Delivery·Evidence 상태 |
| Notion Change Events | 결정·보류·구현·병합·관찰·검증의 시간순 변경 이력 |
| GitHub Issues·Pull Requests | 승인된 개발 작업의 실행 계획과 구현 증거 |

공통 연결 키는 Notion의 실제 Record ID 표시값인 `PWM-1`, `PWM-19` 형식을 사용한다.

## 실행 흐름

1. 대화나 고객 신호를 Notion Record로 저장한다.
2. Decision이 `Approved`인 개발 기록만 GitHub Issue로 전환한다.
3. Issue 제목·본문·PR에 같은 PWM ID와 Notion URL을 넣는다.
4. 구현 시작 시 Notion Delivery를 `Building`으로 바꾸고 Change Event를 추가한다.
5. PR 병합 시 Delivery를 `Shipped`으로 바꾸고 PR URL과 병합 Event를 연결한다.
6. 배포 후 실제 반응을 관찰한 뒤에만 Evidence를 `Validated` 또는 `Disproved`로 바꾼다.

## 라벨

| 라벨 | 용도 |
| --- | --- |
| `world-model` | Notion Record와 연결된 모든 실행 항목 |
| `feature` | 승인된 기능 기획·변경 |
| `bug` | 재현 가능한 개발 이슈 |
| `design` | 디자인 규격·화면 변경 |
| `evidence-needed` | 배포됐으나 효과 검증이 남음 |
| `blocked` | 외부 결정·데이터·권한 때문에 진행 불가 |

## GitHub Project

Project 이름은 `Proved Delivery`로 유지한다.

필드:
- Status: Queue / Building / Shipped
- Priority: P0 / P1 / P2 / P3
- PWM ID: Text
- Area: Brand / Calculator / Feed Database / Archive & Editorial / Content & Marketing / Data & Analytics / Platform / Operations

View:
- Queue: Status = Queue
- Building: Status = Building
- Shipped: Status = Shipped
- Evidence needed: label = evidence-needed

Decision과 Evidence의 기준값은 Notion에만 둔다. GitHub Project는 Delivery 흐름을 빠르게 보는 실행판이다.
