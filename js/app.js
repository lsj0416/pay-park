// Task C owns this file: v2 application entry point and state/event wiring.

import { calculateBudget, calculateDailyBudget, evaluatePurchase, sumPurchases } from "./calculator.js";
import { buildPlan } from "./planner.js";
import { products } from "./products.js";
import { parseSpendingInput, getSpendingCoachAdvice } from "./spendingCoach.js";
import { PAYDAY_PRESETS, SCREEN, initialState, loadState, patchState } from "./store.js";
import {
  closeModal,
  formatMoneyInput,
  openModal,
  renderCoachInfoCards,
  renderCoachOptions,
  renderGoalList,
  renderItemRows,
  renderMoney,
  renderProductCards,
  setHidden,
  setHiddenAll,
  setProgress,
  setText,
  setTextAll,
} from "./ui.js";

const screenIds = new Set(Object.values(SCREEN));
const query = (selector, root = document) => root.querySelector(selector);
const queryAll = (selector, root = document) => [...root.querySelectorAll(selector)];

function safeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: String(item?.id ?? `recovered-${index}`),
    label: String(item?.label ?? ""),
    amount: toWon(item?.amount),
  }));
}

function safePurchaseItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    id: String(item?.id ?? `purchase-${index}`),
    label: String(item?.label ?? ""),
    amount: toWon(item?.amount),
    createdAt: typeof item?.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
  }));
}

function normalizeState(candidate) {
  const state = candidate && typeof candidate === "object" ? candidate : initialState;
  const result = state.result && typeof state.result === "object"
    && Number.isFinite(Number(state.result.availableAmount))
    && Number.isFinite(Number(state.result.estimatedTakeHome))
    ? state.result
    : null;
  const plan = state.plan && typeof state.plan === "object" && Array.isArray(state.plan.goals)
    ? {
        ...state.plan,
        goalText: String(state.plan.goalText ?? ""),
        goals: safeItems(state.plan.goals),
        remainingLiving: toWon(state.plan.remainingLiving),
        productIds: Array.isArray(state.plan.productIds)
          ? state.plan.productIds.map(String)
          : [],
      }
    : null;
  return {
    ...initialState,
    ...state,
    currentScreen: screenIds.has(state.currentScreen) ? state.currentScreen : SCREEN.HOME,
    period: { ...initialState.period, ...(state.period ?? {}) },
    income: { ...initialState.income, ...(state.income ?? {}) },
    deductions: {
      fixedExpenseItems: safeItems(state.deductions?.fixedExpenseItems),
      savingItems: safeItems(state.deductions?.savingItems),
    },
    result,
    plan,
    purchases: safePurchaseItems(state.purchases),
  };
}

let appState = normalizeState(loadState());
let draftPlan = appState.currentScreen === SCREEN.AI_PLAN ? appState.plan : null;
let instantWithdrawFirst = false;
let sampleExpanded = false;
let goalDebounceTimer = null;
let planReturnScreen = SCREEN.RESULT;

function toWon(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.startsWith("-") || !/^[\d,\s]+$/.test(raw)) return 0;
  const number = Number(raw.replaceAll(",", "").replaceAll(" ", ""));
  return Number.isSafeInteger(number) ? Math.max(0, number) : 0;
}

function updateState(partial) {
  appState = normalizeState(patchState(partial));
  return appState;
}

function invalidateResult() {
  draftPlan = null;
  return { result: null, plan: null };
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function adjustedPayday(year, month, payday) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(payday, lastDay));
}

function calculatePeriod(payday, today = new Date()) {
  const normalizedPayday = Number(payday);
  if (!PAYDAY_PRESETS.includes(normalizedPayday)) return null;

  const thisMonth = adjustedPayday(today.getFullYear(), today.getMonth(), normalizedPayday);
  const start = today < thisMonth
    ? adjustedPayday(today.getFullYear(), today.getMonth() - 1, normalizedPayday)
    : thisMonth;
  const next = adjustedPayday(start.getFullYear(), start.getMonth() + 1, normalizedPayday);
  const end = new Date(next);
  end.setDate(end.getDate() - 1);
  return { payday: normalizedPayday, startDate: localDateString(start), endDate: localDateString(end) };
}

function parseLocalDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shortDate(value) {
  const date = parseLocalDate(value);
  return date ? `${date.getMonth() + 1}월 ${date.getDate()}일` : "-";
}

function slashDate(value) {
  const date = parseLocalDate(value);
  return date ? `${date.getMonth() + 1}/${date.getDate()}~` : "-";
}

