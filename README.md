<div align="center">

# CodeDoCode

**Share code. Learn together.**

A lightweight social platform for people learning to code — upload snippets, browse what others are learning, organize your own code into folders, follow other learners, and chat with friends.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Frontend](https://img.shields.io/badge/frontend-GitHub%20Pages-181717?logo=github)
![Backend](https://img.shields.io/badge/backend-Firebase-FFCA28?logo=firebase&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
  - [1. Create a Firebase project](#1-create-a-firebase-project)
  - [2. Apply Firestore security rules](#2-apply-firestore-security-rules)
  - [3. Deploy on GitHub Pages](#3-deploy-on-github-pages)
- [Roadmap](#roadmap)
- [Security](#security)
- [License](#license)

---

## Overview

CodeDo is a static site hosted on **GitHub Pages**, backed entirely by **Firebase** (Authentication + Firestore) — no server to manage, and free to run at small-to-medium scale. Anyone can sign in with Google, upload code with a short description, and browse what the community is sharing.

## Features

| Area | What it does |
|---|---|
| **Snippets** | Upload, browse, search, and filter code by language |
| **Code check** | In-browser syntax check for JavaScript and Python before publishing (via Pyodide) — invalid code is caught before it's shared |
| **Folders** | Organize your own snippets into nested folders, move/copy/cut, set public or private, and share a folder via a share code |
| **Social** | Follow other users ("Synced" = followers, "Locals" = following) |
| **Chat** | Add friends and chat in real time, with replies and emoji reactions |
| **Admin** | Moderate the platform — suspend/delete users, remove any uploaded code |

## Tech stack

- **Frontend:** vanilla HTML / CSS / JavaScript (ES modules), hosted on **GitHub Pages**
- **Backend:** **Firebase Authentication** (Google sign-in) and **Cloud Firestore** (database), secured with Firestore Security Rules
- **In-browser execution:** [Pyodide](https://pyodide.org) for client-side Python checks

## Project structure

```
index.html              Browse, search, and upload snippets
folder.html              Personal folder system
people.html               Search and follow other users
profile.html               User profile and their uploaded code
chat.html                Friends & real-time chat
admin.html                Admin-only moderation panel

css/
  style.css                Theme and styling

js/
  firebase-config.js           Your Firebase project keys (edit this)
  auth.js                 Authentication, session state, nav UI
  app.js                  Snippet browsing / uploading logic
  folder.js, folders.js            Folder system
  follow.js                Follow system
  people.js                People search
  profile.js                Profile page logic
  chat.js                 Friends & chat
  admin.js                 Admin panel logic
  checker.js                In-browser code checker
  codeview.js               Fullscreen code viewer
```

## Getting started

### 1. Create a Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com) and create a new project.
2. **Build → Authentication → Get started → Sign-in method** — enable **Google**.
3. **Build → Firestore Database → Create database** — production mode, any region.
4. **Project settings (gear icon) → Your apps → `</>` (Web)** — register a web app and copy the generated `firebaseConfig` object into `js/firebase-config.js`.
5. In the same file, set `ADMIN_EMAIL` to your own Google account email. Signing in with that email for the first time automatically grants the `admin` role.

### 2. Apply Firestore security rules

In Firestore → **Rules**, paste the following, then click **Publish**:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() { return request.auth != null; }
    function isOwner(uid) { return request.auth.uid == uid; }
    function isAdmin() {
      return isSignedIn() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }

    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && isOwner(userId);
      allow update: if isAdmin() || (isOwner(userId) && !("role" in request.resource.data.diff(resource.data).affectedKeys()) && !("banned" in request.resource.data.diff(resource.data).affectedKeys()));
      allow delete: if isAdmin();
    }

    match /snippets/{id} {
      allow read: if true;
      allow create: if isSignedIn();
      allow update: if isSignedIn() && request.auth.uid == resource.data.authorId;
      allow delete: if isAdmin() || (isSignedIn() && request.auth.uid == resource.data.authorId);
    }

    match /friendRequests/{id} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.auth.uid == request.resource.data.from;
      allow update: if isSignedIn() && request.auth.uid == resource.data.to;
      allow delete: if isAdmin();
    }

    match /follows/{id} {
      allow read: if true;
      allow create: if isSignedIn() && request.auth.uid == request.resource.data.followerId;
      allow delete: if isSignedIn() && request.auth.uid == resource.data.followerId;
    }

    match /chats/{chatId} {
      allow read, write: if isSignedIn() && request.auth.uid in resource.data.members;
      allow create: if isSignedIn();

      match /messages/{msgId} {
        allow read: if isSignedIn();
        allow create: if isSignedIn() && request.auth.uid == request.resource.data.senderId;
        allow update: if isSignedIn();
      }
    }
  }
}
```

### 3. Deploy on GitHub Pages

1. Create a new GitHub repository.
2. Push the full project (`index.html`, `folder.html`, `people.html`, `profile.html`, `chat.html`, `admin.html`, `css/`, `js/`) to the repo.
3. Go to **Settings → Pages**, set the source to your `main` branch, and save.
4. Your site is live at `https://<your-username>.github.io/<your-repo>/` within a few minutes.

Once set up, anyone can sign in with Google — their account is created automatically — and start uploading, browsing, following, and chatting. Signing in with your configured `ADMIN_EMAIL` unlocks `admin.html`.

## Roadmap

- [ ] Syntax highlighting per snippet (e.g. via `highlight.js`)
- [ ] Likes and comments on snippets
- [ ] Richer profile editing (bio, custom photo upload)

## Security

See [SECURITY.md](./SECURITY.md) for how access control works and how to report a vulnerability.

## License

MIT — free to use, modify, and deploy your own instance.
