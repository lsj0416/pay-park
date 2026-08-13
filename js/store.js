// Task B owns this file: 01_DATA_STATE_CALCULATION.md 저장 API

export const SCREEN = Object.freeze({
  HOME: "home",
  PERIOD: "period",
  INCOME: "income",
  DEDUCTIONS: "deductions",
  RESULT: "result",
  AI_PLAN: "ai-plan",
  AI_RESULT: "ai-result",
});

export const PAYDAY_PRESETS = Object.freeze([1, 5, 10, 15, 20, 25, 27, 30]);
export const FIXED_EXPENSE_PRESETS = Object.freeze(["관리비", "보험료"]);
export const SAVING_PRESETS = Object.freeze(["주식 정기매수", "연금", "ISA"]);

export const initialState = {
  version: 2,
  currentScreen: SCREEN.HOME,
  period: { payday: 10, startDate: "", endDate: "" },
  income: {
    basis: "gross",
    grossSalary: 0,
    netSalaryInput: 0,
  },
  deductions: {
    fixedExpenseItems: [
      { id: "fixed-rent", label: "월세", amount: 700000 },
      { id: "fixed-phone", label: "통신비", amount: 50000 },
      { id: "fixed-subscription", label: "구독료", amount: 20000 },
    ],
    savingItems: [{ id: "saving-installment", label: "적금", amount: 500000 }],
  },
  result: null,
  plan: null,
  updatedAt: null,
};

const STORAGE_KEY = "this-month-pay:v2";

const createInitialState = () => ({
  ...initialState,
  period: { ...initialState.period },
  income: { ...initialState.income },
  deductions: {
    fixedExpenseItems: initialState.deductions.fixedExpenseItems.map((item) => ({ ...item })),
    savingItems: initialState.deductions.savingItems.map((item) => ({ ...item })),
  },
});

export function loadState() {
  try {
    const storedState = localStorage.getItem(STORAGE_KEY);

    if (!storedState) {
      return createInitialState();
    }

    const parsedState = JSON.parse(storedState);

    if (!parsedState || parsedState.version !== 2) {
      return createInitialState();
    }

    return parsedState;
  } catch {
    return createInitialState();
  }
}

export function saveState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
}

export function patchState(partial) {
  const nextState = {
    ...loadState(),
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  return saveState(nextState);
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
