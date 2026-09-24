// ===== CodeDo — Folder browser =====
import { db, watchAuth, loginWithGoogle, renderNavUser } from "./auth.js";
import { openCodeFullscreen } from "./codeview.js";
import {
  createFolder, renameFolder, setFolderVisibility, moveFolder, getFolder, getAllFolders,
  getFolderByShareCode, deleteFolderRecursive, moveSnippetToFolder, deleteSnippet,
  duplicateSnippet, addSnippetToFolder, getFolderPath
} from "./folders.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (sel) => document.querySelector(sel);
const loginBtn = $("#loginBtn");
const userBox = $("#userBox");
const breadcrumb = $("#breadcrumb");
const folderToolbar = $("#folderToolbar");
const folderGrid = $("#folderGrid");
const shareCodeInput = $("#shareCodeInput");
const pasteBtn = $("#pasteBtn");
const clipboardStatus = $("#clipboardStatus");

let me = null;
let myProfile = null;

const params = new URLSearchParams(window.location.search);
let viewUid = params.get("uid");
let currentFolderId = params.get("folder") || null;
let unlockedViaCode = null; // folderId that was unlocked through a share code this session

let clipboard = null; // { action: "cut"|"copy", type: "folder"|"snippet", data }

watchAuth((user, profile) => {
  me = user;
  myProfile = profile;
  renderNavUser(userBox, user, profile);
  loginBtn.style.display = user ? "none" : "inline-block";

  if (!viewUid && user) viewUid = user.uid;
  render();
});

loginBtn.onclick = async () => {
  try { await loginWithGoogle(); }
  catch (e) { alert("Login fail ho gaya: " + e.message); }
};

shareCodeInput.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  const code = shareCodeInput.value.trim().toLowerCase();
  if (!code) return;
  const folder = await getFolderByShareCode(code);
  if (!folder) return alert("Ye share code valid nahi hai.");
  viewUid = folder.ownerId;
  currentFolderId = folder.id;
  unlockedViaCode = folder.id;
  history.pushState({}, "", `folder.html?uid=${viewUid}&folder=${folder.id}`);
  render();
});

function isOwner() {
  return me && viewUid === me.uid;
}

async function render() {
  if (!viewUid) {
    folderGrid.innerHTML = `<div class="empty">Kisi profile se "Folders" pe aao, ya upar share code daalo.</div>`;
    folderToolbar.style.display = "none";
    breadcrumb.innerHTML = "";
    return;
  }

  const path = currentFolderId ? await getFolderPath(currentFolderId) : [];

  // privacy check: if not owner and not unlocked via share code, every
  // folder on the path must be public
  if (!isOwner() && currentFolderId !== unlockedViaCode) {
    const blocked = path.some(f => f.visibility !== "public");
    if (blocked) {
      folderGrid.innerHTML = `<div class="empty">Ye folder private hai.</div>`;
      folderToolbar.style.display = "none";
      breadcrumb.innerHTML = "";
      return;
    }
  }

  // breadcrumb
  const ownerName = await getOwnerName(viewUid);
  let crumbHtml = `<a href="folder.html?uid=${viewUid}">${escapeHtml(ownerName)}'s folders</a>`;
  path.forEach(f => { crumbHtml += ` / <a href="folder.html?uid=${viewUid}&folder=${f.id}">${escapeHtml(f.name)}</a>`; });
  breadcrumb.innerHTML = crumbHtml;
  breadcrumb.querySelectorAll("a").forEach(a => {
    a.onclick = (e) => {
      e.preventDefault();
      const url = new URL(a.href);
      currentFolderId = url.searchParams.get("folder") || null;
      history.pushState({}, "", a.href);
      render();
    };
  });

  folderToolbar.style.display = isOwner() ? "flex" : "none";
  updateClipboardUI();

  const allFolders = await getAllFolders(viewUid);
  let subFolders = allFolders.filter(f => f.parentId === (currentFolderId || null));
  if (!isOwner()) subFolders = subFolders.filter(f => f.visibility === "public");

  const snippetsSnap = await getDocs(query(collection(db, "snippets"), where("authorId", "==", viewUid)));
  const allSnippets = snippetsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const here = allSnippets.filter(s => (s.folderId || null) === (currentFolderId || null));

  if (!subFolders.length && !here.length) {
    folderGrid.innerHTML = `<div class="empty">Ye folder khali hai.</div>`;
  } else {
    folderGrid.innerHTML =
      subFolders.map(f => folderCardHtml(f)).join("") +
      here.map(s => snippetCardHtml(s)).join("");
  }

  wireFolderCards(subFolders);
  wireSnippetCards(here);
}

