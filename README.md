# 🛡️ Fin-Logic: AI-Powered Financial Protection

> **Expose the Fine Print** — An intelligent document analyzer that detects predatory clauses, hidden fees, and dark patterns in financial contracts using AI and OCR.

---

## 🎯 Overview

**Fin-Logic** uses a **dual-layer analysis engine** (regex pattern matching + Groq LLM) to flag risks such as hidden fees, auto-renewal traps, variable interest rates, forced consent, and data-privacy violations — then explains them in plain English, estimates potential loss in ₹, and suggests safer wording.

## ✨ Features

- **Universal parsing**: PDF, image (OCR via Tesseract.js) or pasted text
- **Hybrid risk detection**: regex heuristics + Groq LLM analysis with a validation step
- **Loss estimator** and **safer rewrite** suggestions
- **History vault** via Cloud Firestore, **Google Sign-In** via Firebase Auth
- Glassmorphism, responsive UI

---

## 📁 Project Structure

```
fin-logic/
├── frontend/                  # 🎨 Everything the browser runs
│   ├── index.html             #   Main page
│   ├── style.css              #   Styles
│   ├── script.js              #   UI logic, API calls, rendering
│   ├── firebase-client.js     #   Firebase client (auth + history)
│   └── favicon.png
│
├── backend/                   # ⚙️ Everything that runs on the server
│   ├── server.js              #   Express server & API routes
│   ├── analysis.js            #   OCR / PDF text extraction + fallback rules
│   ├── preprocessing.js       #   Regex clause splitting & flagging
│   ├── groq-service.js        #   Groq AI integration
│   ├── firebase-config.js     #   Firebase Admin SDK
│   └── uploads/               #   Temp uploads (auto-created)
│
├── package.json
├── FIREBASE_SETUP.md
├── .env.example               # Template for your .env
├── .env                       # You create this (git-ignored)
└── serviceAccountKey.json     # You add this (git-ignored)
```

The backend serves the `frontend/` folder as static files, so one `npm start` runs both.

---

## 🚀 Getting Started

**Prerequisites:** Node.js v18+, a Firebase project, and a [Groq API key](https://console.groq.com).

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a `.env` file in the project root** (or `cp .env.example .env`)
   ```env
   GROQ_API_KEY=your_groq_api_key_here

   FIREBASE_API_KEY=your_firebase_api_key
   FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   FIREBASE_APP_ID=your_app_id
   FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

3. **Add the Firebase service account key** as `serviceAccountKey.json` in the project root (see `FIREBASE_SETUP.md`).

4. **Enable Firebase services**: Google sign-in under Authentication, and a Firestore database with rules from `FIREBASE_SETUP.md`.

5. **Run**
   ```bash
   npm start
   ```
   Open <http://localhost:3000>.

---

## 🌐 Deployment

Deploy to any Node.js host (Render, Railway, a VPS, etc.):

- **Build command:** `npm install`
- **Start command:** `npm start`
- **Environment variables:** everything from your `.env`, plus
  `FIREBASE_SERVICE_ACCOUNT=<entire serviceAccountKey.json contents>`
- Add your deployed domain under Firebase Console → Authentication → Settings → Authorized domains.

The server uses the `PORT` environment variable when provided.

---

## ⚠️ Disclaimer

**Educational tool only.** This tool does **not** provide legal, financial, or professional advice. Results are AI-generated estimates and may be inaccurate. Verify important decisions with your bank, a legal advisor, or a certified financial professional.

## 📄 License

MIT License - see [LICENSE](LICENSE).

## 📧 Contact

**Nithin Ramesh**

---

<div align="center"><strong>Built with ❤️ for financial transparency</strong></div>
