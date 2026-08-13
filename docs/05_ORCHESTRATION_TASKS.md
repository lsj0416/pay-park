# AI 오케스트레이션·작업 분담

## 목표

두 명의 팀원이 AI 도구를 활용해 하루 안에 기능 구현과 디자인 검수를 끝낼 수 있도록 파일 소유권과 공용 계약을 먼저 고정한다.

## 사람 역할

| 담당 | 책임 |
| --- | --- |
| 개발 담당 | 구조 생성, AI 작업 지시, 계산·저장 통합, Netlify 배포 |
| 콘텐츠·QA 담당 | Figma 대조, 문구·상품 예시 검수, 모바일 테스트, 게시물 준비 |

## 병렬 작업 단위

| 작업 | 소유 파일 | 의존성 | 완료 조건 |
| --- | --- | --- | --- |
| A. 공통 셸·스타일 | `index.html`, `css/*` | Figma | 7개 section과 공통 컴포넌트 스타일 |
| B. 계산·저장 | `calculator.js`, `store.js` | 데이터 명세 | 계산·복원 단위 테스트 통과 |
| C. 화면 제어 | `app.js`, `ui.js` | A, B 계약 | 단계 이동·수정·홈 전환 작동 |
| D. AI 시뮬레이션 | `planner.js`, `products.js` | 계산 결과 | 목적 해석·배분·후보 2개 생성 |
| E. QA·배포 | 전체 | A~D | 모바일 QA, Netlify URL 확인 |

## 공용 계약

병렬 작업 전에 아래 이름을 변경하지 않는다.

```js
loadState()
saveState(nextState)
patchState(partial)
clearState()
calculateBudget(state)
calculateDailyBudget(availableAmount, periodEnd, today)
buildPlan(goalText, availableAmount)
navigate(screenId)
render(state)
```

- 화면 ID와 상태 필드는 `01_DATA_STATE_CALCULATION.md`(v2 스키마: `income.basis`, `deductions.fixedExpenseItems`/`savingItems` 등 항목 리스트, `plan.goals`)를 따른다.
- 금액은 정수 원 단위다.
- DOM 선택자는 `data-screen`, `data-action`, `data-field`를 우선 사용한다.
- 공용 함수 이름 변경은 통합 담당자만 한다.

## 통합 순서

1. 개발 담당이 파일 구조와 빈 export 함수를 만든다.
2. A~D 작업을 독립적으로 생성한다.
3. 계산·저장 모듈을 먼저 연결한다.
4. S01~S04 흐름을 완성한다.
5. S05~S06을 연결한다.
6. S07 홈의 첫 방문·완료 결과 상태를 연결한다.
7. 모바일 QA 후 Netlify에 배포한다.

## AI 작업 요청 템플릿

```text
이번달페이는 프레임워크 없는 HTML/CSS/JavaScript 정적 프로토타입이다.
담당 파일만 수정하고 다른 파일의 공용 함수명은 변경하지 마라.
기준 문서: [관련 md]
입력 계약: [사용할 함수/상태]
출력 계약: [export 함수/DOM 이벤트]
완료 조건: [테스트 시나리오]
실제 API 호출, 로그인, 서버 기능은 추가하지 마라.
```

## 충돌 방지

- 여러 작업자가 동시에 `index.html`을 수정하지 않는다.
- 화면 HTML이 필요하면 A 담당에게 삽입 위치와 `data-*` 계약만 전달한다.
- 색·간격은 CSS 변수만 사용한다.
- 상품 데이터는 `products.js`, 계획 로직은 `planner.js`에 분리한다.
- 계산 결과는 DOM에서 다시 읽지 않고 상태 객체를 단일 원천으로 사용한다.

## 시간 계획

| 시간 | 개발 | 콘텐츠·QA |
| --- | --- | --- |
| 0~2h | 셸, 계산, 저장 병렬 생성 | 문구와 상품 예시 확정 |
| 2~5h | S01~S04 통합 | Figma 픽셀·간격 대조 |
| 5~7h | S05~S07 통합 | 모바일 시나리오 테스트 |
| 7~8h | 오류 수정·배포 | 게시물 이미지·소개글 준비 |

## 구현 중 금지

- Next.js, React, Zustand, Tailwind 등 프레임워크 추가
- 실제 AI API 키를 브라우저 코드에 삽입
- 화면·라우트·마이페이지 추가
- `01_DATA_STATE_CALCULATION.md`에 정의된 가상 은행명(토닥은행/새록저축은행/푸른은행) 외에 실제 존재하는 금융사명을 사용하는 것, 또는 "가입 전 실제 조건을 꼭 확인하세요" 안내 문구를 생략하는 것
- Figma `유경` 페이지와 다른 정보 구조를 임의로 확장(단, `03_FEATURE_SPEC.md`에 Figma 실측 기준으로 명시적으로 갱신된 내용은 반영한다)