async function getOwnerName(uid) {
  if (me && uid === me.uid) return "Your";
  const snap = await getDocs(query(collection(db, "users")));
  const u = snap.docs.map(d => d.data()).find(u => u.uid === uid);
  return u ? u.name : "Their";
}

function folderCardHtml(f) {
  return `
    <div class="card folder-card" data-folder="${f.id}">
      <div class="card-head">
        <h3>📁 ${escapeHtml(f.name)}</h3>
        <span class="tag">${f.visibility}</span>
      </div>
      ${isOwner() ? `
        <div class="folder-actions">
          <button data-act="open" data-id="${f.id}" class="btn ghost">Open</button>
          <button data-act="rename" data-id="${f.id}" class="btn ghost">Rename</button>
          <button data-act="visibility" data-id="${f.id}" data-current="${f.visibility}" class="btn ghost">${f.visibility === "public" ? "Make private" : "Make public"}</button>
          <button data-act="share" data-id="${f.id}" class="btn ghost">Share</button>
          <button data-act="cut" data-id="${f.id}" class="btn ghost">Cut</button>
          <button data-act="delete" data-id="${f.id}" class="btn danger">Delete</button>
        </div>
      ` : `<button data-act="open" data-id="${f.id}" class="btn ghost">Open</button>`}
    </div>
  `;
}

function snippetCardHtml(s) {
  return `
    <div class="card">
      <div class="card-head"><h3>${escapeHtml(s.title)}</h3><span class="tag">${escapeHtml(s.language)}</span></div>
      <p class="desc">${escapeHtml(s.description || "")}</p>
      <pre data-id="${s.id}" class="snippet-view">${escapeHtml(s.code)}</pre>
      <div class="card-foot">
        <span></span>
        <div style="display:flex;gap:6px">
          <button class="btn copy-btn" data-copy="${s.id}">Copy</button>
          ${isOwner() ? `
            <button class="btn ghost" data-act="move" data-id="${s.id}">Move</button>
            <button class="btn ghost" data-act="cutsnip" data-id="${s.id}">Cut</button>
            <button class="btn ghost" data-act="copysnip" data-id="${s.id}">Copy to...</button>
            <button class="btn danger" data-act="deletesnip" data-id="${s.id}">Delete</button>
          ` : ""}
        </div>
      </div>
    </div>
  `;
}

function wireFolderCards(subFolders) {
  folderGrid.querySelectorAll("[data-act='open']").forEach(btn => {
    btn.onclick = () => {
      currentFolderId = btn.dataset.id;
      history.pushState({}, "", `folder.html?uid=${viewUid}&folder=${currentFolderId}`);
      render();
    };
  });
  folderGrid.querySelectorAll("[data-act='rename']").forEach(btn => {
    btn.onclick = async () => {
      const f = subFolders.find(f => f.id === btn.dataset.id);
      const name = prompt("Naya naam:", f.name);
      if (name && name.trim()) { await renameFolder(f.id, name.trim()); render(); }
    };
  });
  folderGrid.querySelectorAll("[data-act='visibility']").forEach(btn => {
    btn.onclick = async () => {
      const next = btn.dataset.current === "public" ? "private" : "public";
      await setFolderVisibility(btn.dataset.id, next);
      render();
    };
  });
  folderGrid.querySelectorAll("[data-act='share']").forEach(btn => {
    btn.onclick = async () => {
      const f = await getFolder(btn.dataset.id);
      $("#shareCodeOutput").value = f.shareCode;
      $("#shareModal").classList.add("show");
    };
  });
  folderGrid.querySelectorAll("[data-act='cut']").forEach(btn => {
    btn.onclick = () => {
      const f = subFolders.find(f => f.id === btn.dataset.id);
      clipboard = { action: "cut", type: "folder", data: f };
      updateClipboardUI();
    };
  });
  folderGrid.querySelectorAll("[data-act='delete']").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Ye folder aur uske andar ka sab kuch delete karna hai?")) return;
      await deleteFolderRecursive(btn.dataset.id, viewUid);
      render();
    };
  });
}

