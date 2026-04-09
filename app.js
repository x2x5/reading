const prompts = [
  {
    id: "latex-translator",
    title: "学术翻译官",
    promptText: [
      "Role: 资深计算机科学学术翻译官",
      "Task: 翻译英文LaTeX代码片段为中文",
      "Constraints:",
      "- 清洗LaTeX语法(删除\\cite, \\ref等)",
      "- 数学公式转自然语言",
      "- 直译不润色",
      "- 保持原句式",
      "Input: [用户粘贴LaTeX代码]"
    ].join("\n")
  }
];

const promptGrid = document.querySelector("#promptGrid");
const cardTemplate = document.querySelector("#promptCardTemplate");

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

function renderPromptCard(prompt, index) {
  const cardNode = cardTemplate.content.firstElementChild.cloneNode(true);

  const titleEl = cardNode.querySelector(".prompt-title");
  const promptTextEl = cardNode.querySelector(".prompt-text");
  const inputEl = cardNode.querySelector(".user-input");
  const copyBtn = cardNode.querySelector(".copy-btn");
  const statusEl = cardNode.querySelector(".copy-status");

  titleEl.textContent = prompt.title;
  promptTextEl.textContent = prompt.promptText;

  cardNode.style.animationDelay = `${Math.min(index * 90, 450)}ms`;

  copyBtn.addEventListener("click", async () => {
    const composedText = `${prompt.promptText}\n\n${inputEl.value.trim()}`.trim();
    copyBtn.disabled = true;

    try {
      await copyText(composedText);
      statusEl.textContent = "Copied to clipboard";
      copyBtn.textContent = "Copied";

      window.setTimeout(() => {
        statusEl.textContent = "";
        copyBtn.textContent = "Copy";
      }, 1600);
    } catch (error) {
      statusEl.textContent = "Copy failed. Please try again.";
      console.error("Copy error:", error);
    } finally {
      copyBtn.disabled = false;
    }
  });

  return cardNode;
}

function init() {
  const fragment = document.createDocumentFragment();

  prompts.forEach((prompt, index) => {
    fragment.appendChild(renderPromptCard(prompt, index));
  });

  promptGrid.appendChild(fragment);
}

init();
