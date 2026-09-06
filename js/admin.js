// ===== CodeDo — Admin panel logic =====
import { db, watchAuth, loginWithGoogle, logout } from "./auth.js";
import {
  collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (sel) => document.querySelector(sel);
const gate = $("#gate");
const panel = $("#panel");
const usersBody = $("#usersBody");
const snippetsBody = $("#snippetsBody");

watchAuth((user, profile) => {
  if (!user || profile?.role !== "admin") {
    gate.style.display = "block";
    panel.style.display = "none";
    $("#gateBtn").onclick = () => loginWithGoogle().catch(e => alert(e.message));
    return;
  }
  gate.style.display = "none";
  panel.style.display = "block";
  $("#whoami").textContent = profile.name + " (" + profile.email + ")";
  $("#adminLogout").onclick = () => logout();
  loadUsers();
  loadSnippets();
});

async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  usersBody.innerHTML = users.map(u => `
    <tr>
      <td>${u.name || "-"}</td>
      <td>${u.email}</td>
      <td>${u.role === "admin"
          ? '<span class="badge admin">admin</span>'
          : u.banned ? '<span class="badge banned">suspended</span>' : '<span class="badge active">active</span>'}</td>
      <td>
        ${u.role === "admin" ? "" : `
          <button class="btn ghost" data-action="toggle" data-id="${u.id}" data-banned="${u.banned}" style="padding:5px 10px;font-size:11px">
            ${u.banned ? "Unsuspend" : "Suspend"}
          </button>
          <button class="btn danger" data-action="delete" data-id="${u.id}" style="padding:5px 10px;font-size:11px">Delete</button>
        `}
      </td>
    </tr>
  `).join("");

  usersBody.querySelectorAll("button[data-action='toggle']").forEach(btn => {
    btn.onclick = async () => {
      const banned = btn.dataset.banned === "true";
      await updateDoc(doc(db, "users", btn.dataset.id), { banned: !banned });
      loadUsers();
    };
  });
  usersBody.querySelectorAll("button[data-action='delete']").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Ye user delete karna hai? (permanent)")) return;
      await deleteDoc(doc(db, "users", btn.dataset.id));
      loadUsers();
    };
  });
}

async function loadSnippets() {
  const q = query(collection(db, "snippets"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  snippetsBody.innerHTML = items.map(s => `
    <tr>
      <td>${s.title}</td>
      <td>${s.language}</td>
      <td>${s.authorName || "-"}</td>
      <td><button class="btn danger" data-id="${s.id}" style="padding:5px 10px;font-size:11px">Delete</button></td>
    </tr>
  `).join("");

  snippetsBody.querySelectorAll("button").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Ye code delete karna hai?")) return;
      await deleteDoc(doc(db, "snippets", btn.dataset.id));
      loadSnippets();
    };
  });
}
