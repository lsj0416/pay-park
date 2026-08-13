# 공용 데이터·상태·계산 명세

> 이 문서는 Figma `유경` 페이지(node 79:2, 7개 화면) 실측 대조를 거쳐 갱신되었다. 이전 버전의 "월급 90% 정률 공제", "고정비/저축 단일 합계 입력", "생활비 50%·예비비 20%·목표자금 30% 고정 배분" 규칙은 Figma 디자인과 일치하지 않아 전면 교체되었다.

## 원칙

- 모든 금액의 단위는 원이며 정수로 저장한다.
- 표시할 때만 `Intl.NumberFormat("ko-KR")`로 천 단위 구분자를 붙인다.
- 계산 함수는 DOM과 저장소에 접근하지 않는 순수 함수로 작성한다.
- 파생값(하루 예산 등)은 저장하지 않아도 되지만, 완료 결과 스냅샷은 홈 복원을 위해 저장한다.

## 화면 상수

```js
export const SCREEN = Object.freeze({
  HOME: "home",
  PERIOD: "period",
  INCOME: "income",
  DEDUCTIONS: "deductions",
  RESULT: "result",
  AI_PLAN: "ai-plan",
  AI_RESULT: "ai-result",
});
```

화면 ID는 기존과 동일하게 7개를 유지한다(화면을 추가하지 않음). 다만 `RESULT`(S04)와 `AI_RESULT`(S06)는 Figma상 사실상 같은 "가용 자금 결과" 화면의 두 가지 상태(AI 계획 적용 전/후)이며, `AI_RESULT`는 `RESULT`와 동일한 카드 레이아웃에 AI 적용 배지가 얹힌 형태로 재정의되었다. 자세한 화면별 명세는 `03_FEATURE_SPEC.md` 참고.

## 저장 상태

```js
export const initialState = {
  version: 2,
  currentScreen: SCREEN.HOME,
  period: { payday: 10, startDate: "", endDate: "" },
  income: {
    basis: "gross", // "gross"(세전 월급 입력) | "net"(실수령액 직접 입력)
    grossSalary: 0,
    netSalaryInput: 0,
  },
  deductions: {
    fixedExpenseItems: [], // [{ id, label, amount }]
    savingItems: [],       // [{ id, label, amount }]
  },
  result: null,
  plan: null,
  updatedAt: null,
};
```

`version`을 1에서 2로 올렸다. `loadState()`는 저장된 데이터의 `version`이 2가 아니면 `initialState`로 복구한다(구버전 데이터와 새 스키마가 호환되지 않으므로).

### 월급일 프리셋

Figma는 자유 입력(스피너)이 아니라 프리셋 칩 목록을 사용한다.

```js
export const PAYDAY_PRESETS = [1, 5, 10, 15, 20, 25, 27, 30];
```

사용자는 이 8개 값 중 하나만 선택할 수 있다. 30일을 선택했는데 해당 월에 30일이 없는 경우(2월)에는 그 달의 마지막 날로 보정한다.

### 고정비·저축 항목 프리셋

Figma는 고정비/저축을 각각 여러 개의 항목(이름+금액) 리스트로 입력받는다. 화면에는 월세·통신비·구독료(고정비)/적금(저축)이 예시 데이터로 이미 채워져 있고, 그 아래 "빠른 추가" 칩은 아직 목록에 없는 항목만 제공한다.

```js
export const FIXED_EXPENSE_PRESETS = ["관리비", "보험료"];
export const SAVING_PRESETS = ["주식 정기매수", "연금", "ISA"];
```

프리셋을 누르면 금액 0원짜리 항목이 추가되고, "+ 직접 추가"를 누르면 빈 라벨의 항목이 추가된다. 각 항목은 이름·금액을 모두 수정할 수 있고 ✕ 버튼으로 삭제한다.

### 결과 스냅샷

