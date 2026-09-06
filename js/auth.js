// ===== CodeDo — Auth =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    const base = (user.email || "user").split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
    const username = `${base}${Math.floor(1000 + Math.random() * 9000)}`;

    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName || "User",
      username,
      email: user.email,
      photo: user.photoURL || "",
      role: user.email === ADMIN_EMAIL ? "admin" : "user",
      banned: false,
      createdAt: serverTimestamp()
    });
  }
  return user;
}

export function logout() {
  return signOut(auth);
}

// Ek chhota helper — current logged-in user ka firestore profile deta hai
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// Har page pe call karo taaki login state pata chale, aur banned
// user ko turant logout kar diya jaaye.
export function watchAuth(onUser) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return onUser(null, null);
    const profile = await getUserProfile(user.uid);
    if (profile && profile.banned) {
      alert("Aapka account suspend kar diya gaya hai.");
      await logout();
      return onUser(null, null);
    }
    onUser(user, profile);
  });
}

// Har page ka navbar-right settings icon (profile/admin/logout/naam) is
// se banta hai, taaki sab jagah same dikhe aur ek jagah update ho sake.
export function renderNavUser(container, user, profile) {
  if (!user) { container.innerHTML = ""; container.style.display = "none"; return; }
  container.style.display = "flex";
  container.innerHTML = `
    <div class="settings-wrap">
      <button class="icon-btn" id="navSettingsBtn" title="Settings" aria-label="Settings" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
      <div class="settings-menu" id="navSettingsMenu">
        <div class="settings-user">
          <img src="${profile?.photo || ''}" class="settings-avatar">
          <span>${profile?.name || user.email}</span>
        </div>
        <a href="profile.html">My profile</a>
        ${profile?.role === "admin" ? '<a href="admin.html">Admin</a>' : ""}
        <button type="button" class="logout-item" id="navLogoutBtn">Logout</button>
      </div>
    </div>
  `;

  const btn = container.querySelector("#navSettingsBtn");
  const menu = container.querySelector("#navSettingsMenu");
  btn.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll(".settings-menu.show").forEach(m => { if (m !== menu) m.classList.remove("show"); });
    menu.classList.toggle("show");
  };
  document.addEventListener("click", () => menu.classList.remove("show"));
  container.querySelector("#navLogoutBtn").onclick = () => logout();
}
