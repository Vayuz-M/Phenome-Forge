import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getAnalytics }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBn7LOZ9GXT1DeyXEsDpUnIJlBhX97Whiw",
  authDomain:        "phoneme-forge.firebaseapp.com",
  projectId:         "phoneme-forge",
  storageBucket:     "phoneme-forge.firebasestorage.app",
  messagingSenderId: "704766775198",
  appId:             "1:704766775198:web:ded4e595af7ecf7d2f908f",
  measurementId:     "G-LPZ3NDW0J8"
};

const app = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const analytics = getAnalytics(app);