function wireSnippetCards(here) {
  folderGrid.querySelectorAll(".copy-btn").forEach(btn => {
    btn.onclick = () => {
      const code = folderGrid.querySelector(`.snippet-view[data-id="${btn.dataset.copy}"]`).innerText;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "Copied ✓"; btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1500);
      });
    };
  });
  folderGrid.querySelectorAll(".snippet-view").forEach(pre => {
    pre.onclick = () => {
      const s = here.find(s => s.id === pre.dataset.id);
      if (s) openCodeFullscreen({ title: s.title, language: s.language, code: s.code });
    };
  });
  folderGrid.querySelectorAll("[data-act='move']").forEach(btn => {
    btn.onclick = () => openMoveModal(here.find(s => s.id === btn.dataset.id), "snippet");
  });
  folderGrid.querySelectorAll("[data-act='cutsnip']").forEach(btn => {
    btn.onclick = () => {
      clipboard = { action: "cut", type: "snippet", data: here.find(s => s.id === btn.dataset.id) };
      updateClipboardUI();
    };
  });
  folderGrid.querySelectorAll("[data-act='copysnip']").forEach(btn => {
    btn.onclick = () => {
      clipboard = { action: "copy", type: "snippet", data: here.find(s => s.id === btn.dataset.id) };
      updateClipboardUI();
    };
  });
  folderGrid.querySelectorAll("[data-act='deletesnip']").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Ye code delete karna hai?")) return;
      await deleteSnippet(btn.dataset.id);
      render();
    };
  });
}

function updateClipboardUI() {
  if (!clipboard) {
    pasteBtn.style.display = "none";
    clipboardStatus.textContent = "";
    return;
  }
  pasteBtn.style.display = "inline-block";
  const label = clipboard.type === "folder" ? clipboard.data.name : clipboard.data.title;
  clipboardStatus.textContent = `${clipboard.action === "cut" ? "Cut" : "Copy"}: ${label} — "Paste" is folder me daalne ke liye.`;
}

pasteBtn.onclick = async () => {
  if (!clipboard) return;
  if (clipboard.type === "folder") {
    await moveFolder(clipboard.data.id, currentFolderId);
  } else if (clipboard.type === "snippet") {
    if (clipboard.action === "cut") await moveSnippetToFolder(clipboard.data.id, currentFolderId);
    else await duplicateSnippet(clipboard.data, currentFolderId);
  }
  clipboard = null;
  updateClipboardUI();
  render();
};

// ---- New folder ----
$("#newFolderBtn").onclick = () => $("#newFolderModal").classList.add("show");
$("#closeNewFolder").onclick = () => $("#newFolderModal").classList.remove("show");
$("#newFolderForm").onsubmit = async (e) => {
  e.preventDefault();
  const name = $("#nf_name").value.trim();
  const visibility = $("#nf_visibility").value;
  if (!name) return;
  await createFolder(me.uid, currentFolderId, name, visibility);
  $("#newFolderModal").classList.remove("show");
  $("#nf_name").value = "";
  render();
};

// ---- Add code here ----
$("#addCodeHereBtn").onclick = () => $("#addCodeModal").classList.add("show");
$("#closeAddCode").onclick = () => $("#addCodeModal").classList.remove("show");
$("#addCodeForm").onsubmit = async (e) => {
  e.preventDefault();
  const title = $("#ac_title").value.trim();
  const language = $("#ac_lang").value;
  const description = $("#ac_desc").value.trim();
  const code = $("#ac_code").value;
  if (!title || !code) return alert("Title aur code zaroori hai.");
  await addSnippetToFolder(me.uid, myProfile?.name || me.email, currentFolderId, { title, language, description, code });
  $("#addCodeModal").classList.remove("show");
  $("#addCodeForm").reset();
  render();
};

// ---- Move modal ----
async function openMoveModal(snippet, type) {
  const allFolders = await getAllFolders(viewUid);
  const list = $("#moveFolderList");
  list.innerHTML = [{ id: "", name: "Root (no folder)" }, ...allFolders].map(f => `
    <div class="f-item" data-target="${f.id}">${f.id ? "📁 " : "⟳ "}${escapeHtml(f.name)}</div>
  `).join("");
  list.querySelectorAll(".f-item").forEach(item => {
    item.onclick = async () => {
      await moveSnippetToFolder(snippet.id, item.dataset.target || null);
      $("#moveModal").classList.remove("show");
      render();
    };
  });
  $("#moveModal").classList.add("show");
}
$("#closeMove").onclick = () => $("#moveModal").classList.remove("show");

// ---- Share modal ----
$("#closeShare").onclick = () => $("#shareModal").classList.remove("show");
$("#copyShareCodeBtn").onclick = () => {
  navigator.clipboard.writeText($("#shareCodeOutput").value);
  $("#copyShareCodeBtn").textContent = "Copied ✓";
  setTimeout(() => { $("#copyShareCodeBtn").textContent = "Copy code"; }, 1500);
};

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}
