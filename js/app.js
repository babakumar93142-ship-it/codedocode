// ===== CodeDo — snippets (browse / upload / copy) =====
import { db, auth, watchAuth, loginWithGoogle, renderNavUser } from "./auth.js";
import { testRunCode } from "./checker.js";
import {
  collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (sel) => document.querySelector(sel);
const grid = $("#snippetGrid");
const searchInput = $("#searchInput");
const langFilter = $("#langFilter");
const loginBtn = $("#loginBtn");
const userBox = $("#userBox");
const uploadBtn = $("#uploadBtn");
const uploadModal = $("#uploadModal");
const uploadForm = $("#uploadForm");

let currentUser = null;
let currentProfile = null;
let allSnippets = [];

// ---- Auth UI ----
watchAuth((user, profile) => {
  currentUser = user;
  currentProfile = profile;
  renderNavUser(userBox, user, profile);
  if (user) {
    loginBtn.style.display = "none";
    uploadBtn.style.display = "inline-block";
  } else {
    loginBtn.style.display = "inline-block";
    uploadBtn.style.display = "none";
  }
});

loginBtn.onclick = async () => {
  try { await loginWithGoogle(); }
  catch (e) { alert("Login fail ho gaya: " + e.message); }
};

// ---- Load snippets ----
async function loadSnippets() {
  grid.innerHTML = `<div class="empty">Loading code...</div>`;
  const q = query(collection(db, "snippets"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  allSnippets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderSnippets();
}

function renderSnippets() {
  const term = searchInput.value.trim().toLowerCase();
  const lang = langFilter.value;

  const filtered = allSnippets.filter(s => {
    const matchesLang = lang === "all" || s.language === lang;
    const matchesTerm = !term ||
      s.title.toLowerCase().includes(term) ||
      (s.description || "").toLowerCase().includes(term) ||
      (s.authorName || "").toLowerCase().includes(term);
    return matchesLang && matchesTerm;
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty">Koi code nahi mila. Sabse pehle tum upload karo!</div>`;
    return;
  }

  grid.innerHTML = filtered.map(s => `
    <div class="card">
      <div class="card-head">
        <h3>${escapeHtml(s.title)}</h3>
        <span class="tag">${escapeHtml(s.language)}</span>
      </div>
      <p class="desc">${escapeHtml(s.description || "")}</p>
      <pre id="code-${s.id}">${escapeHtml(s.code)}</pre>
      <div class="card-foot">
        <a href="profile.html?uid=${s.authorId}" class="author">@${escapeHtml(s.authorName || "anon")}</a>
        <button class="btn copy-btn" data-id="${s.id}">Copy</button>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.onclick = () => {
      const code = document.getElementById(`code-${btn.dataset.id}`).innerText;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "Copied ✓";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1500);
      });
    };
  });
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

searchInput.addEventListener("input", renderSnippets);
langFilter.addEventListener("change", renderSnippets);

// ---- Upload modal ----
uploadBtn.onclick = () => uploadModal.classList.add("show");
$("#closeUpload").onclick = () => uploadModal.classList.remove("show");

const compileError = $("#compileError");
const publishBtn = $("#publishBtn");

uploadForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Pehle login karo.");

  const title = $("#f_title").value.trim();
  const language = $("#f_lang").value;
  const description = $("#f_desc").value.trim();
  const code = $("#f_code").value;

  if (!title || !code) return alert("Title aur code dono zaroori hai.");

  compileError.style.display = "none";

  // Only JavaScript and Python can actually be checked in-browser without
  // a paid backend — everything else publishes directly.
  const isCheckable = ["JavaScript", "Python"].includes(language);

  if (isCheckable) {
    publishBtn.disabled = true;
    publishBtn.textContent = "Checking code...";
    let result;
    try {
      result = await testRunCode(language, code);
    } catch (err) {
      result = { runnable: true, ok: true }; // service down — don't block publishing
    }
    publishBtn.disabled = false;
    publishBtn.textContent = "Publish";

    if (result.runnable && !result.ok) {
      compileError.style.display = "block";
      compileError.innerHTML = `
        <div style="color:var(--danger);margin-bottom:6px">Code me error hai — publish nahi hua:</div>
        <pre style="border-color:var(--danger);color:#ffb3b3;max-height:160px">${escapeHtml(result.error)}</pre>
      `;
      return;
    }
  }

  await addDoc(collection(db, "snippets"), {
    title, language, description, code,
    authorId: currentUser.uid,
    authorName: currentProfile?.name || currentUser.email,
    createdAt: serverTimestamp()
  });

  uploadForm.reset();
  compileError.style.display = "none";
  uploadModal.classList.remove("show");
  loadSnippets();
};

loadSnippets();
