// Task B owns this file: 01_DATA_STATE_CALCULATION.md 계산식

const INSURANCE_RATES = Object.freeze({
  health: 0.03545,
  longTermCareOfHealth: 0.1295,
  pension: 0.045,
  employment: 0.009,
});

const INCOME_TAX_RATE = 0.0385;
const MS_PER_DAY = 86400000;

const toNumber = (value) => {
  const normalized = typeof value === "string" ? value.replaceAll(",", "").trim() : value;
  return Number(normalized) || 0;
};

const toWon = (value) => Math.max(0, Math.round(toNumber(value)));
const sumItems = (items) =>
  (items ?? []).reduce((sum, item) => sum + toWon(item?.amount), 0);

function calculateInsuranceDeduction(gross) {
  const health = Math.round(gross * INSURANCE_RATES.health);
  const longTermCare = Math.round(health * INSURANCE_RATES.longTermCareOfHealth);
  const pension = Math.round(gross * INSURANCE_RATES.pension);
  const employment = Math.round(gross * INSURANCE_RATES.employment);

  return health + longTermCare + pension + employment;
}

function daysBetween(fromDate, toDate) {
  return Math.round(
    (toDate.setHours(0, 0, 0, 0) - fromDate.setHours(0, 0, 0, 0)) / MS_PER_DAY,
  );
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

export function calculateDailyBudget(availableAmount, periodEnd, today = new Date()) {
  const remainingDays = Math.max(
    1,
    daysBetween(new Date(today), new Date(periodEnd)) + 1,
  );

  return {
    remainingDays,
    dailyBudget: Math.round(toWon(availableAmount) / remainingDays),
  };
}

// paymentAmount <= 0(또는 숫자가 아님)이면 null을 반환한다 — 호출자가 입력값 검증을 이미 마쳤다고 가정하는
// 순수 함수이므로, 유효하지 않은 금액이 들어온 경우의 표시 문구는 호출자(ui) 책임이다.
export function evaluatePurchase({ paymentAmount, availableFunds, dailyBudget, remainingDays }) {
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return null;

  const safeRemainingDays = Math.max(1, remainingDays);
  const remainingAfterPayment = availableFunds - paymentAmount;
  const adjustedDailyBudget = Math.floor(Math.max(0, remainingAfterPayment) / safeRemainingDays);

  if (paymentAmount > availableFunds) {
    return {
      status: "OVER_BUDGET",
      remainingAfterPayment,
      adjustedDailyBudget,
      overAmount: paymentAmount - availableFunds,
    };
  }

  if (paymentAmount <= dailyBudget) {
    return {
      status: "SAFE",
      remainingAfterPayment,
      adjustedDailyBudget,
    };
  }

  const excessAmount = paymentAmount - dailyBudget;
  const absorptionDays = Math.max(1, Math.min(5, safeRemainingDays));
  const savingPerDay = Math.ceil(excessAmount / absorptionDays);

  return {
    status: "CAUTION",
    remainingAfterPayment,
    adjustedDailyBudget,
    excessAmount,
    absorptionDays,
    savingPerDay,
  };
}

export function sumPurchases(purchases) {
  return sumItems(purchases);
}
