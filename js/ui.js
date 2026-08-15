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

export function renderCoachOptions(container, { recommendedOption, alternatives = [] } = {}) {
  if (!container) return;
  const fragment = document.createDocumentFragment();
  const options = [recommendedOption, ...alternatives].filter(Boolean);

  options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === 0 ? "coach-option coach-option--recommended" : "coach-option";
    button.dataset.action = "select-coach-option";
    button.dataset.optionId = String(option.id ?? "");
    button.dataset.commitAmount = String(option.commitAmount ?? "");
    button.dataset.optionTitle = String(option.title ?? "");
    button.setAttribute("aria-pressed", "false");

    const title = document.createElement("span");
    title.className = "coach-option__title";
    title.textContent = option.title ?? "";
    button.append(title);

    if (option.description) {
      const description = document.createElement("span");
      description.className = "coach-option__description";
      description.textContent = option.description;
      button.append(description);
    }

    fragment.append(button);
  });

  container.replaceChildren(fragment);
}

export function renderCoachInfoCards(container, { recommendedOption, alternatives = [] } = {}) {
  if (!container) return;
  const fragment = document.createDocumentFragment();
  const options = [recommendedOption, ...alternatives].filter(Boolean);

  options.forEach((option, index) => {
    const card = document.createElement("div");
    card.className = index === 0 ? "coach-info-card coach-info-card--recommended" : "coach-info-card";

    const title = document.createElement("p");
    title.className = "coach-info-card__title";
    title.textContent = option.title ?? "";
    card.append(title);

    if (option.description) {
      const description = document.createElement("p");
      description.className = "coach-info-card__description";
      description.textContent = option.description;
      card.append(description);
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

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(container) {
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  );
}

let activeModal = null;

function handleModalKeydown(event) {
  if (!activeModal) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeModal(activeModal.modalEl);
    return;
  }
  if (event.key !== "Tab") return;

  const focusable = getFocusable(activeModal.modalEl);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// Locks body scroll and traps Tab/Escape inside modalEl until closeModal() is called.
export function openModal(modalEl, { focusEl, returnFocusEl, onClose } = {}) {
  if (!modalEl) return;
  if (activeModal?.modalEl === modalEl) return;
  if (activeModal) closeModal(activeModal.modalEl);

  const previousFocus = returnFocusEl instanceof HTMLElement
    ? returnFocusEl
    : (document.activeElement instanceof HTMLElement ? document.activeElement : null);

  modalEl.hidden = false;
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", handleModalKeydown, true);
  activeModal = { modalEl, previousFocus, onClose };

  const target = focusEl && modalEl.contains(focusEl) ? focusEl : getFocusable(modalEl)[0];
  target?.focus();
}

export function closeModal(modalEl) {
  if (!modalEl) return;
  if (!activeModal || activeModal.modalEl !== modalEl) {
    modalEl.hidden = true;
    return;
  }
  const { previousFocus, onClose } = activeModal;
  document.removeEventListener("keydown", handleModalKeydown, true);
  modalEl.hidden = true;
  document.body.style.overflow = "";
  activeModal = null;
  onClose?.();
  previousFocus?.focus?.();
}

export function isModalOpen(modalEl) {
  return Boolean(activeModal && activeModal.modalEl === modalEl);
}