function inclusiveDays(startValue, endValue) {
  const start = parseLocalDate(startValue);
  const end = parseLocalDate(endValue);
  if (!start || !end) return 0;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function periodText(period, includeDays = false) {
  if (!period?.startDate || !period?.endDate) return "예산 기간을 설정해주세요.";
  const base = `${shortDate(period.startDate)} – ${shortDate(period.endDate)}`;
  return includeDays ? `${base} · ${inclusiveDays(period.startDate, period.endDate)}일` : base;
}

function salaryValue(state = appState) {
  return state.income.basis === "net"
    ? toWon(state.income.netSalaryInput)
    : toWon(state.income.grossSalary);
}

function dailyFor(availableAmount, state = appState) {
  if (!state.period?.endDate) return { remainingDays: 1, dailyBudget: toWon(availableAmount) };
  return calculateDailyBudget(availableAmount, state.period.endDate);
}

function currentBudget(state = appState) {
  return state.result ?? calculateBudget(state);
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function syncSalaryField(state) {
  const input = query('[data-field="gross-salary"]');
  if (!input || document.activeElement === input) return;
  input.value = salaryValue(state) ? formatMoneyInput(salaryValue(state)) : "";
}

function renderIncome(state) {
  const isNet = state.income.basis === "net";
  queryAll('[data-action="select-income-type"]').forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.value === state.income.basis));
  });
  const hiddenBasis = query('[data-field="income-type"]');
  if (hiddenBasis) hiddenBasis.value = state.income.basis;
  setText('[data-output="income-field-label"]', isNet ? "실수령액" : "세전 월급");
  const salaryInput = query('[data-field="gross-salary"]');
  if (salaryInput) salaryInput.placeholder = isNet ? "실수령액" : "세전 월급";
  setHidden('[data-income-deductions]', isNet);
  syncSalaryField(state);

  const preview = calculateBudget(state);
  setText('[data-output="estimated-take-home"]', renderMoney(preview.estimatedTakeHome));
  setText('[data-output="insurance-deduction"]', `−${renderMoney(preview.insuranceDeduction)}`);
  setText('[data-output="tax-deduction"]', `−${renderMoney(preview.taxDeduction)}`);
  const valid = salaryValue(state) > 0;
  const next = query('[data-action="save-income"]');
  if (next) next.disabled = !valid;
  setHidden('[data-error="gross-salary"]', valid);
}

function renderPeriod(state) {
  const period = state.period?.startDate && state.period?.endDate
    ? state.period
    : calculatePeriod(state.period?.payday ?? initialState.period.payday);
  queryAll('[data-action="select-payday"]').forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.value) === Number(state.period.payday)));
  });
  const input = query('[data-field="payday"]');
  if (input) input.value = state.period.payday;
  setText('[data-output="period-preview"]', periodText(period, true));
  setText('[data-output="period-start"]', shortDate(period?.startDate));
  setText('[data-output="period-end"]', shortDate(period?.endDate));
  setHidden('[data-error="payday"]', Boolean(period));
}

function renderDeductionRows(state) {
  renderItemRows(query('[data-output="fixed-expense-items"]'), state.deductions.fixedExpenseItems, "fixed");
  renderItemRows(query('[data-output="saving-items"]'), state.deductions.savingItems, "saving");
}

function renderDeductionTotals(state) {
  const budget = calculateBudget(state);
  setText('[data-output="fixed-expenses-total"]', `− ${renderMoney(budget.fixedExpenses)}`);
  setText('[data-output="saving-items-total"]', `− ${renderMoney(budget.savingCommitment)}`);
  setText('[data-output="deductions-total"]', `총 ${renderMoney(budget.fixedExpenses + budget.savingCommitment)}`);
}

function renderStepSummaries(state) {
  const budget = currentBudget(state);
  const prefix = state.income.basis === "net" ? "실수령" : "세전";
  setTextAll('[data-output="step-period-summary"]', slashDate(state.period.startDate));
  setTextAll('[data-output="step-income-summary"]', `${prefix} ${Math.round(salaryValue(state) / 10000)}만`);
  setTextAll(
    '[data-output="step-deductions-summary"]',
    `총 ${Math.round((budget.fixedExpenses + budget.savingCommitment) / 10000)}만`,
  );
}

function renderStepTabs(state) {
  const labels = ["예산 기간", "소득 입력", "고정비·저축", "계산 결과"];
  const budget = currentBudget(state);
  const incomePrefix = state.income.basis === "net" ? "실수령" : "세전";
  const completedStatuses = [
    slashDate(state.period.startDate),
    `${incomePrefix} ${Math.round(salaryValue(state) / 10000)}만`,
    `총 ${Math.round((budget.fixedExpenses + budget.savingCommitment) / 10000)}만`,
    "완료",
  ];
  const completedThrough = state.result
    ? 3
    : salaryValue(state) > 0
      ? 1
      : state.period.startDate && state.period.endDate
        ? 0
        : -1;

  queryAll(".step-tabs").forEach((tabs) => {
    const owner = tabs.closest('[data-screen]')?.dataset.screen;
    const ownerIndex = [SCREEN.PERIOD, SCREEN.INCOME, SCREEN.DEDUCTIONS, SCREEN.RESULT]
      .indexOf(owner);
    queryAll(".step-tab", tabs).forEach((tab, index) => {
      const current = index === ownerIndex;
      const completed = index <= completedThrough && !current;
      tab.disabled = !current && !completed;
      if (current) tab.setAttribute("aria-current", "step");
      else tab.removeAttribute("aria-current");
      if (completed) tab.dataset.complete = "true";
      else delete tab.dataset.complete;

      const title = tab.querySelector(".step-tab__title");
      const status = tab.querySelector(".step-tab__status");
      if (title) title.textContent = `${completed ? "✓" : index + 1} ${labels[index]}`;
      if (status) {
        if (current) status.textContent = "입력 중";
        else if (!completed) status.textContent = "잠김";
        else status.textContent = completedStatuses[index];
      }
    });
  });
}

