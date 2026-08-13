// Task C owns this file: v2 application entry point and state/event wiring.

import { calculateBudget, calculateDailyBudget } from "./calculator.js";
import { buildPlan } from "./planner.js";
import { products } from "./products.js";
import { PAYDAY_PRESETS, SCREEN, initialState, loadState, patchState } from "./store.js";
import {
  formatMoneyInput,
  renderGoalChips,
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
  setText('[data-output="daily-budget"]', renderMoney(daily.dailyBudget));
  setText('[data-output="remaining-days"]', daily.remainingDays);
  setText('[data-output="result-take-home"]', `+ ${renderMoney(result.estimatedTakeHome)}`);
  setText('[data-output="result-fixed-expenses"]', `− ${renderMoney(result.fixedExpenses)}`);
  setText('[data-output="result-saving"]', `− ${renderMoney(result.savingCommitment)}`);
  setText('[data-output="result-available"]', renderMoney(result.availableAmount));
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

  const textarea = query('[data-field="goal-text"]');
  const plan = planWithDaily(draftPlan ?? state.plan, state);
  if (textarea && document.activeElement !== textarea) textarea.value = plan?.goalText ?? "";

  const applyButton = query('[data-action="apply-plan"]');
  if (applyButton) applyButton.disabled = !plan;

  const hasParsedGoals = Boolean(plan && !(plan.goals.length === 1 && plan.goals[0].id === "goal"));
  setHidden('[data-output="parsed-chips"]', !hasParsedGoals);
  renderGoalChips(query('[data-output="parsed-chips"]'), hasParsedGoals ? plan.goals : []);
  setText(
    '[data-output="plan-input-caption"]',
    hasParsedGoals ? "AI가 금액과 목적을 자동으로 나눴어요" : "여행, 비상금처럼 목적과 금액을 적어보세요",
  );

  if (!plan) {
    setText('[data-output="adjusted-daily-budget"]', "—");
    setText('[data-output="budget-decrease"]', "0원");
    setText('[data-output="monthly-goal-total"]', renderMoney(0));
    renderProductCards(query('[data-output="product-list"]'), orderedProducts(null));
    const toggle = query('[data-field="instant-withdraw"]');
    if (toggle) toggle.checked = instantWithdrawFirst;
    return;
  }

  setText('[data-output="adjusted-daily-budget"]', renderMoney(plan.adjustedDailyBudget));
  setText('[data-output="budget-decrease"]', renderMoney(Math.max(0, daily.dailyBudget - plan.adjustedDailyBudget)));
  const goalTotal = plan.goals.reduce((sum, goal) => sum + toWon(goal.amount), 0);
  setText('[data-output="monthly-goal-total"]', renderMoney(goalTotal));
  renderProductCards(query('[data-output="product-list"]'), orderedProducts(plan));
  const toggle = query('[data-field="instant-withdraw"]');
  if (toggle) toggle.checked = instantWithdrawFirst;
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
  const percent = result.estimatedTakeHome > 0
    ? Math.min(100, Math.max(0, Math.round((result.availableAmount / result.estimatedTakeHome) * 100)))
    : 0;
  setText('[data-output="home-period"]', periodText(state.period));
  setText('[data-output="home-available-amount"]', renderMoney(result.availableAmount));
  setText('[data-output="home-daily-budget"]', renderMoney(plan ? plan.adjustedDailyBudget : daily.dailyBudget));
  setText('[data-output="home-original-daily-budget"]', renderMoney(daily.dailyBudget));
  setHidden('.mini-stat__before', !plan);
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

  if (field === "goal-text") {
    const goalText = event.target.value.trim();
    clearTimeout(goalDebounceTimer);
    goalDebounceTimer = setTimeout(() => {
      const hadPlan = Boolean(draftPlan);
      draftPlan = goalText
        ? planWithDaily(buildPlan(goalText, currentBudget(appState).availableAmount), appState)
        : null;
      renderPlan(appState);
      if (!hadPlan && draftPlan) {
        query('.simulator-impact')?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      }
    }, 400);
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
  if (!["gross-salary", "fixed-expense-amount", "saving-amount"].includes(field)) return;
  event.target.value = formatMoneyInput(toWon(event.target.value));
}, true);

render(appState);
navigate(appState.currentScreen);
