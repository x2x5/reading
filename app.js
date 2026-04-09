const STORAGE_KEY = "prompt-card-manager:v2";
const DEFAULT_CARDS_URL = "default-cards.json";
const FALLBACK_DEFAULT_CARDS = [
  {
    id: "fallback-card",
    title: "默认卡片",
    category: "通用",
    promptText: "请在 default-cards.json 中添加你的默认卡片。",
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];

const state = {
  cards: [],
  expandedIds: new Set(),
  userInputs: {},
  modalMode: "create",
  editingId: null,
  draggingId: null
};

const promptGrid = document.querySelector("#promptGrid");
const cardTemplate = document.querySelector("#promptCardTemplate");
const addCardBtn = document.querySelector("#addCardBtn");
const resetBtn = document.querySelector("#resetBtn");
const cardModal = document.querySelector("#cardModal");
const modalTitle = document.querySelector("#modalTitle");
const closeModalBtn = document.querySelector("#closeModalBtn");
const cancelModalBtn = document.querySelector("#cancelModalBtn");
const cardForm = document.querySelector("#cardForm");
const cardTitleInput = document.querySelector("#cardTitle");
const cardCategoryInput = document.querySelector("#cardCategory");
const cardPromptInput = document.querySelector("#cardPrompt");

function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `card-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneCards(cards) {
  return cards.map((card) => ({ ...card }));
}

async function loadDefaultCardsFromFile() {
  try {
    const response = await window.fetch(DEFAULT_CARDS_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Failed to fetch default cards: ${response.status}`);
    }

    const parsed = await response.json();
    const normalized = normalizeCards(parsed);

    if (normalized.length === 0) {
      throw new Error("default-cards.json has no valid cards.");
    }

    return normalized;
  } catch (error) {
    console.error("Failed to load default-cards.json, using fallback card:", error);
    return cloneCards(FALLBACK_DEFAULT_CARDS);
  }
}

function normalizeCards(rawCards) {
  if (!Array.isArray(rawCards)) {
    return [];
  }

  const normalized = rawCards
    .map((card) => {
      if (!card || typeof card !== "object") {
        return null;
      }

      const id = String(card.id || "").trim();
      const title = String(card.title || "").trim();
      const category = String(card.category || "").trim();
      const promptText = String(card.promptText || "").trim();
      const createdAt = String(card.createdAt || "").trim();

      if (!id || !title || !category || !promptText || !createdAt) {
        return null;
      }

      return {
        id,
        title,
        category,
        promptText,
        createdAt
      };
    })
    .filter(Boolean);

  return normalized;
}

async function loadCards() {
  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const normalized = normalizeCards(parsed);

      if (normalized.length > 0) {
        return normalized;
      }
    } catch (error) {
      console.error("Failed to parse stored cards:", error);
    }
  }

  const defaults = await loadDefaultCardsFromFile();
  saveCards(defaults);
  return defaults;
}

function saveCards(cards = state.cards) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    return true;
  } catch (error) {
    console.error("Failed to save cards:", error);
    return false;
  }
}

function formatDate(iso) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "创建时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function fallbackCopy(text) {
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "readonly");
  helper.style.position = "fixed";
  helper.style.left = "-9999px";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  document.body.removeChild(helper);
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  fallbackCopy(text);
}

function openModal(mode, card = null) {
  state.modalMode = mode;
  state.editingId = card ? card.id : null;

  modalTitle.textContent = mode === "edit" ? "编辑卡片" : "新增卡片";
  cardTitleInput.value = card ? card.title : "";
  cardCategoryInput.value = card ? card.category : "";
  cardPromptInput.value = card ? card.promptText : "";

  cardModal.hidden = false;
  cardTitleInput.focus();
}

function closeModal() {
  cardModal.hidden = true;
  cardForm.reset();
  state.editingId = null;
}

function getCardById(id) {
  return state.cards.find((card) => card.id === id) || null;
}

