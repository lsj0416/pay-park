// Task C owns this file: DOM-only rendering helpers for the v2 UI.

const moneyFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
});

const toSafeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
};

export function renderMoney(value) {
  return `${moneyFormatter.format(toSafeNumber(value))}원`;
}

export function formatMoneyInput(value) {
  return moneyFormatter.format(toSafeNumber(value));
}

export function updateSummaryCard(element, { label, value, description }) {
  if (!element) return;

  const labelElement = element.querySelector(".summary-card__label");
  const valueElement = element.querySelector(".summary-card__value");
  const descriptionElement = element.querySelector(".summary-card__description");

  if (labelElement && label !== undefined) labelElement.textContent = label;
  if (valueElement && value !== undefined) valueElement.textContent = renderMoney(value);
  if (descriptionElement && description !== undefined) {
    descriptionElement.textContent = description;
  }
}

export function setText(selector, value, root = document) {
  const element = root.querySelector(selector);
  if (element) element.textContent = value ?? "";
  return element;
}

export function setTextAll(selector, value, root = document) {
  const elements = [...root.querySelectorAll(selector)];
  elements.forEach((element) => { element.textContent = value ?? ""; });
  return elements;
}

export function setHidden(selector, hidden, root = document) {
  const element = root.querySelector(selector);
  if (element) element.hidden = Boolean(hidden);
  return element;
}

export function setHiddenAll(selector, hidden, root = document) {
  const elements = [...root.querySelectorAll(selector)];
  elements.forEach((element) => { element.hidden = Boolean(hidden); });
  return elements;
}

export function createItemRow(item, kind) {
  const isFixed = kind === "fixed";
  const nameField = isFixed ? "fixed-expense-name" : "saving-name";
  const amountField = isFixed ? "fixed-expense-amount" : "saving-amount";
  const removeAction = isFixed ? "remove-fixed-expense" : "remove-saving";
  const noun = isFixed ? "고정비" : "저축";
  const label = String(item?.label ?? "");

  const row = document.createElement("div");
  row.className = "item-row";
  row.dataset.itemId = String(item?.id ?? "");

  const nameLabel = document.createElement("label");
  nameLabel.className = "item-name-field";
  const nameDescription = document.createElement("span");
  nameDescription.className = "sr-only";
  nameDescription.textContent = `${noun} 항목 이름`;
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = label;
  nameInput.dataset.field = nameField;
  nameLabel.append(nameDescription, nameInput);

  const amountLabel = document.createElement("label");
  amountLabel.className = "money-field";
  const amountDescription = document.createElement("span");
  amountDescription.className = "sr-only";
  amountDescription.textContent = `${label || noun} 금액`;
  const amountInput = document.createElement("input");
  amountInput.type = "text";
  amountInput.inputMode = "numeric";
  amountInput.autocomplete = "off";
  amountInput.value = formatMoneyInput(item?.amount);
  amountInput.dataset.field = amountField;
  const unit = document.createElement("span");
  unit.className = "money-field__unit";
  unit.textContent = "원";
  amountLabel.append(amountDescription, amountInput, unit);

  const removeButton = document.createElement("button");
  removeButton.className = "delete-button";
  removeButton.type = "button";
  removeButton.dataset.action = removeAction;
  removeButton.setAttribute("aria-label", `${label || noun} 삭제`);
  removeButton.textContent = "✕";

  row.append(nameLabel, amountLabel, removeButton);
  return row;
}

export function renderItemRows(container, items = [], kind) {
  if (!container) return;
  const fragment = document.createDocumentFragment();
  items.forEach((item) => fragment.append(createItemRow(item, kind)));
  container.replaceChildren(fragment);
}

export function renderGoalList(container, goals = [], remainingLiving = null) {
  if (!container) return;
  const fragment = document.createDocumentFragment();
  const rows = [...goals];
  if (remainingLiving !== null) {
    rows.push({ id: "remaining-living", label: "남은 생활비", amount: remainingLiving });
  }

  rows.forEach((goal) => {
    const row = document.createElement("div");
    row.dataset.goalId = goal.id ?? "";
    const term = document.createElement("dt");
    term.textContent = goal.label ?? "목표 자금";
    const description = document.createElement("dd");
    description.textContent = renderMoney(goal.amount);
    if (goal.id === "remaining-living") description.dataset.output = "remaining-living";
    row.append(term, description);
    fragment.append(row);
  });
  container.replaceChildren(fragment);
}

export function renderGoalChips(container, goals = []) {
  if (!container) return;
  const fragment = document.createDocumentFragment();
  goals.forEach((goal) => {
    const chip = document.createElement("span");
    chip.className = goal.id === "emergency" ? "goal-chip goal-chip--warning" : "goal-chip";
    chip.dataset.goalId = goal.id ?? "";
    chip.textContent = `${goal.label ?? "목표 자금"} · ${renderMoney(goal.amount)}`;
    fragment.append(chip);
  });
  container.replaceChildren(fragment);
}

export function renderProductCards(container, productItems = []) {
  if (!container) return;
  const fragment = document.createDocumentFragment();

  productItems.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.dataset.productId = product.id ?? "";

    const top = document.createElement("div");
    top.className = "product-card__top";
    const identity = document.createElement("div");
    const bank = document.createElement("p");
    bank.className = "product-card__bank";
    bank.textContent = product.bankName ?? "";
    const name = document.createElement("h4");
    name.className = "product-card__name";
    name.textContent = product.name ?? "";
    identity.append(bank, name);
    const rate = document.createElement("p");
    rate.className = "product-card__rate";
    rate.textContent = `연 ${(toSafeNumber(Number(product.rate) * 1000) / 10).toFixed(1)}%`;
    top.append(identity, rate);

    const meta = document.createElement("p");
    meta.className = "product-card__meta";
    meta.textContent = `${product.type ?? ""} · ${product.term ?? "기간 없음"}`;
    card.append(top, meta);

    if (product.note) {
      const note = document.createElement("p");
      note.className = "product-card__note";
      note.textContent = product.note;
      card.append(note);
    }
    fragment.append(card);
  });

  container.replaceChildren(fragment);
}

export function setProgress(element, percent) {
  if (!element) return;
  const safePercent = Math.min(100, Math.max(0, Math.round(Number(percent) || 0)));
  element.setAttribute("aria-valuenow", String(safePercent));
  const bar = element.querySelector(".progress__bar");
  if (bar) bar.style.width = `${safePercent}%`;
}
