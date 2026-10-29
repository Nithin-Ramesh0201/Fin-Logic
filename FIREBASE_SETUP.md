# Firebase Setup Instructions

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" or select existing project
3. Follow the setup wizard

## Step 2: Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Google** provider
3. Add your domain to authorized domains (for local: `localhost`)

## Step 3: Enable Firestore Database

1. Go to **Firestore Database**
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location

## Step 4: Get Backend Credentials

1. Go to **Project Settings** → **Service Accounts**
2. Click "Generate new private key"
3. Save the JSON file as `serviceAccountKey.json` in the project root (next to `package.json`)
4. `backend/firebase-config.js` picks the key up automatically from the project root

## Step 5: Get Frontend Credentials

1. Go to **Project Settings** → **General**
2. Scroll to "Your apps" → Click Web icon (</>) to add web app
3. Register app with nickname "Fin-Logic Web"
4. Copy the `firebaseConfig` object
5. Update `.env` with your Firebase web config values (the frontend fetches them from `/api/firebase-config`)

## Step 6: Test the Integration

1. Restart the server: `node server.js`
2. Open `http://localhost:3000`
3. Click "Sign in with Google"
4. Analyze a document
5. Check "History" to see saved reports

## Firestore Security Rules (Production)

Replace test mode rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/reports/{reportId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Troubleshooting

- **"Firebase not configured"**: Check your `.env` values and `serviceAccountKey.json`
- **"Permission denied"**: Ensure Firestore rules allow your user
- **"Auth domain not authorized"**: Add your domain in Firebase Console → Authentication → Settings
