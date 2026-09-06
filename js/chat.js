// ===== CodeDo — Friends & Chat =====
import { db, watchAuth, loginWithGoogle, renderNavUser } from "./auth.js";
import {
  collection, query, where, getDocs, addDoc, doc, updateDoc,
  onSnapshot, orderBy, serverTimestamp, setDoc, getDoc, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (sel) => document.querySelector(sel);
const gate = $("#gate");
const wrap = $("#chatWrap");
const friendList = $("#friendList");
const requestsBox = $("#requestsBox");
const searchInput = $("#friendSearch");
const searchResults = $("#searchResults");
const chatMsgs = $("#chatMsgs");
const chatInput = $("#chatInput");
const chatHeader = $("#chatHeader");
const sendBtn = $("#sendBtn");
const replyBar = $("#replyBar");
const replyBarText = $("#replyBarText");
const cancelReplyBtn = $("#cancelReplyBtn");
const userBox = $("#userBox");

let me = null;
let myProfile = null;
let activeFriendId = null;
let unsubMsgs = null;

watchAuth((user, profile) => {
  renderNavUser(userBox, user, profile);
  if (!user) {
    gate.style.display = "block";
    wrap.style.display = "none";
    $("#gateBtn").onclick = () => loginWithGoogle().catch(e => alert(e.message));
    return;
  }
  me = user;
  myProfile = profile;
  gate.style.display = "none";
  wrap.style.display = "grid";
  loadFriendsAndRequests();
});

// ---- search users by email to add as friend ----
searchInput.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  const term = searchInput.value.trim().toLowerCase();
  if (!term) return;
  const snap = await getDocs(collection(db, "users"));
  const matches = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.id !== me.uid && u.email.toLowerCase().includes(term));

  searchResults.innerHTML = matches.map(u => `
    <div class="f-item">
      ${u.name} <span style="color:var(--muted);font-size:11px">(${u.email})</span>
      <button class="btn ghost" data-id="${u.id}" style="float:right;padding:3px 8px;font-size:11px">Add friend</button>
    </div>
  `).join("") || `<div class="empty">No user found</div>`;

  searchResults.querySelectorAll("button").forEach(btn => {
    btn.onclick = async () => {
      await addDoc(collection(db, "friendRequests"), {
        from: me.uid,
        fromName: myProfile.name,
        to: btn.dataset.id,
        status: "pending",
        createdAt: serverTimestamp()
      });
      btn.textContent = "Sent ✓";
      btn.disabled = true;
    };
  });
});

// ---- load incoming requests + accepted friends ----
async function loadFriendsAndRequests() {
  const reqSnap = await getDocs(query(
    collection(db, "friendRequests"),
    where("to", "==", me.uid), where("status", "==", "pending")
  ));
  const requests = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  requestsBox.innerHTML = requests.length ? requests.map(r => `
    <div class="f-item">
      ${r.fromName} wants to connect
      <button class="btn" data-id="${r.id}" data-from="${r.from}" style="float:right;padding:3px 8px;font-size:11px">Accept</button>
    </div>
  `).join("") : "";

  requestsBox.querySelectorAll("button").forEach(btn => {
    btn.onclick = async () => {
      await updateDoc(doc(db, "friendRequests", btn.dataset.id), { status: "accepted" });
      loadFriendsAndRequests();
    };
  });

  const acceptedSnap = await getDocs(query(
    collection(db, "friendRequests"),
    where("status", "==", "accepted")
  ));
  const friendUids = acceptedSnap.docs
    .map(d => d.data())
    .filter(r => r.from === me.uid || r.to === me.uid)
    .map(r => r.from === me.uid ? r.to : r.from);

  if (!friendUids.length) {
    friendList.innerHTML = `<div class="empty">Koi friend nahi hai abhi. Upar search karke add karo.</div>`;
    return;
  }

  const friends = [];
  for (const uid of friendUids) {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) friends.push({ id: uid, ...snap.data() });
  }

  friendList.innerHTML = friends.map(f => `
    <div class="f-item" data-id="${f.id}" data-name="${f.name}">${f.name}</div>
  `).join("");

  friendList.querySelectorAll(".f-item").forEach(item => {
    item.onclick = () => openChat(item.dataset.id, item.dataset.name, item);
  });
}

function chatIdFor(a, b) {
  return [a, b].sort().join("_");
}

let activeChatId = null;
let replyingTo = null; // { id, text, senderId }

const REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🔥"];

