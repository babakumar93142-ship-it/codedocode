// ===== CodeDo — People search =====
import { db, watchAuth, loginWithGoogle, renderNavUser } from "./auth.js";
import { getFollowButtonState, follow, unfollow } from "./follow.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (sel) => document.querySelector(sel);
const loginBtn = $("#loginBtn");
const userBox = $("#userBox");
const searchInput = $("#searchInput");
const peopleGrid = $("#peopleGrid");

let me = null;
let allUsers = [];

watchAuth((user, profile) => {
  me = user;
  renderNavUser(userBox, user, profile);
  if (user) {
    loginBtn.style.display = "none";
  } else {
    loginBtn.style.display = "inline-block";
  }
  loadUsers();
});

loginBtn.onclick = async () => {
  try { await loginWithGoogle(); }
  catch (e) { alert("Login fail ho gaya: " + e.message); }
};

async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => !me || u.id !== me.uid);
  renderUsers(allUsers);
}

searchInput.addEventListener("input", () => {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = allUsers.filter(u =>
    (u.name || "").toLowerCase().includes(term) || (u.username || "").toLowerCase().includes(term)
  );
  renderUsers(filtered);
});

function renderUsers(users) {
  if (!users.length) {
    peopleGrid.innerHTML = `<div class="empty">Koi user nahi mila.</div>`;
    return;
  }
  peopleGrid.innerHTML = users.map(u => `
    <div class="card" style="display:flex;align-items:center;gap:12px">
      <img src="${u.photo || ''}" style="width:44px;height:44px;border-radius:50%;border:1px solid var(--border-strong)">
      <div style="flex:1">
        <a href="profile.html?uid=${u.id}" style="color:var(--white);font-weight:500;font-size:14px">${escapeHtml(u.name)}</a>
        <div style="color:var(--muted);font-size:12px">@${escapeHtml(u.username || "user")}</div>
      </div>
      <button class="btn" data-uid="${u.id}" style="padding:6px 14px;font-size:12px" ${me ? "" : "disabled"}>Follow</button>
    </div>
  `).join("");

  if (me) {
    peopleGrid.querySelectorAll("button[data-uid]").forEach(async (btn) => {
      const otherUid = btn.dataset.uid;
      const state = await getFollowButtonState(me.uid, otherUid);
      btn.textContent = state.label;
      btn.dataset.action = state.action;
      if (state.action === "unfollow") btn.classList.add("ghost");

      btn.onclick = async () => {
        if (btn.dataset.action === "follow") await follow(me.uid, otherUid);
        else await unfollow(me.uid, otherUid);
        const newState = await getFollowButtonState(me.uid, otherUid);
        btn.textContent = newState.label;
        btn.dataset.action = newState.action;
        btn.classList.toggle("ghost", newState.action === "unfollow");
      };
    });
  }
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}