function renderEmptyState() {
  promptGrid.innerHTML = '<p class="empty-state">暂无卡片，点击“新增卡片”开始创建。</p>';
}

function renderCards() {
  promptGrid.innerHTML = "";

  if (state.cards.length === 0) {
    renderEmptyState();
    return;
  }

  const fragment = document.createDocumentFragment();

  state.cards.forEach((card) => {
    const cardNode = cardTemplate.content.firstElementChild.cloneNode(true);
    const titleEl = cardNode.querySelector(".prompt-title");
    const categoryEl = cardNode.querySelector(".category-tag");
    const createdAtEl = cardNode.querySelector(".created-at");
    const toggleBtn = cardNode.querySelector(".toggle-btn");
    const promptCollapse = cardNode.querySelector(".prompt-collapse");
    const promptText = cardNode.querySelector(".prompt-text");
    const inputEl = cardNode.querySelector(".user-input");

    cardNode.dataset.id = card.id;

    titleEl.textContent = card.title;
    categoryEl.textContent = card.category;
    createdAtEl.textContent = `创建于 ${formatDate(card.createdAt)}`;
    promptText.textContent = card.promptText;

    const isExpanded = state.expandedIds.has(card.id);
    toggleBtn.textContent = isExpanded ? "收起" : "展开";
    toggleBtn.setAttribute("aria-expanded", String(isExpanded));
    promptCollapse.hidden = !isExpanded;

    inputEl.value = state.userInputs[card.id] || "";

    fragment.appendChild(cardNode);
  });

  promptGrid.appendChild(fragment);
}

function toggleExpand(cardId) {
  if (state.expandedIds.has(cardId)) {
    state.expandedIds.delete(cardId);
  } else {
    state.expandedIds.add(cardId);
  }

  renderCards();
}

function deleteCard(cardId) {
  const target = getCardById(cardId);

  if (!target) {
    return;
  }

  const confirmed = window.confirm(`确认删除「${target.title}」吗？`);

  if (!confirmed) {
    return;
  }

  state.cards = state.cards.filter((card) => card.id !== cardId);
  state.expandedIds.delete(cardId);
  delete state.userInputs[cardId];

  saveCards();
  renderCards();
}

function reorderCards(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) {
    return;
  }

  const fromIndex = state.cards.findIndex((card) => card.id === sourceId);
  const rawTargetIndex = state.cards.findIndex((card) => card.id === targetId);

  if (fromIndex === -1 || rawTargetIndex === -1) {
    return;
  }

  const [moved] = state.cards.splice(fromIndex, 1);
  const targetIndex = fromIndex < rawTargetIndex ? rawTargetIndex - 1 : rawTargetIndex;
  state.cards.splice(targetIndex, 0, moved);

  saveCards();
  renderCards();
}

async function handleCopy(cardId, button, statusEl) {
  const card = getCardById(cardId);

  if (!card) {
    return;
  }

  const userInput = (state.userInputs[cardId] || "").trim();
  const composed = userInput ? `${card.promptText}\n\n${userInput}` : card.promptText;

  button.disabled = true;

  try {
    await copyText(composed);
    statusEl.textContent = "已复制";

    window.setTimeout(() => {
      statusEl.textContent = "";
    }, 1500);
  } catch (error) {
    statusEl.textContent = "复制失败";
    console.error("Copy failed:", error);
  } finally {
    button.disabled = false;
  }
}

function handleFormSubmit(event) {
  event.preventDefault();

  const title = cardTitleInput.value.trim();
  const category = cardCategoryInput.value.trim();
  const promptText = cardPromptInput.value.trim();

  if (!title || !category || !promptText) {
    return;
  }

  if (state.modalMode === "edit" && state.editingId) {
    state.cards = state.cards.map((card) => {
      if (card.id !== state.editingId) {
        return card;
      }

      return {
        ...card,
        title,
        category,
        promptText
      };
    });
  } else {
    state.cards.unshift({
      id: generateId(),
      title,
      category,
      promptText,
      createdAt: new Date().toISOString()
    });
  }

  const saved = saveCards();

  if (!saved) {
    return;
  }

  closeModal();
  renderCards();
}

