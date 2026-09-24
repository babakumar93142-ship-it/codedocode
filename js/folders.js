// ===== CodeDo — folder system =====
// Works like a computer's folders: nested folders, code snippets stored
// inside them, move/copy/cut, share-code access, private/public per folder.
import { db } from "./auth.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function randomCode(len = 8) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function createFolder(ownerId, parentId, name, visibility) {
  const ref = await addDoc(collection(db, "folders"), {
    ownerId, parentId: parentId || null, name,
    visibility: visibility || "private",
    shareCode: randomCode(),
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function renameFolder(id, name) {
  await updateDoc(doc(db, "folders", id), { name });
}

export async function setFolderVisibility(id, visibility) {
  await updateDoc(doc(db, "folders", id), { visibility });
}

export async function moveFolder(id, newParentId) {
  await updateDoc(doc(db, "folders", id), { parentId: newParentId || null });
}

export async function getFolder(id) {
  const snap = await getDoc(doc(db, "folders", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllFolders(ownerId) {
  const snap = await getDocs(query(collection(db, "folders"), where("ownerId", "==", ownerId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getFolderByShareCode(code) {
  const snap = await getDocs(query(collection(db, "folders"), where("shareCode", "==", code)));
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function deleteFolderRecursive(id, ownerId) {
  const all = await getAllFolders(ownerId);
  const children = all.filter(f => f.parentId === id);
  for (const c of children) await deleteFolderRecursive(c.id, ownerId);

  const snippetsSnap = await getDocs(query(collection(db, "snippets"), where("folderId", "==", id)));
  for (const d of snippetsSnap.docs) await deleteDoc(doc(db, "snippets", d.id));

  await deleteDoc(doc(db, "folders", id));
}

export async function moveSnippetToFolder(snippetId, folderId) {
  await updateDoc(doc(db, "snippets", snippetId), { folderId: folderId || null });
}

export async function deleteSnippet(snippetId) {
  await deleteDoc(doc(db, "snippets", snippetId));
}

export async function duplicateSnippet(snippet, folderId) {
  const { id, ...data } = snippet;
  const ref = await addDoc(collection(db, "snippets"), {
    ...data, folderId: folderId || null, createdAt: serverTimestamp()
  });
  return ref.id;
}

// "Upload na karke direct folder me store karna" — adds a fresh snippet
// straight into a folder, no separate upload step.
export async function addSnippetToFolder(authorId, authorName, folderId, { title, language, description, code }) {
  const ref = await addDoc(collection(db, "snippets"), {
    title, language, description, code,
    authorId, authorName, folderId: folderId || null,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

// Walks parentId chain to build "Root / A / B" style breadcrumb.
export async function getFolderPath(folderId) {
  const path = [];
  let current = folderId;
  while (current) {
    const f = await getFolder(current);
    if (!f) break;
    path.unshift(f);
    current = f.parentId;
  }
  return path;
}