function renderResult(state) {
  const result = currentBudget(state);
  const daily = dailyFor(result.availableAmount, state);
  setText('[data-output="available-amount"]', renderMoney(result.availableAmount));
  setText(
    '[data-output="result-daily-summary"]',
    `${renderMoney(daily.dailyBudget)} · ${daily.remainingDays}일 기준`,
  );
  setText(
    '[data-output="result-formula-summary"]',
    `실수령 ${formatMoneyInput(result.estimatedTakeHome)} − 고정비 ${formatMoneyInput(result.fixedExpenses)} − 저축 ${formatMoneyInput(result.savingCommitment)}`,
  );

  const total = Math.max(1, result.estimatedTakeHome);
  const fixedPercent = (result.fixedExpenses / total) * 100;
  const savingPercent = (result.savingCommitment / total) * 100;
  const availablePercent = (result.availableAmount / total) * 100;

  const fixedBar = query('[data-output="breakdown-fixed-bar"]');
  if (fixedBar) fixedBar.style.width = `${fixedPercent}%`;
  const savingBar = query('[data-output="breakdown-saving-bar"]');
  if (savingBar) savingBar.style.width = `${savingPercent}%`;
  const availableBar = query('[data-output="breakdown-available-bar"]');
  if (availableBar) availableBar.style.width = `${availablePercent}%`;

  setText('[data-output="breakdown-fixed-value"]', `−${renderMoney(result.fixedExpenses)}`);
  setText('[data-output="breakdown-saving-value"]', `−${renderMoney(result.savingCommitment)}`);
  setText('[data-output="breakdown-available-value"]', renderMoney(result.availableAmount));
  setHidden('[data-warning="zero-available"]', result.availableAmount !== 0);
}

function renderSample() {
  const toggle = query('[data-action="toggle-sample-result"]');
  const panel = query('#sample-result-breakdown');
  if (!toggle || !panel) return;
  toggle.setAttribute("aria-expanded", String(sampleExpanded));
  toggle.textContent = sampleExpanded ? "예시 결과 접기" : "예시 결과 먼저 보기";
  panel.hidden = !sampleExpanded;
}

function orderedProducts(plan) {
  const ids = Array.isArray(plan?.productIds) && plan.productIds.length
    ? plan.productIds
    : products.map((product) => product.id);
  const order = new Map(ids.map((id, index) => [id, index]));
  const items = products.slice().sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  if (instantWithdrawFirst) {
    items.sort((a, b) => Number(b.instantWithdraw) - Number(a.instantWithdraw));
  }
  return items;
}

function planWithDaily(plan, state = appState) {
  if (!plan) return null;
  const adjusted = dailyFor(plan.remainingLiving, state);
  return { ...plan, adjustedDailyBudget: adjusted.dailyBudget };
}

function renderPlan(state) {
  const result = currentBudget(state);
  const daily = dailyFor(result.availableAmount, state);
  setText('[data-output="original-daily-budget"]', renderMoney(daily.dailyBudget));
  setText('[data-output="ai-plan-available"]', renderMoney(result.availableAmount));
  setText(
    '[data-output="ai-plan-current-daily"]',
    `현재 하루 예산 ${renderMoney(daily.dailyBudget)} · ${daily.remainingDays}일`,
  );

  const textarea = query('[data-field="goal-text"]');
  const plan = planWithDaily(draftPlan ?? state.plan, state);
  if (textarea && document.activeElement !== textarea) textarea.value = plan?.goalText ?? "";

  const applyButton = query('[data-action="apply-plan"]');
  if (applyButton) applyButton.disabled = !plan;

  if (!plan) {
    setText('[data-output="adjusted-daily-budget"]', "—");
    setText('[data-output="monthly-goal-total"]', renderMoney(0));
    renderGoalList(query('[data-output="ai-plan-allocations"]'), []);
    renderProductCards(query('[data-output="product-list"]'), orderedProducts(null));
    const toggle = query('[data-field="instant-withdraw"]');
    if (toggle) toggle.checked = instantWithdrawFirst;
    return;
  }

  setText('[data-output="adjusted-daily-budget"]', renderMoney(plan.adjustedDailyBudget));
  const goalTotal = plan.goals.reduce((sum, goal) => sum + toWon(goal.amount), 0);
  setText('[data-output="monthly-goal-total"]', renderMoney(goalTotal));
  renderGoalList(query('[data-output="ai-plan-allocations"]'), plan.goals, plan.remainingLiving);
  renderProductCards(query('[data-output="product-list"]'), orderedProducts(plan));
  const toggle = query('[data-field="instant-withdraw"]');
  if (toggle) toggle.checked = instantWithdrawFirst;
}

function applyGoalText(text) {
  const goalText = String(text ?? "").trim();
  const hadPlan = Boolean(draftPlan);
  draftPlan = goalText
    ? planWithDaily(buildPlan(goalText, currentBudget(appState).availableAmount), appState)
    : null;
  renderPlan(appState);
  if (!hadPlan && draftPlan) {
    query('[data-output="ai-plan-allocations"]')?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }
}

function renderAppliedResult(state) {
  const result = currentBudget(state);
  const daily = dailyFor(result.availableAmount, state);
  const plan = planWithDaily(state.plan, state);
  const originalDaily = daily.dailyBudget;
  const adjustedDaily = plan?.adjustedDailyBudget ?? originalDaily;
  const decrease = Math.max(0, originalDaily - adjustedDaily);

  setText('[data-output="applied-total"]', renderMoney(result.availableAmount));
  setText('[data-output="applied-daily-budget"]', renderMoney(originalDaily));
  setText('[data-output="applied-remaining-days"]', `${daily.remainingDays}일`);
  setText('[data-output="applied-original-daily-budget"]', renderMoney(originalDaily));
  setText('[data-output="applied-adjusted-daily-budget"]', renderMoney(adjustedDaily));
  setText('[data-output="applied-budget-decrease"]', renderMoney(decrease));

  if (!plan) return;
  renderGoalList(query('[data-output="applied-allocations"]'), plan.goals);
  setText('[data-output="applied-remaining-living"]', renderMoney(plan.remainingLiving));
  const appliedPlanTotal = plan.goals.reduce((sum, goal) => sum + toWon(goal.amount), 0);
  setText('[data-output="applied-plan-total"]', renderMoney(appliedPlanTotal));
  const isFullyAllocated = plan.remainingLiving === 0;
  setText(
    '[data-output="applied-status-text"]',
    isFullyAllocated ? "계획 금액이 가용 자금을 모두 사용해요" : "이번 달 계획 안에서 사용할 수 있어요",
  );
  query('[data-output-message="applied-status"]')?.classList.toggle("success-message--neutral", isFullyAllocated);
}