async function handleReset() {
  const confirmed = window.confirm("确定重置所有数据吗？这会清空本地修改并恢复默认卡片。");

  if (!confirmed) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  state.cards = await loadDefaultCardsFromFile();
  state.expandedIds.clear();
  state.userInputs = {};

  saveCards();
  renderCards();
}

function bindEvents() {
  addCardBtn.addEventListener("click", () => openModal("create"));
  resetBtn.addEventListener("click", handleReset);

  closeModalBtn.addEventListener("click", closeModal);
  cancelModalBtn.addEventListener("click", closeModal);

  cardModal.addEventListener("click", (event) => {
    if (event.target === cardModal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !cardModal.hidden) {
      closeModal();
    }
  });

  cardForm.addEventListener("submit", handleFormSubmit);

  promptGrid.addEventListener("click", (event) => {
    const cardNode = event.target.closest(".prompt-card");

    if (!cardNode) {
      return;
    }

    const cardId = cardNode.dataset.id;

    if (event.target.closest(".toggle-btn")) {
      toggleExpand(cardId);
      return;
    }

    if (event.target.closest(".edit-btn")) {
      const target = getCardById(cardId);

      if (target) {
        openModal("edit", target);
      }

      return;
    }

    if (event.target.closest(".delete-btn")) {
      deleteCard(cardId);
      return;
    }

    if (event.target.closest(".copy-btn")) {
      const button = event.target.closest(".copy-btn");
      const statusEl = cardNode.querySelector(".copy-status");
      handleCopy(cardId, button, statusEl);
    }
  });

  promptGrid.addEventListener("input", (event) => {
    const textarea = event.target.closest(".user-input");

    if (!textarea) {
      return;
    }

    const cardNode = textarea.closest(".prompt-card");

    if (!cardNode) {
      return;
    }

    state.userInputs[cardNode.dataset.id] = textarea.value;
  });

  promptGrid.addEventListener("dragstart", (event) => {
    const cardNode = event.target.closest(".prompt-card");

    if (!cardNode) {
      return;
    }

    state.draggingId = cardNode.dataset.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", state.draggingId);
    cardNode.classList.add("dragging");
  });

  promptGrid.addEventListener("dragend", (event) => {
    const cardNode = event.target.closest(".prompt-card");

    if (cardNode) {
      cardNode.classList.remove("dragging");
    }

    state.draggingId = null;
    promptGrid.querySelectorAll(".drag-over").forEach((node) => node.classList.remove("drag-over"));
  });

  promptGrid.addEventListener("dragover", (event) => {
    const cardNode = event.target.closest(".prompt-card");

    if (!cardNode) {
      return;
    }

    const targetId = cardNode.dataset.id;

    if (!state.draggingId || targetId === state.draggingId) {
      return;
    }

    event.preventDefault();
    promptGrid.querySelectorAll(".drag-over").forEach((node) => {
      if (node !== cardNode) {
        node.classList.remove("drag-over");
      }
    });
    cardNode.classList.add("drag-over");
  });

  promptGrid.addEventListener("dragleave", (event) => {
    const cardNode = event.target.closest(".prompt-card");

    if (cardNode) {
      cardNode.classList.remove("drag-over");
    }
  });

  promptGrid.addEventListener("drop", (event) => {
    const cardNode = event.target.closest(".prompt-card");

    if (!cardNode) {
      return;
    }

    event.preventDefault();

    const targetId = cardNode.dataset.id;
    reorderCards(state.draggingId, targetId);

    promptGrid.querySelectorAll(".drag-over").forEach((node) => node.classList.remove("drag-over"));
  });
}

async function init() {
  state.cards = await loadCards();
  bindEvents();
  renderCards();
}

init();
