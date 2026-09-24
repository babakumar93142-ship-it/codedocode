// ===== CodeDo — fullscreen code viewer =====
// Click any code block to open it fullscreen with a back arrow and a
// copy button. Injected once into the page on first use.

let overlay = null;

function ensureOverlay() {
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.className = "code-fullscreen";
  overlay.id = "codeFullscreenOverlay";
  overlay.innerHTML = `
    <button class="code-fs-back" id="codeFsBack" title="Back" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
    </button>
    <div class="code-fs-header">
      <div>
        <h2 id="codeFsTitle"></h2>
        <span class="tag" id="codeFsLang"></span>
      </div>
      <button class="btn copy-btn" id="codeFsCopy" type="button">Copy</button>
    </div>
    <pre class="code-fs-pre" id="codeFsPre"></pre>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#codeFsBack").onclick = closeCodeFullscreen;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeCodeFullscreen(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCodeFullscreen(); });

  return overlay;
}

export function openCodeFullscreen({ title, language, code }) {
  const ov = ensureOverlay();
  ov.querySelector("#codeFsTitle").textContent = title || "";
  ov.querySelector("#codeFsLang").textContent = language || "";
  ov.querySelector("#codeFsPre").textContent = code || "";

  const copyBtn = ov.querySelector("#codeFsCopy");
  copyBtn.textContent = "Copy";
  copyBtn.classList.remove("copied");
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(code || "").then(() => {
      copyBtn.textContent = "Copied ✓";
      copyBtn.classList.add("copied");
      setTimeout(() => { copyBtn.textContent = "Copy"; copyBtn.classList.remove("copied"); }, 1500);
    });
  };

  ov.classList.add("show");
  document.body.style.overflow = "hidden";
}

export function closeCodeFullscreen() {
  if (!overlay) return;
  overlay.classList.remove("show");
  document.body.style.overflow = "";
}
