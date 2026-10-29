// Firebase Client Configuration
// Fetched dynamically to keep keys secure

let auth = null;
let db = null;
let currentUser = null;
let isFirebaseConfigured = false;

// Initialize Firebase
async function initFirebase() {
    try {
        const response = await fetch('/api/firebase-config');
        if (!response.ok) throw new Error('Failed to fetch config');
        
        const firebaseConfig = await response.json();
        
        if (!firebaseConfig.apiKey) {
            console.warn("⚠️ Firebase configuration missing");
            return;
        }

        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();
            isFirebaseConfigured = true;
            
            console.log("✅ Firebase initialized successfully");

            // Auth state observer
            auth.onAuthStateChanged((user) => {
                currentUser = user;
                if (typeof updateAuthUI === 'function') {
                    updateAuthUI(user);
                }
            });
        }
    } catch (error) {
        console.warn("⚠️ Error initializing Firebase:", error);
    }
}

// Start initialization
initFirebase();

// Google Sign In
async function signInWithGoogle() {
  if (!isFirebaseConfigured || !auth) {
    alert("Firebase is initializing or not configured. Please wait a moment.");
    return null;
  }
  
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    return result.user;
  } catch (error) {
    console.error("Sign in error:", error);
    alert("Sign in failed: " + error.message);
    return null;
  }
}

// Sign Out
async function signOut() {
  if (!isFirebaseConfigured || !auth) return;
  
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Sign out error:", error);
  }
}

// Update UI based on auth state
function updateAuthUI(user) {
  const loginBtn = document.getElementById('loginBtn');
  const userProfile = document.querySelector('.user-profile');
  const historyBtn = document.getElementById('historyBtn');
  
  if (user) {
    // User is signed in
    if (loginBtn) loginBtn.style.display = 'none';
    if (userProfile) {
      userProfile.style.display = 'flex';
      userProfile.textContent = user.displayName ? user.displayName.substring(0, 2).toUpperCase() : 'U';
      userProfile.title = user.email;
      userProfile.style.cursor = 'pointer';
      userProfile.onclick = signOut;
    }
    if (historyBtn) historyBtn.disabled = false;
  } else {
    // User is signed out
    if (loginBtn) loginBtn.style.display = 'block';
    if (userProfile) userProfile.style.display = 'none';
    if (historyBtn) historyBtn.disabled = true;
  }
}

// Save report to Firestore
async function saveReport(reportData) {
  if (!isFirebaseConfigured || !currentUser || !db) {
    console.log("Cannot save: Firebase not configured or user not signed in");
    return null;
  }
  
  try {
    const docRef = await db.collection('users').doc(currentUser.uid)
      .collection('reports').add({
        ...reportData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userId: currentUser.uid,
        userEmail: currentUser.email
      });
    
    console.log("Report saved with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error saving report:", error);
    return null;
  }
}

// Fetch user's report history
async function fetchHistory() {
  if (!isFirebaseConfigured || !currentUser || !db) {
    return [];
  }
  
  try {
    const snapshot = await db.collection('users').doc(currentUser.uid)
      .collection('reports')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    
    const reports = [];
    snapshot.forEach(doc => {
      reports.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return reports;
  } catch (error) {
    console.error("Error fetching history:", error);
    return [];
  }
}

// Get specific report by ID
async function getReport(reportId) {
  if (!isFirebaseConfigured || !currentUser || !db) {
    return null;
  }
  
  try {
    const doc = await db.collection('users').doc(currentUser.uid)
      .collection('reports').doc(reportId).get();
    
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching report:", error);
    return null;
  }
}