```js
{
  estimatedTakeHome: 2775870,
  availableAmount: 1505870,
  fixedExpenses: 770000,
  savingCommitment: 500000,
  insuranceDeduction: 300930,
  taxDeduction: 123200,
  remainingDays: 29,
  dailyBudget: 51927,
  periodStart: "2026-08-10",
  periodEnd: "2026-09-09",
  calculatedAt: "2026-08-12T10:00:00.000Z"
}
```

### AI 계획 스냅샷

```js
{
  goalText: "이번 달 말에 여행 30만 원, 비상금 20만 원을 모으고 싶어요.",
  goals: [
    { id: "travel", label: "여행 준비금", amount: 300000 },
    { id: "emergency", label: "추가 비상금", amount: 200000 }
  ],
  remainingLiving: 1005870,
  adjustedDailyBudget: 34685,
  category: "balanced",
  productIds: ["todak-parking", "saerok-short-term"],
  appliedAt: "2026-08-12T10:05:00.000Z"
}
```

이전 버전의 `interpretation`(목적 해석 한 문장)과 `allocations`(생활비/예비비/목표자금 3분류, ratio 포함) 필드는 Figma 디자인에 존재하지 않아 제거했다. 대신 사용자가 언급한 목표별 금액(`goals`)과 그 나머지(`remainingLiving`, 화면에는 "남은 생활비"로 표시)로 구성한다.

## 계산식

Figma 예시(월급 3,200,000원)를 역산하면 아래 4대보험·소득세 근사 요율과 정확히 일치한다(2025년 기준 한국 4대보험 요율 근사치를 그대로 사용). 실제 세법의 누진 소득세는 구현하지 않고, 소득세+지방소득세는 정률 근사치로 대체한다.

```js
const INSURANCE_RATES = {
  health: 0.03545,              // 건강보험료율
  longTermCareOfHealth: 0.1295, // 장기요양보험료율(건강보험료 대비 비율)
  pension: 0.045,                // 국민연금료율
  employment: 0.009,             // 고용보험료율
};
const INCOME_TAX_RATE = 0.0385; // 소득세+지방소득세 근사 정률(실제 누진세율 아님, 프로토타입 근사치)

function calculateInsuranceDeduction(gross) {
  const health = Math.round(gross * INSURANCE_RATES.health);
  const longTermCare = Math.round(health * INSURANCE_RATES.longTermCareOfHealth);
  const pension = Math.round(gross * INSURANCE_RATES.pension);
  const employment = Math.round(gross * INSURANCE_RATES.employment);
  return health + longTermCare + pension + employment;
}

export function calculateBudget(state) {
  const fixed = sumItems(state.deductions.fixedExpenseItems);
  const saving = sumItems(state.deductions.savingItems);

  let estimatedTakeHome;
  let insuranceDeduction = 0;
  let taxDeduction = 0;

  if (state.income.basis === "net") {
    estimatedTakeHome = toWon(state.income.netSalaryInput);
  } else {
    const gross = toWon(state.income.grossSalary);
    insuranceDeduction = calculateInsuranceDeduction(gross);
    taxDeduction = Math.round(gross * INCOME_TAX_RATE);
    estimatedTakeHome = Math.max(0, gross - insuranceDeduction - taxDeduction);
  }

  const availableAmount = Math.max(0, estimatedTakeHome - fixed - saving);

  return {
    estimatedTakeHome,
    availableAmount,
    fixedExpenses: fixed,
    savingCommitment: saving,
    insuranceDeduction,
    taxDeduction,
  };
}
```

```js
const toWon = (value) => Math.max(0, Math.round(Number(value) || 0));
const sumItems = (items) => (items ?? []).reduce((sum, item) => sum + toWon(item.amount), 0);
```

검증(Figma S02~S04 표시값과 정확히 일치):

