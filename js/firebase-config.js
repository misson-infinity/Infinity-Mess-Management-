// js/firebase-config.js
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCvars41WY81WmVy1Tueo_rrSO90aIv_Gw",
  authDomain: "try-382fa.firebaseapp.com",
  projectId: "try-382fa",
  storageBucket: "try-382fa.firebasestorage.app",
  messagingSenderId: "952752280975",
  appId: "1:952752280975:web:9025fc4a4efe34f78be7fa",
  measurementId: "G-73PLMXERXX"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();