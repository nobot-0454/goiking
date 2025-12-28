// --- 1. 設定（Firebase） ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5IykzdYCrQOxwLJNG4UdobcAw8NFp9NI",
  authDomain: "goiking.firebaseapp.com",
  databaseURL: "https://goiking-default-rtdb.asia-southeast1.firebasedatabase.app/", // カンマOK
  projectId: "goiking", // カンマOK
  storageBucket: "goiking.firebasestorage.app", // カンマOK
  messagingSenderId: "932749736562", // カンマOK
  appId: "1:932749736562:web:383bd467bcd1a20955a0eb"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const loginScreen = document.getElementById('login-screen');
const waitScreen = document.getElementById('wait-screen');
const teacherScreen = document.getElementById('teacher-screen');
const btnGoogleLogin = document.getElementById('btn-google-login');
const btnDraw = document.getElementById('btn-draw');

let currentUser = null;

// --- 2. ログイン処理 ---
btnGoogleLogin.onclick = async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        alert("ログイン失敗: " + error.message);
    }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        waitScreen.classList.remove('hidden');
    }
});

// --- 3. 先生画面への切り替え（3回クリック） ---
let clickCount = 0; // クリックを数える
document.querySelector('.logo').onclick = () => {
    clickCount++;
    if (clickCount >= 3) {
        loginScreen.classList.add('hidden');
        waitScreen.classList.add('hidden');
        teacherScreen.classList.remove('hidden');
        alert("先生モードになりました！");
        clickCount = 0; // リセット
    }
};

// --- 4. カードを引く ---
const wordList = ["コイキング", "ギャラドス", "はねる", "たきのぼり", "おうじゃのしるし"];

btnDraw.onclick = () => {
    const randomIndex = Math.floor(Math.random() * wordList.length);
    const selectedWord = wordList[randomIndex];

    const statusRef = ref(db, 'gameStatus');
    set(statusRef, { 
        state: "answering", 
        word: selectedWord,
        timestamp: Date.now() 
    }).then(() => {
        alert("送信成功！お題は「" + selectedWord + "」です");
    }).catch((err) => {
        alert("エラー: " + err.message);
    });
};

// --- 5. リアルタイム受信 ---
onValue(ref(db, 'gameStatus'), (snapshot) => {
    const data = snapshot.val();
    if (data && data.state === "answering") {
        // 先生画面が出ていない時だけ、児童の画面を更新する
        if (teacherScreen.classList.contains('hidden')) {
            waitScreen.innerHTML = `
                <div style="background: white; color: #ff4444; padding: 20px; border-radius: 20px; border: 5px solid #ffdb00;">
                    <h2 style="font-size: 1.2rem;">お題はこれだ！</h2>
                    <div style="font-size: 3rem; font-weight: bold; margin: 20px 0;">${data.word}</div>
                    <p>${currentUser ? currentUser.displayName : 'あなた'} さん、考えて！</p>
                </div>
            `;
        }
    }
});