function renderHome(state) {
  const hasResult = Boolean(state.result);
  setHiddenAll('[data-home-view="empty"]', hasResult);
  setHiddenAll('[data-home-view="dashboard"]', !hasResult);
  const start = query('[data-action="start-calculation"]');
  if (start) {
    const inProgress = Boolean(state.period.startDate || salaryValue(state));
    start.textContent = inProgress ? "이어서 계산하기" : "내 금액으로 계산하기";
  }
  if (!hasResult) return;

  const result = state.result;
  const daily = dailyFor(result.availableAmount, state);
  const plan = state.plan ? planWithDaily(state.plan, state) : null;
  const purchasesTotal = sumPurchases(state.purchases);
  const effectiveAvailable = (plan ? plan.remainingLiving : result.availableAmount) - purchasesTotal;
  const homeDailyBudget = purchasesTotal > 0
    ? dailyFor(effectiveAvailable, state).dailyBudget
    : (plan ? plan.adjustedDailyBudget : daily.dailyBudget);
  const percent = result.estimatedTakeHome > 0
    ? Math.min(100, Math.max(0, Math.round((effectiveAvailable / result.estimatedTakeHome) * 100)))
    : 0;
  setText('[data-output="home-period"]', periodText(state.period));
  setText('[data-output="home-available-amount"]', renderMoney(effectiveAvailable));
  setText('[data-output="home-daily-budget"]', renderMoney(homeDailyBudget));
  setText('[data-output="home-original-daily-budget"]', renderMoney(daily.dailyBudget));
  setHidden('.mini-stat__before', !plan && purchasesTotal <= 0);
  setText('[data-output="home-remaining-days"]', `${daily.remainingDays}일`);
  setProgress(query('[data-output="home-progress"]'), percent);
  setText('[data-output="home-available-percent"]', `실수령액 중 ${percent}%를 자유롭게 쓸 수 있어요.`);
  setText('[data-output="home-take-home"]', renderMoney(result.estimatedTakeHome));
  setText('[data-output="home-fixed-expenses"]', renderMoney(result.fixedExpenses));
  setText('[data-output="home-saving"]', renderMoney(result.savingCommitment));
  setText('[data-output="home-calculated-available"]', renderMoney(result.availableAmount));

  setHidden('[data-home-plan]', !plan);
  if (plan) {
    setText('[data-output="home-adjusted-daily-budget"]', renderMoney(plan.adjustedDailyBudget));
    renderGoalList(query('[data-output="home-allocations"]'), plan.goals, plan.remainingLiving);
  }
}

const AFFORD_STATUS_PANELS = ["safe", "caution", "over-budget"];
const AFFORD_STATUS_KEY = { SAFE: "safe", CAUTION: "caution", OVER_BUDGET: "over-budget" };
const AFFORD_DEFAULT_AMOUNT_ERROR = "결제액을 올바르게 입력해주세요";
const AFFORD_NO_AMOUNT_FOUND_ERROR = "금액을 찾지 못했어요. 결제 금액을 직접 입력해주세요.";

let pendingAffordAmount = null;
let pendingCoachOption = null;
let affordApplyInFlight = false;
let coachDebounceTimer = null;
let coachAmountUserEdited = false;
let lastParsedInput = null;
let currentAffordContext = null;
let affordRequestToken = 0;

function formatSignedMoney(value) {
  const number = Math.trunc(Number(value) || 0);
  return number < 0 ? `−${renderMoney(Math.abs(number))}` : renderMoney(number);
}

function availableFundsForAffordCheck(state = appState) {
  const result = currentBudget(state);
  const plan = state.plan ? planWithDaily(state.plan, state) : null;
  return (plan ? plan.remainingLiving : result.availableAmount) - sumPurchases(state.purchases);
}

// AI가 제안한 commitAmount를 신뢰하지 않고, 없거나 비정상이면 검증된 결제액으로 대체한다.
function sanitizeCoachOption(option, fallbackAmount) {
  if (!option || typeof option !== "object") return null;
  const title = String(option.title ?? "").trim();
  if (!title) return null;
  const rawCommit = Number(option.commitAmount);
  const commitAmount = Number.isFinite(rawCommit) && rawCommit > 0
    ? Math.round(rawCommit)
    : Math.round(fallbackAmount);
  return {
    id: String(option.id ?? makeId("coach-option")),
    title,
    description: option.description ? String(option.description) : "",
    commitAmount,
  };
}

function setCoachControlsDisabled(modal, disabled) {
  const submitButton = query('[data-action="submit-afford-check"]', modal);
  if (submitButton) submitButton.disabled = disabled;
  queryAll('[data-action="select-coach-preset"]', modal).forEach((button) => { button.disabled = disabled; });
}

