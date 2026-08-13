# 반응형(Tablet·Desktop) 대응 계획

> Figma `유경` 페이지의 `Responsive · Tablet · 768`(섹션 127:2, 프레임 7개)과 `Responsive · Desktop · 1440`(섹션 129:2, 프레임 7개)을 MCP로 조회해 작성했다. 지금까지 구현한 모바일(375~430px) 버전을 기준으로 두 breakpoint를 추가하는 계획이며, 아직 코드에는 반영하지 않았다.

## 원칙

- 화면 개수·정보 구조는 breakpoint와 무관하게 7개 그대로 유지한다. Figma의 Tablet/Desktop 프레임도 모바일과 동일한 S01~S07 7개 화면이며, 새 화면을 추가하지 않는다.
- Figma의 태블릿/데스크톱 프레임은 "회색 캔버스 위에 그림자 진 카드가 떠 있는" 목업 프레젠테이션 스타일이다. 이는 모바일 프레임의 폰 베젤과 같은 **발표용 장식**이며, 실제 구현에서는 (모바일 때와 동일한 판단으로) 그대로 재현하지 않는다. 대신 일반적인 웹페이지처럼 배경은 화면 전체를 채우고, 콘텐츠만 정해진 최대 너비로 중앙 정렬한다.
- 마이페이지는 아직 구현하지 않으므로, 데스크톱 WebHeader의 내비게이션에도 "내기록"(마이 대응) 항목을 넣지 않는다. 모바일에서 하단 탭바를 통째로 뺀 것과 동일한 기준이다.
- 텍스트·색상·계산 로직·컴포넌트 종류는 breakpoint가 달라져도 동일하다(Figma 실측상 폰트 크기도 거의 확대되지 않음). 바뀌는 것은 **레이아웃 구조(컬럼 수, 사이드바 유무, 버튼 위치)** 뿐이다.

## Breakpoint 정의

| Breakpoint | 범위 | 기준 |
| --- | --- | --- |
| Mobile | ~767px | 기존 구현 그대로(단일 컬럼, 하단 sticky 버튼, 가로 StepTabs) |
| Tablet | 768px ~ 1439px | Figma `Tablet·768` 프레임 기준 |
| Desktop | 1440px 이상 | Figma `Desktop·1440` 프레임 기준 |

`min-width: 768px`, `min-width: 1440px` 두 개의 미디어 쿼리로 구현한다. 1024~1439px 구간은 별도 중간 레이아웃을 만들지 않고 Tablet 레이아웃을 그대로 확장 적용한다(Tablet 레이아웃은 콘텐츠 폭이 640px로 제한돼 있어 이 구간에서도 자연스럽다).

## 화면 그룹별 레이아웃 전략

Figma 실측 결과, 7개 화면은 두 그룹으로 나뉜다.

### A그룹 — 계산 흐름 화면 (S01, S02, S03, S04, S06)

| Breakpoint | 구조 |
| --- | --- |
| Mobile | 1컬럼, 상단 가로 StepTabs(4단계), 하단 sticky 버튼 |
| Tablet | **1컬럼 유지**. 콘텐츠 최대폭 640px로 중앙 정렬. 가로 StepTabs 유지(카드형, 완료 시 요약값 표시). 버튼은 sticky가 아니라 콘텐츠 마지막에 오는 정적(인라인) 버튼 |
| Desktop | **2컬럼**. 좌측 320px 세로 StepNav 사이드바(가로 StepTabs가 세로 카드 4개로 재배치) + 우측 720px 콘텐츠 컬럼. 버튼은 콘텐츠 컬럼 폭(720px)에 맞춰 정적 배치 |

S06은 문서상 "S05~S07은 헤더+뒤로가기만, StepTabs 없음" 원칙이었으나, Figma 실측 결과 태블릿·데스크톱 모두 S06에 StepTabs(4단계 완료 표시)가 유지되어 있다. **S06은 A그룹으로 재분류**한다(S04와 레이아웃이 사실상 동일하므로 자연스러운 재분류다).

### B그룹 — 그리드 화면 (S05, S07)

| Breakpoint | 구조 |
| --- | --- |
| Mobile | 1컬럼, 헤더+뒤로가기(S05)/헤더만(S07), 하단 sticky 버튼 |
| Tablet | 1컬럼 유지, 콘텐츠 최대폭 640px 중앙 정렬, 버튼 정적 배치. StepTabs 없음(원래 방침대로) |
| Desktop | **좌우 2컬럼 그리드**(좌 560px + 우 600px, 카드 폭 1200px을 거의 그대로 사용). StepNav 없음 |

- **S05**: 좌측 = 가용자금 요약 카드 + 목표 입력(textarea) + 배분안 카드, 우측 = 저축상품 후보 리스트. 모바일에서 세로로 순서대로 보던 것을 데스크톱에서는 나란히 동시에 보여준다.
- **S07**: 좌측 = 인사말 헤딩 + 히어로 카드(가용자금·하루예산·남은기간·진행바), 우측 = 계산 근거 카드 + "다시 계산하기" 버튼 + 안내 문구.

## 공통 요소: WebHeader

Tablet 이상에서 상단에 64px 높이의 공통 헤더가 새로 생긴다(모바일에는 없음, 모바일은 화면별 헤더+뒤로가기 유지).

