# UI·공통 컴포넌트 명세

> Figma `유경` 페이지(node 79:2)의 7개 화면(79:3, 79:100, 79:207, 79:367, 79:467, 79:629, 79:953)을 MCP로 직접 조회해 아래 토큰·컴포넌트를 갱신했다. 이전 버전의 색상 토큰(`#3567e8` 계열)과 폰트(Pretendard)는 Figma 실측과 달라 교체되었다.

## 디자인 기준

Figma 파일의 `유경` 페이지를 단일 시각 기준으로 사용한다. 개발 중 임의로 화면을 추가하지 않으며, 모바일 375px을 기준으로 구현하고 320~430px에서 깨지지 않게 한다. Figma 프레임 자체는 390px 폭 + 24px 여백을 기준으로 그려져 있다.

## 화면 골격

```html
<main class="app-shell">
  <section class="screen" data-screen="home"></section>
  <section class="screen" data-screen="period" hidden></section>
  <section class="screen" data-screen="income" hidden></section>
  <section class="screen" data-screen="deductions" hidden></section>
  <section class="screen" data-screen="result" hidden></section>
  <section class="screen" data-screen="ai-plan" hidden></section>
  <section class="screen" data-screen="ai-result" hidden></section>
</main>
```

7개 section 구조는 그대로 유지한다(화면 추가 없음).

## 토큰

Figma에서 실측한 값으로 교체했다. 색상 변수명은 Figma의 시맨틱 이름을 따른다.

```css
:root {
  --color-bg-brand: #1b64da;
  --color-bg-brand-soft: #e8f3ff;
  --color-text-brand: #1b64da;
  --color-bg-canvas: #f7f8fa;
  --color-bg-surface: #ffffff;
  --color-text-primary: #191f28;
  --color-text-secondary: #6b7684;
  --color-text-tertiary: #8b95a1;
  --color-text-inverse: #ffffff;
  --color-border-default: #e5e8eb;
  --color-danger: #d92d20;
  --radius-card: 12px;
  --radius-input: 10px;
  --radius-step-tab: 14px;
  --radius-pill: 999px;
  --shadow-card: 0 4px 8px rgb(0 0 0 / 8%);
  --space-page: 24px;
}
```

기존 변수명(`--color-primary`, `--color-bg`, `--color-text`, `--color-muted`, `--color-line`, `--radius-control`)을 이미 참조하는 코드가 있다면, 위 표대로 값과 이름을 함께 바꾼다.

| 이전 변수 | 이전 값 | 신규 변수 | 신규 값 |
| --- | --- | --- | --- |
| `--color-primary` | `#3567e8` | `--color-bg-brand` / `--color-text-brand` | `#1b64da` |
| `--color-primary-soft` | `#eaf2ff` | `--color-bg-brand-soft` | `#e8f3ff` |
| `--color-bg` | `#f6f7f9` | `--color-bg-canvas` | `#f7f8fa` |
| `--color-surface` | `#ffffff` | `--color-bg-surface` | `#ffffff`(동일) |
| `--color-text` | `#20242c` | `--color-text-primary` | `#191f28` |
| `--color-muted` | `#737b8c` | `--color-text-secondary` | `#6b7684` |
| `--color-line` | `#e5e8ef` | `--color-border-default` | `#e5e8eb` |
| `--radius-card` | `16px` | `--radius-card` | `12px` |
| `--radius-control` | `12px` | `--radius-input` | `10px` |
| (없음) | — | `--color-text-tertiary` | `#8b95a1` (비활성 탭·캡션 등 보조 아이콘/텍스트) |

폰트는 `Noto Sans KR`(Regular/Medium/Bold)을 1순위로 사용한다.

```css
:root {
  font-family: "Noto Sans KR", Pretendard, "Apple SD Gothic Neo", system-ui, sans-serif;
}
```

## 공통 컴포넌트

| 이름 | 구현 형태 | 사용 위치 |
| --- | --- | --- |
| `ScreenHeader` | 제목 + 선택적 뒤로가기(BackButton) | 전 화면(S07 제외) |
| `BackButton` | 36×36px 원형 버튼, `←` 글자 아이콘 | S01~S06 헤더 |
| `StepTabs` | 4개 카드형 탭(번호/체크 + 라벨 + 요약값 또는 상태) | S01~S04 |
| `MoneyField` | 숫자 입력 + 원 표시 + 오류 | S02(월급/실수령액), 항목 리스트 금액 칸 |
| `ItemListInput` | 이름+금액 입력 항목 리스트 + 프리셋 칩 + "직접 추가" | S03(고정비/저축) |
| `SummaryCard` | 라벨, 금액, 보조 설명 | S02~S07 |
| `HeroCard` | 브랜드색 배경의 대표 금액 카드(가용 자금/하루 예산) | S04, S06, S07 |
| `PrimaryButton` | 하단 고정 주요 행동, radius 12px | 전 화면 |
| `PillButton` | 완전 원형(pill) 보조 버튼, S05 "계획 세우기"/"예시" | S05 |
| `SecondaryButton` | 보조 행동 | S03~S07 |
| `GoalChip` | 목표 빠른 선택 칩(선택 상태 토글) — **S05 실제 디자인에는 없음, 구현하지 않는다** | (사용 안 함) |
| `GoalListInput` | 목표별 배분 결과 리스트(라벨+금액) | S05, S06, S07 |
| `ProductCard` | 은행명·유형·기간·금리·보조문구를 보여주는 리스트 아이템 | S05 |
| `ToggleSwitch` | on/off 스위치, S05 "급할 때 꺼내 쓸 수 있어야 해요" | S05 |
| `Notice` | 추정치·저장·금융 안내 | S02, S04, S05, S06, S07 |
| `BottomNav` | 하단 탭바(홈/마이), "마이"는 비활성 처리 | S07 |