function parsedInputAmount() {
  const amount = Number(lastParsedInput?.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function applyCoachTextParse(text, modal) {
  const parsed = parseSpendingInput(text ?? "");
  lastParsedInput = parsed && typeof parsed === "object" ? parsed : null;
  setText('[data-output="afford-parsed-item"]', lastParsedInput?.itemName ?? "", modal);

  const parsedAmount = parsedInputAmount();
  if (parsedAmount && !coachAmountUserEdited) {
    const amountInput = query('[data-field="afford-amount"]', modal);
    if (amountInput) amountInput.value = formatMoneyInput(parsedAmount);
  }
}

function beginCoachRequest(modal) {
  AFFORD_STATUS_PANELS.forEach((status) => setHidden(`[data-status="${status}"]`, true, modal));
  setHidden('[data-output="afford-coach-fallback"]', true, modal);
  setHidden('[data-output="afford-loading"]', false, modal);
  setCoachControlsDisabled(modal, true);
}

function requestCoachAdvice(modal) {
  const context = currentAffordContext;
  if (!context) return;
  const token = ++affordRequestToken;

  getSpendingCoachAdvice({
    status: context.evaluation.status,
    paymentAmount: context.paymentAmount,
    evaluation: context.evaluation,
    dailyBudget: context.dailyBudget,
    remainingDays: context.remainingDays,
    parsedInput: context.parsedInput,
  }).then((advice) => {
    if (token !== affordRequestToken) return;
    handleCoachAdviceSuccess(modal, context, advice);
  }).catch(() => {
    if (token !== affordRequestToken) return;
    handleCoachAdviceFailure(modal, context);
  });
}

function handleCoachAdviceSuccess(modal, context, advice) {
  setHidden('[data-output="afford-loading"]', true, modal);
  setHidden('[data-output="afford-coach-fallback"]', true, modal);
  setCoachControlsDisabled(modal, false);

  const { evaluation, paymentAmount, availableFunds, dailyBudget } = context;
  const statusKey = AFFORD_STATUS_KEY[evaluation.status];
  if (!statusKey) return;
  setHidden(`[data-status="${statusKey}"]`, false, modal);
  const explanation = typeof advice?.explanation === "string" ? advice.explanation.trim() : "";

  if (statusKey === "safe") {
    setText('[data-output="afford-safe-daily-budget"]', renderMoney(evaluation.adjustedDailyBudget), modal);
    setText('[data-output="afford-safe-current-daily-budget"]', renderMoney(dailyBudget), modal);
    setText('[data-output="afford-safe-explanation"]', explanation, modal);
    pendingAffordAmount = paymentAmount;
  } else if (statusKey === "caution") {
    setText('[data-output="afford-caution-daily-budget"]', renderMoney(evaluation.adjustedDailyBudget), modal);
    setText('[data-output="afford-caution-current-daily-budget"]', renderMoney(dailyBudget), modal);
    setText('[data-output="afford-caution-remaining"]', formatSignedMoney(evaluation.remainingAfterPayment), modal);
    setText(
      '[data-output="afford-caution-message"]',
      explanation
        || `다음 ${evaluation.absorptionDays}일 하루 ${formatMoneyInput(evaluation.savingPerDay)}원씩 아끼면 나눠서 흡수돼요.`,
      modal,
    );
    const recommendedOption = sanitizeCoachOption(advice?.recommendedOption, paymentAmount);
    const alternatives = Array.isArray(advice?.alternatives)
      ? advice.alternatives.map((option) => sanitizeCoachOption(option, paymentAmount)).filter(Boolean)
      : [];
    renderCoachOptions(query('[data-output="afford-caution-options"]', modal), { recommendedOption, alternatives });
    const applyPlanButton = query('[data-action="apply-coach-plan"]', modal);
    if (applyPlanButton) applyPlanButton.disabled = true;
    pendingAffordAmount = paymentAmount;
  } else if (statusKey === "over-budget") {
    const overAmount = evaluation.overAmount ?? Math.max(0, paymentAmount - availableFunds);
    setText('[data-output="afford-over-remaining"]', formatSignedMoney(evaluation.remainingAfterPayment), modal);
    setText('[data-output="afford-over-available"]', renderMoney(availableFunds), modal);
    setText('[data-output="afford-over-excess"]', renderMoney(overAmount), modal);
    setText(
      '[data-output="afford-over-message"]',
      explanation || `이번 달 가용 자금보다 결제액이 ${renderMoney(overAmount)} 커요. 이 결제는 추천하지 않아요.`,
      modal,
    );
    const recommendedOption = sanitizeCoachOption(advice?.recommendedOption, paymentAmount);
    const alternatives = Array.isArray(advice?.alternatives)
      ? advice.alternatives.map((option) => sanitizeCoachOption(option, paymentAmount)).filter(Boolean)
      : [];
    renderCoachInfoCards(query('[data-output="afford-over-options"]', modal), { recommendedOption, alternatives });
  }
}

function handleCoachAdviceFailure(modal, context) {
  setHidden('[data-output="afford-loading"]', true, modal);
  setCoachControlsDisabled(modal, false);
  pendingCoachOption = null;

  const { evaluation, paymentAmount, availableFunds, dailyBudget } = context;
  const statusKey = AFFORD_STATUS_KEY[evaluation.status];
  if (!statusKey) return;
  setHidden(`[data-status="${statusKey}"]`, false, modal);
  setHidden('[data-output="afford-coach-fallback"]', false, modal);
  setText(
    '[data-output="afford-coach-fallback-message"]',
    "예산 계산은 완료했지만 AI 제안을 불러오지 못했어요. 기본 조정안을 확인하거나 다시 시도해 주세요.",
    modal,
  );

  if (statusKey === "safe") {
    setText('[data-output="afford-safe-daily-budget"]', renderMoney(evaluation.adjustedDailyBudget), modal);
    setText('[data-output="afford-safe-current-daily-budget"]', renderMoney(dailyBudget), modal);
    setText('[data-output="afford-safe-explanation"]', "", modal);
    pendingAffordAmount = paymentAmount;
  } else if (statusKey === "caution") {
    setText('[data-output="afford-caution-daily-budget"]', renderMoney(evaluation.adjustedDailyBudget), modal);
    setText('[data-output="afford-caution-current-daily-budget"]', renderMoney(dailyBudget), modal);
    setText('[data-output="afford-caution-remaining"]', formatSignedMoney(evaluation.remainingAfterPayment), modal);
    setText(
      '[data-output="afford-caution-message"]',
      `다음 ${evaluation.absorptionDays}일 하루 ${formatMoneyInput(evaluation.savingPerDay)}원씩 아끼면 나눠서 흡수돼요.`,
      modal,
    );
    query('[data-output="afford-caution-options"]', modal)?.replaceChildren();
    const applyPlanButton = query('[data-action="apply-coach-plan"]', modal);
    if (applyPlanButton) applyPlanButton.disabled = true;
    pendingAffordAmount = paymentAmount;
  } else if (statusKey === "over-budget") {
    const overAmount = evaluation.overAmount ?? Math.max(0, paymentAmount - availableFunds);
    setText('[data-output="afford-over-remaining"]', formatSignedMoney(evaluation.remainingAfterPayment), modal);
    setText('[data-output="afford-over-available"]', renderMoney(availableFunds), modal);
    setText('[data-output="afford-over-excess"]', renderMoney(overAmount), modal);
    setText(
      '[data-output="afford-over-message"]',
      `이번 달 가용 자금보다 결제액이 ${renderMoney(overAmount)} 커요. 이 결제는 추천하지 않아요.`,
      modal,
    );
    query('[data-output="afford-over-options"]', modal)?.replaceChildren();
  }
}

function resetAffordCheck(modal) {
  pendingAffordAmount = null;
  pendingCoachOption = null;
  lastParsedInput = null;
  coachAmountUserEdited = false;
  currentAffordContext = null;
  affordRequestToken += 1;
  clearTimeout(coachDebounceTimer);

  const amountInput = query('[data-field="afford-amount"]', modal);
  if (amountInput) amountInput.value = "";
  const coachText = query('[data-field="coach-text"]', modal);
  if (coachText) coachText.value = "";
  setText('[data-output="afford-parsed-item"]', "", modal);
  setHidden('[data-error="afford-amount"]', true, modal);
  setHidden('[data-output="afford-loading"]', true, modal);
  setHidden('[data-output="afford-coach-fallback"]', true, modal);
  AFFORD_STATUS_PANELS.forEach((status) => setHidden(`[data-status="${status}"]`, true, modal));
  query('[data-output="afford-caution-options"]', modal)?.replaceChildren();
  query('[data-output="afford-over-options"]', modal)?.replaceChildren();
  const applyPlanButton = query('[data-action="apply-coach-plan"]', modal);
  if (applyPlanButton) applyPlanButton.disabled = true;
  setCoachControlsDisabled(modal, false);
}

function openAffordCheck(triggerEl) {
  const modal = query('[data-modal="afford-check"]');
  if (!modal) return;
  resetAffordCheck(modal);
  openModal(modal, {
    focusEl: query('[data-field="afford-amount"]', modal),
    returnFocusEl: triggerEl,
  });
}

function closeAffordCheck() {
  const modal = query('[data-modal="afford-check"]');
  if (!modal) return;
  closeModal(modal);
}

function submitAffordCheck() {
  const modal = query('[data-modal="afford-check"]');
  if (!modal) return;
  const input = query('[data-field="afford-amount"]', modal);
  const paymentAmount = toWon(input?.value);
  const valid = paymentAmount > 0;

  if (!valid) {
    const hasParsedAmount = Boolean(parsedInputAmount());
    setText(
      '[data-error="afford-amount"]',
      hasParsedAmount ? AFFORD_DEFAULT_AMOUNT_ERROR : AFFORD_NO_AMOUNT_FOUND_ERROR,
      modal,
    );
    setHidden('[data-error="afford-amount"]', false, modal);
    input?.focus();
    return;
  }

  setHidden('[data-error="afford-amount"]', true, modal);
  pendingAffordAmount = null;
  pendingCoachOption = null;
  beginCoachRequest(modal);

  const availableFunds = availableFundsForAffordCheck(appState);
  const daily = dailyFor(availableFunds, appState);
  const evaluation = evaluatePurchase({
    paymentAmount,
    availableFunds,
    dailyBudget: daily.dailyBudget,
    remainingDays: daily.remainingDays,
  });

  if (!evaluation) {
    setHidden('[data-output="afford-loading"]', true, modal);
    setCoachControlsDisabled(modal, false);
    return;
  }

  currentAffordContext = {
    paymentAmount,
    evaluation,
    availableFunds,
    dailyBudget: daily.dailyBudget,
    remainingDays: daily.remainingDays,
    parsedInput: lastParsedInput,
  };

  requestCoachAdvice(modal);
}

function selectCoachOption(button) {
  const modal = button.closest('[data-modal="afford-check"]') ?? query('[data-modal="afford-check"]');
  queryAll('[data-action="select-coach-option"]', modal).forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn === button));
  });
  const commitAmount = toWon(button.dataset.commitAmount);
  pendingCoachOption = {
    id: button.dataset.optionId ?? "",
    title: button.dataset.optionTitle ?? "",
    commitAmount,
  };
  const applyPlanButton = query('[data-action="apply-coach-plan"]', modal);
  if (applyPlanButton) applyPlanButton.disabled = !commitAmount;
}