```js
calculateBudget({
  income: { basis: "gross", grossSalary: 3200000 },
  deductions: {
    fixedExpenseItems: [{ amount: 700000 }, { amount: 50000 }, { amount: 20000 }],
    savingItems: [{ amount: 500000 }],
  },
});
// { estimatedTakeHome: 2775870, availableAmount: 1505870,
//   fixedExpenses: 770000, savingCommitment: 500000,
//   insuranceDeduction: 300930, taxDeduction: 123200 }
```

`basis === "net"`일 때는 사용자가 실수령액을 직접 입력하며, 4대보험·소득세 내역 카드는 표시하지 않는다.

### 하루 예산

```js
function daysBetween(fromDate, toDate) {
  const MS_PER_DAY = 86400000;
  return Math.round((toDate.setHours(0,0,0,0) - fromDate.setHours(0,0,0,0)) / MS_PER_DAY);
}

export function calculateDailyBudget(availableAmount, periodEnd, today = new Date()) {
  const remainingDays = Math.max(1, daysBetween(new Date(today), new Date(periodEnd)) + 1);
  return { remainingDays, dailyBudget: Math.round(availableAmount / remainingDays) };
}
```

검증: `periodEnd`가 2026-09-09이고 `today`가 2026-08-12이면 `remainingDays = 29`, `availableAmount = 1505870`일 때 `dailyBudget = 51927`(Figma S04/S07 표시값과 일치).

## AI 계획 규칙

실제 AI 호출 대신, 입력 문구에서 "키워드 + 금액" 쌍을 정규식으로 추출하는 규칙 기반 로직을 사용한다. 진짜 자연어 이해가 아니라 문구 안의 숫자를 최대한 활용하는 최선 노력(best-effort) 파서임을 코드 주석에 명시한다.

```js
const GOAL_KEYWORDS = {
  "비상금": { id: "emergency", label: "추가 비상금", category: "stable" },
  "안전": { id: "emergency", label: "추가 비상금", category: "stable" },
  "예비": { id: "emergency", label: "추가 비상금", category: "stable" },
  "여행": { id: "travel", label: "여행 준비금", category: "short-term" },
  "이사": { id: "moving", label: "이사 준비금", category: "short-term" },
  "결혼": { id: "wedding", label: "결혼 준비금", category: "short-term" },
  "목돈": { id: "lump-sum", label: "목돈 준비금", category: "short-term" },
  "투자": { id: "long-term", label: "장기 준비금", category: "long-term" },
  "장기": { id: "long-term", label: "장기 준비금", category: "long-term" },
  "노후": { id: "long-term", label: "장기 준비금", category: "long-term" },
};

// "30만 원", "30만원", "300,000원", "300000원" 형태의 금액을 인식한다.
const AMOUNT_PATTERN = /(\d[\d,]*)\s*(억|만)?\s*원?/;

export function buildPlan(goalText, availableAmount) {
  const text = String(goalText ?? "").trim();
  const foundGoals = [];
  const seenIds = new Set();
  let category = "balanced";

  for (const [keyword, meta] of Object.entries(GOAL_KEYWORDS)) {
    const index = text.indexOf(keyword);
    if (index === -1 || seenIds.has(meta.id)) continue;
    const window = text.slice(Math.max(0, index - 10), index + keyword.length + 15);
    const match = window.match(AMOUNT_PATTERN);
    if (!match) continue;
    const rawNumber = Number(match[1].replaceAll(",", ""));
    const unit = match[2] === "억" ? 100000000 : match[2] === "만" ? 10000 : 1;
    const amount = Math.round(rawNumber * unit);
    if (amount <= 0) continue;
    foundGoals.push({ id: meta.id, label: meta.label, amount });
    seenIds.add(meta.id);
    category = meta.category === "stable" || category === "balanced" ? meta.category : category;
  }

  let goals = foundGoals;
  const availableWon = Math.max(0, Math.round(Number(availableAmount) || 0));

  if (goals.length === 0) {
    // 금액을 특정할 수 없으면 목표 자금 30%를 기본값으로 제안한다.
    const fallbackAmount = Math.round(availableWon * 0.3);
    goals = [{ id: "goal", label: "목표 자금", amount: fallbackAmount }];
  }

  const goalTotal = goals.reduce((sum, g) => sum + g.amount, 0);
  if (goalTotal > availableWon && goalTotal > 0) {
    // 합계가 가용 자금을 넘으면 비율대로 줄여서 맞춘다.
    const scale = availableWon / goalTotal;
    goals = goals.map((g) => ({ ...g, amount: Math.round(g.amount * scale) }));
  }

  const remainingLiving = Math.max(0, availableWon - goals.reduce((sum, g) => sum + g.amount, 0));
  const productIds = selectProductIds(category);

  return {
    goalText: text,
    goals,
    remainingLiving,
    category,
    productIds,
    appliedAt: new Date().toISOString(),
  };
}
```

