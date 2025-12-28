// --- 1. 設定（Firebase） ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  //const firebaseConfig = {
  apiKey: "AIzaSyB5IykzdYCrQOxwLJNG4UdobcAw8NFp9NI",
  authDomain: "goiking.firebaseapp.com",
  databaseURL: "https://goiking-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "goiking",
  storageBucket: "goiking.firebasestorage.app",
  messagingSenderId: "932749736562",
  appId: "1:932749736562:web:383bd467bcd1a20955a0eb"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// パーツの取得
const loginScreen = document.getElementById('login-screen');
const waitScreen = document.getElementById('wait-screen');
const teacherScreen = document.getElementById('teacher-screen');
const btnGoogleLogin = document.getElementById('btn-google-login');
const btnDraw = document.getElementById('btn-draw');

let currentUser = null;

// --- 2. ログイン処理 ---

// ボタンを押した時
btnGoogleLogin.onclick = async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("ログイン失敗:", error);
        alert("ログインに失敗しました。学校のアカウントか確認してね。");
    }
};

// ログイン状態を見守る（ページを開いた時やログインした時に自動で動く）
onAuthStateChanged(auth, (user) => {
    if (user) {
        // ログイン成功！
        currentUser = user;
        console.log("ログイン中:", user.displayName);
        
        // 画面を切り替える
        loginScreen.classList.add('hidden');
        waitScreen.classList.remove('hidden');
        
        // 待機画面に名前を出す
        waitScreen.innerHTML = `<p style="color:white">${user.displayName} さん、入室しました！<br>先生がはじめるのを待っています...</p>`;
    } else {
        // ログインしていない
        loginScreen.classList.remove('hidden');
        waitScreen.classList.add('hidden');
    }
});

// 隠し機能：ロゴを3回クリックで先生画面
document.querySelector('.logo').onclick = () => {
    loginScreen.classList.add('hidden');
    teacherScreen.classList.remove('hidden');
};

// --- 3. 先生の操作：カードを引く ---
const wordList = ["コイキング", "ギャラドス", "はねる", "たきのぼり", "おうじゃのしるし"];

btnDraw.onclick = () => {
    const randomIndex = Math.floor(Math.random() * wordList.length);
    const selectedWord = wordList[randomIndex];

    const statusRef = ref(db, 'gameStatus');
    set(statusRef, { 
        state: "answering", 
        word: selectedWord,
        timestamp: Date.now() 
    });
};

// --- 4. リアルタイム受信 ---
const statusRef = ref(db, 'gameStatus');
onValue(statusRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.state === "answering") {
        if (teacherScreen.classList.contains('hidden')) {
            waitScreen.innerHTML = `
                <div style="background: white; color: #ff4444; padding: 20px; border-radius: 20px; border: 5px solid #ffdb00;">
                    <h2 style="font-size: 1.2rem;">お題はこれだ！</h2>
                    <div style="font-size: 3rem; font-weight: bold; margin: 20px 0;">${data.word}</div>
                    <p>${currentUser ? currentUser.displayName : 'あなた'} さん、語彙を考えて！</p>
                </div>
            `;
        }
    }
});