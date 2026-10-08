# Security Policy

CodeDo takes the security of its users seriously. This document explains how the platform is protected and how to report a vulnerability responsibly.

## Supported scope

CodeDo is a single, continuously deployed website rather than a versioned library — there is no changelog of "supported versions" to track. Security fixes are applied directly to the `main` branch and go live automatically through GitHub Pages, typically within minutes.

## How access control works

| Layer | Responsibility |
|---|---|
| **Frontend (GitHub Pages)** | Presentation only. It is a static site and is never trusted to enforce permissions — anyone can view its source. |
| **Firebase Authentication** | Verifies identity via Google sign-in. |
| **Firestore Security Rules** | The actual access-control layer. Every read/write to the database is checked server-side against these rules, regardless of what the frontend code does. |

Because of this layering, the Firebase config exposed in `js/firebase-config.js` (API key, project ID, etc.) is **not a secret** — Firebase API keys identify a project rather than authorize access, and they are always visible to anyone who opens the site's source. This is expected and does not put user data at risk. **Actual protection comes entirely from the Firestore Security Rules** published alongside this project (see [README.md](./README.md)).

The `ADMIN_EMAIL` value in `js/firebase-config.js` determines which account is granted the `admin` role on first sign-in. If you deploy your own instance of this project, change it to your own email before going live.

## Reporting a vulnerability

If you discover a security issue — for example, a way to bypass Firestore Rules, read or modify another user's private data, or escalate privileges to admin without authorization:

1. **Do not** open a public GitHub issue describing the exploit.
2. Report it privately via a [GitHub Security Advisory](../../security/advisories/new) on this repository, or by contacting the maintainer directly.
3. Include clear steps to reproduce the issue and its potential impact.

Reports are reviewed promptly, and because the site has no release cycle to wait on, fixes are typically deployed the same day they're confirmed.

## Disclosure

We ask that you give us a reasonable window to investigate and fix a confirmed vulnerability before disclosing it publicly. We're happy to credit reporters who follow this process.