function openChat(friendId, friendName, el) {
  activeFriendId = friendId;
  document.querySelectorAll(".friend-list .f-item.active").forEach(e => e.classList.remove("active"));
  el.classList.add("active");
  chatHeader.textContent = friendName;
  chatInput.disabled = false;
  sendBtn.disabled = false;
  cancelReply();

  if (unsubMsgs) unsubMsgs();
  const chatId = chatIdFor(me.uid, friendId);
  activeChatId = chatId;
  const msgsRef = collection(db, "chats", chatId, "messages");
  const q = query(msgsRef, orderBy("createdAt", "asc"));

  unsubMsgs = onSnapshot(q, (snap) => {
    chatMsgs.innerHTML = snap.docs.map(d => renderMessage(d.id, d.data())).join("");
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
    wireMessageActions();
  });
}

function renderMessage(id, m) {
  const mine = m.senderId === me.uid;
  const reactions = m.reactions || {};
  const reactionCounts = {};
  Object.values(reactions).forEach(e => { reactionCounts[e] = (reactionCounts[e] || 0) + 1; });
  const reactionsHtml = Object.keys(reactionCounts).length ? `
    <div class="msg-reactions">
      ${Object.entries(reactionCounts).map(([emoji, count]) =>
        `<span class="reaction-pill ${reactions[me.uid] === emoji ? "mine-reaction" : ""}" data-emoji="${emoji}" data-msg="${id}">${emoji} ${count > 1 ? count : ""}</span>`
      ).join("")}
    </div>` : "";

  const replyHtml = m.replyTo ? `
    <div class="reply-quote">${escapeHtml(m.replyTo.text.slice(0, 80))}</div>` : "";

  return `
    <div class="msg-row ${mine ? "mine-row" : "theirs-row"}" data-msg="${id}" data-text="${escapeAttr(m.text)}" data-sender="${m.senderId}">
      <div class="msg-actions">
        <button class="msg-action-btn" data-action="reply" data-msg="${id}" title="Reply">↩</button>
        <button class="msg-action-btn" data-action="react" data-msg="${id}" title="React">🙂</button>
        <div class="emoji-picker" data-msg="${id}">
          ${REACTION_EMOJIS.map(e => `<span class="emoji-opt" data-emoji="${e}" data-msg="${id}">${e}</span>`).join("")}
        </div>
      </div>
      <div class="msg ${mine ? "mine" : "theirs"}">
        ${replyHtml}
        ${escapeHtml(m.text)}
      </div>
      ${reactionsHtml}
    </div>
  `;
}

function wireMessageActions() {
  chatMsgs.querySelectorAll("[data-action='reply']").forEach(btn => {
    btn.onclick = () => {
      const row = btn.closest(".msg-row");
      startReply(row.dataset.msg, row.dataset.text, row.dataset.sender);
    };
  });

  chatMsgs.querySelectorAll("[data-action='react']").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const picker = chatMsgs.querySelector(`.emoji-picker[data-msg="${btn.dataset.msg}"]`);
      document.querySelectorAll(".emoji-picker.show").forEach(p => { if (p !== picker) p.classList.remove("show"); });
      picker.classList.toggle("show");
    };
  });

  chatMsgs.querySelectorAll(".emoji-opt").forEach(opt => {
    opt.onclick = async (e) => {
      e.stopPropagation();
      await toggleReaction(opt.dataset.msg, opt.dataset.emoji);
      opt.closest(".emoji-picker").classList.remove("show");
    };
  });

  chatMsgs.querySelectorAll(".reaction-pill").forEach(pill => {
    pill.onclick = () => toggleReaction(pill.dataset.msg, pill.dataset.emoji);
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".emoji-picker.show").forEach(p => p.classList.remove("show"));
});

async function toggleReaction(msgId, emoji) {
  if (!activeChatId) return;
  const msgRef = doc(db, "chats", activeChatId, "messages", msgId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return;
  const reactions = snap.data().reactions || {};
  const current = reactions[me.uid];

  if (current === emoji) {
    await updateDoc(msgRef, { [`reactions.${me.uid}`]: deleteField() });
  } else {
    await updateDoc(msgRef, { [`reactions.${me.uid}`]: emoji });
  }
}

function startReply(id, text, senderId) {
  replyingTo = { id, text, senderId };
  replyBar.style.display = "flex";
  replyBarText.textContent = text.slice(0, 100);
  chatInput.focus();
}

function cancelReply() {
  replyingTo = null;
  replyBar.style.display = "none";
  replyBarText.textContent = "";
}

function escapeAttr(str = "") {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

sendBtn.onclick = sendMessage;
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
cancelReplyBtn.onclick = cancelReply;

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !activeFriendId) return;
  const chatId = chatIdFor(me.uid, activeFriendId);
  await setDoc(doc(db, "chats", chatId), { members: [me.uid, activeFriendId] }, { merge: true });

  const payload = {
    text, senderId: me.uid, createdAt: serverTimestamp()
  };
  if (replyingTo) {
    payload.replyTo = { text: replyingTo.text, senderId: replyingTo.senderId };
  }

  await addDoc(collection(db, "chats", chatId, "messages"), payload);
  chatInput.value = "";
  cancelReply();
}

function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}
