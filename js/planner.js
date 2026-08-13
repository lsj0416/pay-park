// Task D owns this file: 01_DATA_STATE_CALCULATION.md AI 계획 규칙

import { products } from "./products.js";

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

function parseAmount(match) {
  const rawNumber = Number(match[1].replaceAll(",", ""));
  const unit = match[2] === "억" ? 100000000 : match[2] === "만" ? 10000 : 1;
  return Math.round(rawNumber * unit);
}

function findGoalMatches(text) {
  return Object.entries(GOAL_KEYWORDS)
    .flatMap(([keyword, meta]) => {
      const matches = [];
      let fromIndex = 0;

      while (fromIndex < text.length) {
        const index = text.indexOf(keyword, fromIndex);
        if (index === -1) break;
        matches.push({ keyword, meta, index });
        fromIndex = index + keyword.length;
      }

      return matches;
    })
    .sort((a, b) => a.index - b.index);
}

function findNearbyAmount(text, keyword, index, previousMatch, nextMatch) {
  const afterKeyword = index + keyword.length;
  const afterEnd = Math.min(afterKeyword + 15, nextMatch?.index ?? text.length);
  const afterMatch = text.slice(afterKeyword, afterEnd).match(AMOUNT_PATTERN);
  if (afterMatch) return parseAmount(afterMatch);

  const beforeStart = Math.max(
    0,
    index - 10,
    previousMatch ? previousMatch.index + previousMatch.keyword.length : 0,
  );
  const beforeWindow = text.slice(beforeStart, index);
  const matches = [...beforeWindow.matchAll(new RegExp(AMOUNT_PATTERN.source, "g"))];
  const beforeMatch = matches.at(-1);
  return beforeMatch ? parseAmount(beforeMatch) : null;
}

function selectProductIds(category) {
  if (category === "stable") {
    return products
      .filter((product) => product.instantWithdraw)
      .map((product) => product.id)
      .concat(
        products
          .filter((product) => !product.instantWithdraw)
          .map((product) => product.id),
      );
  }

  return products.map((product) => product.id);
}

export function buildPlan(goalText, availableAmount) {
  const text = String(goalText ?? "").trim();
  const foundGoals = [];
  const seenIds = new Set();
  let category = "balanced";

  // 실제 AI 호출이 아닌, 문구 속 키워드와 가까운 금액을 연결하는 best-effort 파서다.
  const goalMatches = findGoalMatches(text);
  for (const [matchIndex, { keyword, meta, index }] of goalMatches.entries()) {
    if (seenIds.has(meta.id)) continue;

    const amount = findNearbyAmount(
      text,
      keyword,
      index,
      goalMatches[matchIndex - 1],
      goalMatches[matchIndex + 1],
    );
    if (!amount || amount <= 0) continue;

    foundGoals.push({ id: meta.id, label: meta.label, amount });
    seenIds.add(meta.id);
    if (meta.category === "stable" || category === "balanced") {
      category = meta.category;
    }
  }

  let goals = foundGoals;
  const availableWon = Math.max(0, Math.round(Number(availableAmount) || 0));

  if (goals.length === 0) {
    const fallbackAmount = Math.round(availableWon * 0.3);
    goals = [{ id: "goal", label: "목표 자금", amount: fallbackAmount }];
  }

  const goalTotal = goals.reduce((sum, goal) => sum + goal.amount, 0);
  if (goalTotal > availableWon && goalTotal > 0) {
    const scale = availableWon / goalTotal;
    goals = goals.map((goal) => ({ ...goal, amount: Math.round(goal.amount * scale) }));

    const roundingDifference =
      availableWon - goals.reduce((sum, goal) => sum + goal.amount, 0);
    goals[goals.length - 1].amount += roundingDifference;
  }

  const allocatedAmount = goals.reduce((sum, goal) => sum + goal.amount, 0);

  return {
    goalText: text,
    goals,
    remainingLiving: Math.max(0, availableWon - allocatedAmount),
    category,
    productIds: selectProductIds(category),
    appliedAt: new Date().toISOString(),
  };
}
