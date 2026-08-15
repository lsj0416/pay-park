// Task D owns this file: AI 소비 코치 규칙 기반 파서·제안 생성

// "25,000원", "60000원", "2,000,000원" 형태의 금액을 인식한다. planner.js의 AMOUNT_PATTERN과
// 비슷하지만, 상품명을 앞쪽 텍스트에서 잘라내야 하므로 "원"을 필수로 요구한다.
const AMOUNT_PATTERN = /(\d[\d,]*)\s*(억|만)?\s*원/;

const DATE_KEYWORDS = ["오늘", "내일", "모레", "이번 주", "이번주", "다음 주", "다음주"];

// 상품명 앞에 흔히 붙는 시점 표현·대명사·1인칭 주어를 반복적으로 제거한다.
const LEADING_STRIP_PATTERN = /^(오늘|내일|모레|이번\s*주|다음\s*주|저는|제가|나는|이거|이것|그거|그것|저거|저것|저|나)\s*/;

// 금액을 찾지 못했을 때, 문장 끝의 "~사도 될까요?" 류 질문형 어미를 제거하기 위한 best-effort 패턴이다.
const TRAILING_QUESTION_PATTERN =
  /(사도|먹어도|해도|써도|타도|가도)?\s*(될까요?|되나요?|돼요?|괜찮을까요?|괜찮나요?)\s*[?？.]*$/;

const PRONOUN_ONLY = new Set(["이거", "이것", "그거", "그것", "저거", "저것"]);

function parseAmount(match) {
  const rawNumber = Number(match[1].replaceAll(",", ""));
  const unit = match[2] === "억" ? 100000000 : match[2] === "만" ? 10000 : 1;
  return Math.round(rawNumber * unit);
}

function stripLeading(text) {
  let result = text.trim();
  let previous;
  do {
    previous = result;
    result = result.replace(LEADING_STRIP_PATTERN, "").trim();
  } while (result !== previous);
  return result;
}

function extractPlannedDate(text) {
  for (const keyword of DATE_KEYWORDS) {
    if (text.includes(keyword)) return keyword;
  }
  return null;
}

// 금액을 찾은 경우: 금액 매치 이전 텍스트를 상품명 후보로 본다.
function extractItemNameBeforeAmount(text, amountIndex) {
  const itemName = stripLeading(text.slice(0, amountIndex));
  return itemName.length > 0 ? itemName : null;
}

// 금액을 못 찾은 경우: 질문형 어미와 대명사를 제거해보고, 남는 게 없거나 대명사뿐이면 null.
function extractItemNameFallback(text) {
  const withoutQuestion = text.replace(TRAILING_QUESTION_PATTERN, "").trim();
  const itemName = stripLeading(withoutQuestion);
  if (!itemName || PRONOUN_ONLY.has(itemName)) return null;
  return itemName;
}

// 자연어 문장에서 상품명/금액/시점/목적을 최대한 추출하는 순수 함수(동기, DOM 접근 없음).
// 완벽한 자연어 파서가 아닌 best-effort 파서다 — 금액을 찾지 못하면 절대 임의로 추정하지 않는다.
export function parseSpendingInput(text) {
  const normalized = String(text ?? "").trim();

  if (!normalized) {
    return { itemName: null, amount: null, plannedDate: null, purpose: null };
  }

  const amountMatch = normalized.match(AMOUNT_PATTERN);
  const amount = amountMatch ? parseAmount(amountMatch) : null;

  const itemName = amountMatch
    ? extractItemNameBeforeAmount(normalized, amountMatch.index)
    : extractItemNameFallback(normalized);

  const plannedDate = extractPlannedDate(normalized);

  return { itemName, amount, plannedDate, purpose: null };
}

const VALID_STATUSES = new Set(["SAFE", "CAUTION", "OVER_BUDGET"]);

function formatWon(amount) {
  return Number(amount).toLocaleString("ko-KR");
}

function randomDelayMs() {
  return 400 + Math.floor(Math.random() * 301); // 400~700ms
}

function buildSafeAdvice(evaluation) {
  return {
    explanation: `이 결제는 오늘 예산 안이에요. 결제 후에도 하루 ${formatWon(evaluation.adjustedDailyBudget)}원을 쓸 수 있고 이번 달 목표도 유지돼요.`,
    alternatives: [],
  };
}

function buildCautionAdvice(evaluation, paymentAmount, dailyBudget) {
  return {
    explanation: "오늘 하루 예산을 넘는 결제예요. 며칠에 나눠서 흡수하거나 금액을 낮추는 방법이 있어요.",
    recommendedOption: {
      id: "recommended-absorb",
      title: `${evaluation.absorptionDays}일간 하루 ${formatWon(evaluation.savingPerDay)}원씩 조정`,
      description: `결제액은 그대로 유지하고, 초과분 ${formatWon(evaluation.excessAmount)}원을 ${evaluation.absorptionDays}일에 나눠 하루 예산에서 흡수해요.`,
      adjustmentDays: evaluation.absorptionDays,
      adjustmentAmount: evaluation.savingPerDay,
      commitAmount: paymentAmount,
    },
    alternatives: [
      {
        id: "alt-lower-amount",
        title: `구매 금액을 ${formatWon(dailyBudget)}원으로 낮추기`,
        adjustmentAmount: dailyBudget,
        commitAmount: dailyBudget,
      },
    ],
  };
}

function buildOverBudgetAdvice(evaluation, paymentAmount) {
  const availableFunds = paymentAmount - evaluation.overAmount;

  return {
    explanation: "이번 결제는 이번 달 가용 자금을 넘어요. 지금 결제하는 대신 다른 방법을 찾아볼까요?",
    recommendedOption: {
      id: "recommended-next-month",
      title: "다음 달 구매 계획 만들기",
      description: "이번 달 대신 다음 달 예산으로 이 구매를 계획해볼 수 있어요.",
    },
    alternatives: [
      {
        id: "alt-max-affordable",
        title: "현재 가능한 최대 금액 확인하기",
        description: `지금 예산으로는 ${formatWon(availableFunds)}원까지 결제할 수 있어요.`,
      },
    ],
  };
}

// evaluatePurchase()가 반환한 값만으로 설명·제안 문구를 조립한다 — 이 함수는 금액이나 일수를
// 독자적으로 계산하지 않는다. 실제로는 동기 계산이지만, 로딩 UX를 위해 인위적으로 지연시킨다.
export function getSpendingCoachAdvice({
  status,
  paymentAmount,
  evaluation,
  dailyBudget,
  remainingDays,
  parsedInput,
} = {}) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!evaluation || !VALID_STATUSES.has(status)) {
        reject(new Error("getSpendingCoachAdvice: invalid status or evaluation"));
        return;
      }

      let advice;
      if (status === "SAFE") {
        advice = buildSafeAdvice(evaluation);
      } else if (status === "CAUTION") {
        advice = buildCautionAdvice(evaluation, paymentAmount, dailyBudget);
      } else {
        advice = buildOverBudgetAdvice(evaluation, paymentAmount);
      }

      resolve({
        ...(parsedInput ? { parsedInput } : {}),
        ...advice,
      });
    }, randomDelayMs());
  });
}