function applyAffordPayment() {
  if (affordApplyInFlight) return;
  if (!pendingAffordAmount) return;
  affordApplyInFlight = true;
  try {
    const modal = query('[data-modal="afford-check"]');
    const item = {
      id: makeId("purchase"),
      label: "",
      amount: pendingAffordAmount,
      createdAt: new Date().toISOString(),
    };
    updateState({ purchases: [...appState.purchases, item] });
    render(appState);
    closeAffordCheck();
    resetAffordCheck(modal);
  } finally {
    affordApplyInFlight = false;
  }
}

function applyCoachPlan() {
  if (affordApplyInFlight) return;
  if (!pendingCoachOption) return;
  affordApplyInFlight = true;
  try {
    const modal = query('[data-modal="afford-check"]');
    const item = {
      id: makeId("purchase"),
      label: lastParsedInput?.itemName ? String(lastParsedInput.itemName) : "",
      amount: pendingCoachOption.commitAmount,
      createdAt: new Date().toISOString(),
    };
    updateState({ purchases: [...appState.purchases, item] });
    render(appState);
    closeAffordCheck();
    resetAffordCheck(modal);
  } finally {
    affordApplyInFlight = false;
  }
}

function cancelAffordPayment() {
  pendingAffordAmount = null;
  closeAffordCheck();
}