- Tablet: 로고("이번달페이") + "홈 · 내 계산" 브레드크럼
- Desktop: 로고 + "홈" 내비게이션 링크만(마이페이지 미구현이므로 "계산하기"/"내기록" 등 추가 메뉴는 넣지 않는다 — "홈"만 두고 클릭 시 기존 `go-home` 액션 재사용)
- 화면별 뒤로가기 버튼(모바일의 `BackButton`)은 Tablet/Desktop에서도 각 화면 상단에 그대로 유지한다(WebHeader와 별개).

## CSS 구조 변경 계획

기존 `.app-shell`에 있던 "431px 초과 시 앱 셸을 430px로 제한하고 가운데 정렬"(폰 프레임처럼 보이게 하는 규칙)은 제거하고, 아래로 교체한다.

```css
:root {
  --content-max-tablet: 640px;
  --content-max-desktop: 1200px;
  --sidebar-width-desktop: 320px;
  --content-col-desktop: 720px;
}

/* Tablet: 768px 이상 */
@media (min-width: 768px) {
  .app-shell { max-width: var(--content-max-tablet); }
  .sticky-actions { position: static; margin: 24px 0 0; padding: 0; border: 0; background: none; box-shadow: none; }
  .screen { padding-bottom: 24px; } /* sticky 여백 예약 불필요 */
  .step-tabs { /* 카드형 유지, 필요 시 폭만 조정 */ }
}

/* Desktop: 1440px 이상 */
@media (min-width: 1440px) {
  .app-shell { max-width: var(--content-max-desktop); }

  /* A그룹(S01~S04, S06): 사이드바 + 콘텐츠 */
  .screen[data-screen="period"],
  .screen[data-screen="income"],
  .screen[data-screen="deductions"],
  .screen[data-screen="result"],
  .screen[data-screen="ai-result"] {
    display: grid;
    grid-template-columns: var(--sidebar-width-desktop) var(--content-col-desktop);
    gap: 60px;
    align-items: start;
  }
  .screen[data-screen="period"] .step-tabs,
  /* ...동일 화면들 */ {
    grid-column: 1;
    flex-direction: column; /* 가로 스크롤 탭 → 세로 스택 */
    height: auto;
  }

  /* B그룹(S05, S07): 좌우 2컬럼 그리드 */
  .screen[data-screen="ai-plan"] .screen__content,
  .screen[data-screen="home"] .home-dashboard {
    display: grid;
    grid-template-columns: 560px 600px;
    gap: 40px;
    align-items: start;
  }
}
```

위는 실제 코드가 아니라 방향성 스케치다. 구현 워커는 실제 `index.html`의 정확한 선택자를 확인하고 작성해야 한다. 핵심 아이디어는 다음과 같다.

1. **DOM 구조 변경을 최소화**한다. `.step-tabs`는 지금도 flex 컨테이너이므로, 데스크톱에서 `flex-direction: column`으로 바꾸는 것만으로 가로 탭 → 세로 사이드바 전환이 가능하다(JS/HTML 수정 불필요, CSS 미디어 쿼리만으로 충분).
2. **S05/S07의 2컬럼 그리드**를 위해서는 "왼쪽에 들어갈 요소들"과 "오른쪽에 들어갈 요소들"을 각각 하나의 wrapper로 묶어야 할 수 있다(현재 마크업 구조 확인 후 최소한의 wrapper `<div>` 추가가 필요할 수 있음). CSS Grid의 `grid-template-areas`를 쓰면 소스 순서를 유지하면서도 배치를 자유롭게 바꿀 수 있어, DOM 순서 변경 없이 시각적 배치만 바꾸는 방법도 고려한다.
3. **sticky 버튼 해제**는 Tablet 이상에서 `.sticky-actions`를 `position: static`으로 되돌리는 미디어 쿼리 한 줄로 충분하다.
4. Figma 태블릿 프레임에서 발견된 "일부 입력창(금액 입력, 목표 텍스트영역)이 카드 폭까지 안 늘어나고 모바일 폭에 고정되어 우측에 빈 여백이 남는" 현상은 **디자인 정합성 이슈로 판단해 그대로 재현하지 않는다.** 입력창은 콘텐츠 컬럼 폭에 맞춰 자연스럽게 늘어나도록 구현한다.

## 구현 순서 제안

1. `docs/02_UI_COMPONENTS.md`에 WebHeader, 세로 StepNav 변형, 2컬럼 그리드 컨테이너를 컴포넌트 표에 추가.
2. `css/tokens.css`에 breakpoint 관련 토큰 추가.
3. `css/app.css`에 768px/1440px 미디어 쿼리 작성(사이드바 그리드, 2컬럼 그리드, sticky 해제).
4. `index.html`에 WebHeader 마크업 추가(모바일에서는 `hidden`), S05/S07에 그리드 wrapper `<div>` 최소 추가.
5. 세 breakpoint(375px, 768px, 1440px) 각각에서 7개 화면 전체를 브라우저로 클릭 검증.

## 범위 밖(이번 계획에 포함하지 않음)

- 1024px 미만~768px 사이의 별도 중간 레이아웃(태블릿 레이아웃으로 커버).
- 데스크톱 WebHeader의 "내기록"/마이페이지 메뉴(마이페이지 자체가 범위 밖).
- Figma의 회색 캔버스·카드 그림자 등 프레젠테이션용 장식.
