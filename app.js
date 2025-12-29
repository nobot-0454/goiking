import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = { /* あなたのConfig */ };
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const teacherScreen = document.getElementById('teacher-screen');

document.getElementById('btn-google-login').onclick = () => signInWithPopup(auth, provider);

onAuthStateChanged(auth, user => {
    if (user) {
        loginScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
    }
});

let clickCount = 0;
document.getElementById('teacher-trigger').onclick = () => {
    clickCount++;
    if (clickCount >= 3) {
        mainScreen.classList.add('hidden');
        teacherScreen.classList.remove('hidden');
    }
};

document.getElementById('btn-draw').onclick = () => {
    set(ref(db, 'gameStatus'), { state: "playing", example: "コイキング", timestamp: Date.now() });
    set(ref(db, 'answers'), null);
};

onValue(ref(db, 'gameStatus'), snap => {
    const data = snap.val();
    if(data) document.getElementById('game-area').innerHTML = `<div class="hint-card">お題が出ました！</div>`;
});