export function navigate(screenId) {
  const target = screenIds.has(screenId) ? screenId : SCREEN.HOME;
  queryAll('[data-screen]').forEach((section) => {
    const active = section.dataset.screen === target;
    section.hidden = !active;
    section.setAttribute("aria-hidden", String(!active));
  });
  if (appState.currentScreen !== target) updateState({ currentScreen: target });
  render(appState);
  query(`[data-screen="${target}"] .step-tab[aria-current="step"]`)
    ?.scrollIntoView?.({ inline: "center", block: "nearest" });
  window.scrollTo?.({ top: 0, behavior: "auto" });
}

export function render(state) {
  appState = normalizeState(state);
  renderPeriod(appState);
  renderIncome(appState);
  renderDeductionRows(appState);
  renderDeductionTotals(appState);
  renderStepTabs(appState);
  renderStepSummaries(appState);
  renderResult(appState);
  renderPlan(appState);
  renderAppliedResult(appState);
  renderHome(appState);
  renderSample();
}

function resumeScreen() {
  if (appState.result) return appState.plan ? SCREEN.AI_RESULT : SCREEN.RESULT;
  if (salaryValue(appState) > 0) return SCREEN.DEDUCTIONS;
  if (appState.period.startDate && appState.period.endDate) return SCREEN.INCOME;
  return SCREEN.PERIOD;
}

function addItem(kind, label) {
  const key = kind === "fixed" ? "fixedExpenseItems" : "savingItems";
  const item = { id: makeId(kind), label, amount: 0 };
  const deductions = { ...appState.deductions, [key]: [...appState.deductions[key], item] };
  updateState({ deductions, ...invalidateResult() });
  render(appState);
  query(`[data-item-id="${item.id}"] [data-field$="-name"]`)?.focus();
}

function removeItem(kind, row) {
  const key = kind === "fixed" ? "fixedExpenseItems" : "savingItems";
  const items = appState.deductions[key].filter((item) => item.id !== row?.dataset.itemId);
  updateState({ deductions: { ...appState.deductions, [key]: items }, ...invalidateResult() });
  render(appState);
}