컴포넌트는 프레임워크 객체가 아니라 HTML 템플릿 함수 또는 고정 마크업 + 갱신 함수로 구현한다.

```js
export function renderMoney(value) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export function updateSummaryCard(element, { label, value, description }) {}
```

이전 버전에 있던 `AllocationBar`(비율 막대 그래프)는 Figma S05~S07에 존재하지 않는다. 목표별 배분은 막대그래프가 아니라 라벨+금액 텍스트 리스트(`GoalListInput`)로 표시한다.

## 단계 탭(StepTabs) 규칙

Figma 실측 기준으로 이전보다 훨씬 정보량이 많다. 단순 라벨 버튼이 아니라 2줄 카드형 탭이다.

- 순서와 번호: `1 예산 기간 | 2 소득 입력 | 3 고정비·저축 | 4 계산 결과`(마지막 탭 라벨은 "가용 자금 결과"가 아니라 "계산 결과").
- 각 탭은 2줄 구조: 1줄 = 번호(또는 완료 시 `✓`) + 라벨, 2줄 = 상태 텍스트.
  - 완료된 탭: `✓ {라벨}` + 요약값(예: `8/10~`, `세전 320만`, `총 127만`), 배경 `--color-bg-brand-soft`, 글자 `--color-text-brand`.
  - 현재 탭: `{번호} {라벨}` + `입력 중`, 배경 `--color-bg-brand`, 글자 `--color-text-inverse`, `aria-current="step"`.
  - 잠긴(미완료) 탭: `{번호} {라벨}` + `잠김`, 흰 배경 + `--color-border-default` 테두리, 비활성(disabled).
- 완료 단계는 선택 가능하고, 미완료 미래 단계는 비활성화한다. 탭을 눌러 이전 단계로 이동하면 기존 값을 그대로 보여준다.
- 탭 컨테이너 높이 60px, 개별 탭 radius 14px(`--radius-step-tab`), 탭 간 gap 8px.
- 현재 탭은 `scrollIntoView({ inline: "center", block: "nearest" })`로 노출한다.
- S05~S07에서는 StepTabs 대신 `BackButton` + 화면 제목으로 계층을 구분한다(S07은 뒤로가기도 없음).

## 헤더·뒤로가기 규칙

S01~S06 모든 화면 헤더에 36×36px 원형 `BackButton`(`←`)이 있다. 이전 화면으로 이동하며, 입력값은 유지한다. S07(홈)에는 뒤로가기가 없다.

## 입력 규칙

- 금액 필드는 숫자 키패드를 위해 `inputmode="numeric"`를 사용한다.
- 화면 표시용 콤마와 내부 숫자 값을 분리한다.
- 음수, 문자, `NaN`은 0 또는 오류 상태로 처리한다.
- 필수 입력이 없으면 다음 버튼을 비활성화하고 필드 아래에 이유를 표시한다.
- `ItemListInput`(고정비/저축)은 각 항목이 이름 입력칸 + 금액 입력칸 + 삭제(✕) 버튼으로 구성된다. 프리셋 칩을 누르면 해당 이름의 항목(금액 0원)이 추가되고, "+ 직접 추가"는 빈 이름 항목을 추가한다. 최소 0개 항목도 허용한다(빈 리스트 = 0원).
- 포커스 시 하단 버튼이 키보드에 가려지지 않도록 충분한 하단 여백을 둔다.

## 하단 버튼

- 기본적으로 화면 하단에 sticky로 배치한다.
- 스크롤 콘텐츠가 버튼에 가려지지 않도록 `padding-bottom`을 버튼 높이보다 크게 둔다. sticky 바 높이가 버튼 개수에 따라 달라지므로, 예약 여백은 버튼 3개 기준(약 220px) 이상으로 넉넉히 잡는다.
- 로딩 애니메이션은 0.6~1초 이내의 시연용 상태만 사용하고, 실제 네트워크 요청처럼 오래 기다리게 하지 않는다.
- 버튼 크기: 하단 고정 PrimaryButton은 높이 52px, radius 12px. S05의 "계획 세우기"/"예시"는 완전 원형(pill) 보조 버튼이다.

## 접근성·반응형

- 본문과 배경의 명도 대비는 WCAG AA를 목표로 한다.
- 터치 영역은 최소 44×44px로 한다(원형 뒤로가기 버튼 36px는 아이콘 히트 영역을 44px 이상으로 확장해서 보완한다).
- 색만으로 선택 상태를 전달하지 않고 텍스트·아이콘·테두리를 함께 사용한다.
- `prefers-reduced-motion`에서는 전환 애니메이션을 제거한다.
- 430px 초과에서는 앱 셸 최대 너비를 430px로 제한하고 가운데 정렬한다.
