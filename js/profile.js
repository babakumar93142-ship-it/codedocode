// ===== CodeDo — Profile page =====
import { db, watchAuth, loginWithGoogle, renderNavUser, getUserProfile } from "./auth.js";
import { getFollowersCount, getFollowingCount, getFollowButtonState, follow, unfollow } from "./follow.js";
import { openCodeFullscreen } from "./codeview.js";
import {
  collection, query, where, getDocs, doc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (sel) => document.querySelector(sel);
const loginBtn = $("#loginBtn");
const userBox = $("#userBox");
const editProfileBtn = $("#editProfileBtn");
const editModal = $("#editModal");
const editForm = $("#editForm");
const followBtn = $("#followBtn");
const profileCard = $("#profileCard");
const profileSnippets = $("#profileSnippets");

const params = new URLSearchParams(window.location.search);
let viewedUid = params.get("uid");

let me = null;
let myProfile = null;

watchAuth((user, profile) => {
  me = user;
  myProfile = profile;
  renderNavUser(userBox, user, profile);

  if (user) {
    loginBtn.style.display = "none";

    if (!viewedUid) viewedUid = user.uid; // no uid in URL -> show my own profile
    if (viewedUid === user.uid) {
      editProfileBtn.style.display = "inline-block";
    }
  } else {
    loginBtn.style.display = "inline-block";
  }

  if (viewedUid) loadProfile(viewedUid);
});

loginBtn.onclick = async () => {
  try { await loginWithGoogle(); }
  catch (e) { alert("Login fail ho gaya: " + e.message); }
};

async function loadProfile(uid) {
  const profile = await getUserProfile(uid);
  if (!profile) {
    profileCard.style.display = "none";
    profileSnippets.innerHTML = `<div class="empty">User nahi mila.</div>`;
    return;
  }

  profileCard.style.display = "block";
  $("#p_photo").src = profile.photo || "";
  $("#p_name").textContent = profile.name || "User";
  $("#p_username").textContent = "@" + (profile.username || "user");

  let synced = 0, locals = 0;
  try {
    [synced, locals] = await Promise.all([getFollowersCount(uid), getFollowingCount(uid)]);
  } catch (e) {
    console.error("Follow counts load nahi hue (Firestore rules check karo):", e);
  }
  $("#p_synced_count").textContent = synced;
  $("#p_locals_count").textContent = locals;

  if (me && me.uid !== uid) {
    followBtn.style.display = "inline-block";
    await refreshFollowButton(uid);
  } else {
    followBtn.style.display = "none";
  }

  const snap = await getDocs(query(collection(db, "snippets"), where("authorId", "==", uid)));
  const snippets = snap.docs.map(d => d.data());
  profileSnippets.innerHTML = snippets.length ? snippets.map((s, idx) => `
    <div class="card">
      <div class="card-head"><h3>${escapeHtml(s.title)}</h3><span class="tag">${escapeHtml(s.language)}</span></div>
      <p class="desc">${escapeHtml(s.description || "")}</p>
      <pre data-idx="${idx}">${escapeHtml(s.code)}</pre>
      <div class="card-foot">
        <span></span>
        <button class="btn copy-btn" data-idx="${idx}">Copy</button>
      </div>
    </div>
  `).join("") : `<div class="empty">Abhi tak koi code upload nahi kiya.</div>`;

  profileSnippets.querySelectorAll(".copy-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const code = snippets[btn.dataset.idx].code;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "Copied ✓";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1500);
      });
    };
  });

  profileSnippets.querySelectorAll("pre").forEach(pre => {
    pre.onclick = () => {
      const s = snippets[pre.dataset.idx];
      openCodeFullscreen({ title: s.title, language: s.language, code: s.code });
    };
  });
}

async function refreshFollowButton(otherUid) {
  const state = await getFollowButtonState(me.uid, otherUid);
  followBtn.textContent = state.label;
  followBtn.dataset.action = state.action;
  followBtn.className = state.action === "unfollow" ? "btn ghost" : "btn";
}

followBtn.onclick = async () => {
  if (!me) return alert("Pehle login karo.");
  const action = followBtn.dataset.action;
  if (action === "follow") await follow(me.uid, viewedUid);
  else await unfollow(me.uid, viewedUid);
  await loadProfile(viewedUid);
};

// ---- Edit profile ----
editProfileBtn.onclick = () => {
  $("#e_name").value = myProfile?.name || "";
  $("#e_username").value = myProfile?.username || "";
  editModal.classList.add("show");
};
$("#closeEdit").onclick = () => editModal.classList.remove("show");

editForm.onsubmit = async (e) => {
  e.preventDefault();
  const name = $("#e_name").value.trim();
  const username = $("#e_username").value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!name || !username) return alert("Naam aur username dono zaroori hai.");

  await updateDoc(doc(db, "users", me.uid), { name, username });
  editModal.classList.remove("show");
  loadProfile(me.uid);
};

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}