document.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.matches('[data-modal="afford-check"]')) {
    closeAffordCheck();
    return;
  }

  const control = event.target.closest('[data-action]');
  if (!control || control.disabled) return;
  const action = control.dataset.action;

  const directScreens = {
    "go-period": SCREEN.PERIOD,
    "go-income": SCREEN.INCOME,
    "go-deductions": SCREEN.DEDUCTIONS,
    "go-result": SCREEN.RESULT,
  };
  if (directScreens[action]) {
    navigate(directScreens[action]);
    return;
  }

  switch (action) {
    case "toggle-sample-result": sampleExpanded = !sampleExpanded; renderSample(); break;
    case "start-calculation": navigate(resumeScreen()); break;
    case "restart-calculation": navigate(SCREEN.PERIOD); break;
    case "go-home": navigate(SCREEN.HOME); break;
    case "open-afford-check": openAffordCheck(control); break;
    case "close-afford-check": closeAffordCheck(); break;
    case "submit-afford-check": submitAffordCheck(); break;
    case "apply-afford-payment": applyAffordPayment(); break;
    case "cancel-afford-payment": cancelAffordPayment(); break;
    case "select-coach-preset": {
      const modal = control.closest('[data-modal="afford-check"]') ?? query('[data-modal="afford-check"]');
      const textarea = query('[data-field="coach-text"]', modal);
      const value = control.dataset.value ?? "";
      if (textarea) textarea.value = value;
      clearTimeout(coachDebounceTimer);
      applyCoachTextParse(value, modal);
      break;
    }
    case "select-coach-option": selectCoachOption(control); break;
    case "apply-coach-plan": applyCoachPlan(); break;
    case "retry-coach-advice": {
      const modal = control.closest('[data-modal="afford-check"]') ?? query('[data-modal="afford-check"]');
      if (!currentAffordContext) break;
      beginCoachRequest(modal);
      requestCoachAdvice(modal);
      break;
    }
    case "open-ai-plan":
      planReturnScreen = appState.currentScreen;
      draftPlan = appState.plan;
      navigate(SCREEN.AI_PLAN);
      break;
    case "back-from-plan": navigate(planReturnScreen); break;
    case "confirm-plan-home": navigate(SCREEN.HOME); break;
    case "edit-plan":
      planReturnScreen = appState.currentScreen;
      draftPlan = appState.plan;
      navigate(SCREEN.AI_PLAN);
      break;
    case "select-payday": {
      const period = calculatePeriod(Number(control.dataset.value));
      if (!period) break;
      const changed = JSON.stringify(period) !== JSON.stringify(appState.period);
      updateState({ period, ...(changed ? invalidateResult() : {}) });
      render(appState);
      break;
    }
    case "select-income-type": {
      const basis = control.dataset.value === "net" ? "net" : "gross";
      if (basis === appState.income.basis) break;
      updateState({ income: { ...appState.income, basis }, ...invalidateResult() });
      render(appState);
      query('[data-field="gross-salary"]')?.focus();
      break;
    }
    case "add-fixed-preset": addItem("fixed", control.dataset.value ?? ""); break;
    case "add-fixed-custom": addItem("fixed", ""); break;
    case "add-saving-preset": addItem("saving", control.dataset.value ?? ""); break;
    case "add-saving-custom": addItem("saving", ""); break;
    case "remove-fixed-expense": removeItem("fixed", control.closest('[data-item-id]')); break;
    case "remove-saving": removeItem("saving", control.closest('[data-item-id]')); break;
    case "apply-plan": {
      const plan = planWithDaily(draftPlan ?? appState.plan, appState);
      if (!plan) break;
      updateState({ plan });
      draftPlan = plan;
      navigate(SCREEN.AI_RESULT);
      break;
    }
    case "submit-plan": {
      clearTimeout(goalDebounceTimer);
      applyGoalText(query('[data-field="goal-text"]')?.value ?? "");
      break;
    }
    case "fill-plan-example": {
      const textarea = query('[data-field="goal-text"]');
      if (!textarea) break;
      clearTimeout(goalDebounceTimer);
      textarea.value = textarea.placeholder ?? "";
      applyGoalText(textarea.value);
      break;
    }
    case "toggle-instant-withdraw":
      instantWithdrawFirst = Boolean(control.checked);
      renderProductCards(query('[data-output="product-list"]'), orderedProducts(draftPlan ?? appState.plan));
      break;
    default: break;
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();

  if (form.dataset.form === "period") {
    const period = calculatePeriod(Number(query('[data-field="payday"]')?.value));
    setHidden('[data-error="payday"]', Boolean(period));
    if (!period) return;
    updateState({ period });
    navigate(SCREEN.INCOME);
  }

  if (form.dataset.form === "income") {
    const value = toWon(query('[data-field="gross-salary"]')?.value);
    setHidden('[data-error="gross-salary"]', value > 0);
    if (!value) return;
    const key = appState.income.basis === "net" ? "netSalaryInput" : "grossSalary";
    updateState({ income: { ...appState.income, [key]: value } });
    navigate(SCREEN.DEDUCTIONS);
  }

  if (form.dataset.form === "deductions") {
    const budget = calculateBudget(appState);
    const daily = dailyFor(budget.availableAmount, appState);
    const result = {
      ...budget,
      ...daily,
      periodStart: appState.period.startDate,
      periodEnd: appState.period.endDate,
      calculatedAt: new Date().toISOString(),
    };
    const availableAmountChanged = appState.result?.availableAmount !== result.availableAmount;
    const nextPlan = availableAmountChanged ? null : appState.plan;
    updateState({ result, plan: nextPlan });
    draftPlan = null;
    navigate(nextPlan ? SCREEN.AI_RESULT : SCREEN.RESULT);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (!(event.target instanceof Element) || !event.target.matches('[data-field="afford-amount"]')) return;
  event.preventDefault();
  submitAffordCheck();
});

document.addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  if (!field) return;

  if (field === "gross-salary") {
    const value = toWon(event.target.value);
    event.target.value = value ? formatMoneyInput(value) : "";
    const key = appState.income.basis === "net" ? "netSalaryInput" : "grossSalary";
    updateState({ income: { ...appState.income, [key]: value }, ...invalidateResult() });
    renderIncome(appState);
    renderStepSummaries(appState);
    return;
  }

  if (field === "afford-amount") {
    coachAmountUserEdited = true;
    return;
  }

  if (field === "coach-text") {
    const modal = event.target.closest('[data-modal="afford-check"]') ?? query('[data-modal="afford-check"]');
    const text = event.target.value;
    clearTimeout(coachDebounceTimer);
    coachDebounceTimer = setTimeout(() => applyCoachTextParse(text, modal), 400);
    return;
  }

  if (field === "goal-text") {
    const goalText = event.target.value;
    clearTimeout(goalDebounceTimer);
    goalDebounceTimer = setTimeout(() => applyGoalText(goalText), 400);
    return;
  }

  const itemFields = {
    "fixed-expense-name": ["fixedExpenseItems", "label"],
    "fixed-expense-amount": ["fixedExpenseItems", "amount"],
    "saving-name": ["savingItems", "label"],
    "saving-amount": ["savingItems", "amount"],
  };
  const mapping = itemFields[field];
  if (!mapping) return;
  const [key, property] = mapping;
  const rowId = event.target.closest('[data-item-id]')?.dataset.itemId;
  const value = property === "amount" ? toWon(event.target.value) : event.target.value;
  if (property === "amount") event.target.value = value ? formatMoneyInput(value) : "";
  const items = appState.deductions[key].map((item) => item.id === rowId ? { ...item, [property]: value } : item);
  updateState({ deductions: { ...appState.deductions, [key]: items }, ...invalidateResult() });
  renderDeductionTotals(appState);
  renderStepSummaries(appState);
});

document.addEventListener("blur", (event) => {
  const field = event.target.dataset.field;
  if (!["gross-salary", "fixed-expense-amount", "saving-amount", "afford-amount"].includes(field)) return;
  event.target.value = formatMoneyInput(toWon(event.target.value));
}, true);

render(appState);
navigate(appState.currentScreen);