`카테고리(category)`는 화면에 문장으로 노출하지 않고, 상품 후보 필터링(수시입출금 우선 여부)에만 내부적으로 사용한다. "조정된 하루 예산"은 `calculateDailyBudget(remainingLiving, periodEnd, today)`로 별도 계산해 표시한다.

## 저축상품 예시 데이터

Figma는 실제처럼 보이되 가상인 은행명·상품명·금리를 사용한다(실제 존재하는 은행이 아님). 실제 은행 API 연동이나 실시간 금리가 아니라는 점을 안내 문구로 반드시 표시한다.

```js
export const products = [
  {
    id: "todak-parking",
    name: "토닥 파킹통장",
    bankName: "토닥은행",
    type: "자유입출금",
    term: null,
    rate: 0.031,
    instantWithdraw: true,
    note: "중도 출금 가능",
  },
  {
    id: "saerok-short-term",
    name: "6개월 단기적금",
    bankName: "새록저축은행",
    type: "단기적금",
    term: "6개월",
    rate: 0.045,
    instantWithdraw: false,
  },
  {
    id: "pureun-free-savings",
    name: "자유적금 12M",
    bankName: "푸른은행",
    type: "정기적금",
    term: "12개월",
    rate: 0.04,
    instantWithdraw: false,
  },
];

function selectProductIds(category) {
  if (category === "stable") {
    return products.filter((p) => p.instantWithdraw).map((p) => p.id).concat(
      products.filter((p) => !p.instantWithdraw).map((p) => p.id)
    );
  }
  return products.map((p) => p.id);
}
```

S05에는 "급할 때 꺼내 쓸 수 있어야 해요" 토글이 있어, 켜면 `instantWithdraw: true`인 상품을 우선 정렬해 보여준다.

## 저장 API

```js
const STORAGE_KEY = "this-month-pay:v2";

export function loadState() {}
export function saveState(nextState) {}
export function patchState(partial) {}
export function clearState() {}
```

- `STORAGE_KEY`를 `v1`에서 `v2`로 올렸다(스키마 변경으로 구버전 데이터와 호환 불가).
- 입력 변경 후 blur 또는 다음 버튼 클릭 시 저장한다.
- S04 계산 완료와 S05 계획 적용(→S06 진입) 시 즉시 저장한다.
- 파싱 실패나 버전 불일치 시 `initialState`로 복구한다.
- 민감한 개인정보는 입력받지 않는다(사용자 이름 등도 받지 않음 — `03_FEATURE_SPEC.md`의 S07 참고).

## 화면 이동 규칙

- URL 라우팅을 사용하지 않고 단일 `index.html` 안에서 활성 `<section>`만 교체한다.
- `navigate(screenId)`가 `hidden`, `aria-hidden`, 스크롤 위치와 `currentScreen`을 한 번에 갱신한다.
- 상단 단계 탭(StepTabs)은 S01~S04에서 표시하며, 완료한 단계는 요약값과 함께 다시 탭 이동할 수 있다(상세는 `02_UI_COMPONENTS.md`).
- S05~S07에서는 상단 단계 탭 대신 헤더의 뒤로가기 버튼으로 계층을 구분한다.
