# CodeDo — Setup Guide (Hinglish)

Ye website 100% free me chalegi: frontend GitHub Pages pe, backend (login + database) Firebase ke free tier pe.

## Files kya kya hain

- `index.html` — home page, sara code browse/search/copy karne ke liye
- `chat.html` — friends add karo, ek-dusre se chat karo
- `admin.html` — sirf tumhare (admin) liye — users suspend/delete, koi bhi code delete
- `css/style.css` — hacker theme (black/green/white)
- `js/firebase-config.js` — apni Firebase keys yaha daalni hai
- `js/auth.js`, `js/app.js`, `js/chat.js`, `js/admin.js` — logic

## Step 1 — Firebase project banao (5 min, free)

1. https://console.firebase.google.com pe jao, "Add project" click karo, naam do (e.g. `codeguru`).
2. Left menu me **Build > Authentication** > "Get started" > **Sign-in method** tab me **Google** enable karo.
3. Left menu me **Build > Firestore Database** > "Create database" > **production mode** select karo, koi bhi region choose karo.
4. Left menu me gear icon (Project settings) > neeche scroll karke "Your apps" > `</>` (web) icon click karo > app register karo. Yaha jo `firebaseConfig` object milega, usko copy karke `js/firebase-config.js` file me paste kar do.
5. Usi file me `ADMIN_EMAIL` ki jagah apna Gmail daal do — jab tum us email se pehli baar sign-in karoge, automatically admin ban jaoge.

## Step 2 — Firestore security rules laga do

Firestore me **Rules** tab me jaake ye paste kar do (taaki koi random user database ko chhed na sake):

```
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

"Publish" dabao.

## Step 3 — GitHub pe daalo aur free me host karo

1. GitHub pe naya repository banao — naam `codeguru` (ya jo chaho).
2. Is poore folder (`index.html`, `chat.html`, `admin.html`, `css/`, `js/`, is README ke alawa) ko us repo me upload kar do.
3. Repo ke **Settings > Pages** me jaake, Source me `main` branch select karo, save karo.
4. Kuch minute me tumhari site `https://your-username.github.io/codeguru/` pe live ho jayegi.

Bas — Gmail se koi bhi sign-in karega, uska account ban jayega, wo code upload/browse/copy kar payega, friends bana ke chat kar payega. Tum apne admin email se login karke `admin.html` pe jaake kisi ko bhi suspend/delete kar sakte ho, aur koi bhi code hata sakte ho.

## Aage kya improve kar sakte ho

- Har snippet page ke liye syntax highlighting (e.g. `highlight.js` CDN se add kar sakte ho)
- Snippet par likes/comments
- User apna profile edit kar sake (bio, photo)
