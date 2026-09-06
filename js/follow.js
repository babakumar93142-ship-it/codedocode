// ===== CodeDo — follow system =====
// Naming (as requested): followers = "Synced", following = "Locals",
// follow-back button = "Loop In".
import { db } from "./auth.js";
import {
  collection, doc, setDoc, deleteDoc, getDoc, getDocs, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function followDocId(followerId, followingId) {
  return `${followerId}_${followingId}`;
}

export async function isFollowing(followerId, followingId) {
  const snap = await getDoc(doc(db, "follows", followDocId(followerId, followingId)));
  return snap.exists();
}

export async function follow(followerId, followingId) {
  await setDoc(doc(db, "follows", followDocId(followerId, followingId)), {
    followerId, followingId, createdAt: serverTimestamp()
  });
}

export async function unfollow(followerId, followingId) {
  await deleteDoc(doc(db, "follows", followDocId(followerId, followingId)));
}

// "Synced" — people who follow this user
export async function getFollowersCount(uid) {
  const snap = await getDocs(query(collection(db, "follows"), where("followingId", "==", uid)));
  return snap.size;
}

// "Locals" — people this user follows
export async function getFollowingCount(uid) {
  const snap = await getDocs(query(collection(db, "follows"), where("followerId", "==", uid)));
  return snap.size;
}

// Returns the right button state/label for viewing someone else's profile.
// { label, action: "follow" | "unfollow" }
export async function getFollowButtonState(myUid, otherUid) {
  const [iFollowThem, theyFollowMe] = await Promise.all([
    isFollowing(myUid, otherUid),
    isFollowing(otherUid, myUid)
  ]);

  if (iFollowThem) return { label: "Following", action: "unfollow" };
  if (theyFollowMe) return { label: "Loop In", action: "follow" };
  return { label: "Follow", action: "follow" };
}
