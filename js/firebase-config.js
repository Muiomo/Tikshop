// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Configuração do SEU Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCOfjQ12u66v7ZzNAx4uqdooLP6QFjUsG4",
  authDomain: "tikshop-576f7.firebaseapp.com",
  projectId: "tikshop-576f7",
  storageBucket: "tikshop-576f7.firebasestorage.app",
  messagingSenderId: "286753187219",
  appId: "1:286753187219:web:ffe8bef4663b8a7a6af466",
  measurementId: "G-DTLTQKRRYY",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// Export para usar em outros arquivos
export { app, db, storage, auth, analytics };
