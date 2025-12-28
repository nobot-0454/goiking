// --- 1. 設定（あなたの情報に書き換えてください） ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbw8aQf96fhgjY8ua3h3zEupxxyuof05uJLoX2FdKIPvMJ_k5z5mTdR5PLcMxM5Jw4sX/exec";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5IykzdYCrQOxwLJNG4UdobcAw8NFp9NI",
  authDomain: "goiking.firebaseapp.com",
  projectId: "goiking",
  storageBucket: "goiking.firebasestorage.app",
  messagingSenderId: "932749736562",
  appId: "1:932749736562:web:383bd467bcd1a20955a0eb"
};

// --- 2. 起動準備 ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const nameSelect = document.getElementById('name-select');
const loginScreen = document.getElementById('login-screen');
const waitScreen = document.getElementById('wait-screen');
const teacherScreen = document.getElementById('teacher-screen');
const btnLogin = document.getElementById('btn-login');
const btnDraw = document.getElementById('btn-draw');

// --- 3. 名簿読み込み ---
async function loadMember() {
  const response = await fetch(GAS_URL);
  const students = await response.json();
  nameSelect.innerHTML = '<option value="">なまえを えらんでね</option>';
  students.forEach(s => {
    const name = s.なまえ || s.名前;
    if(name) {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      nameSelect.appendChild(opt);
    }
  });
}

// --- 4. ログインと画面切り替え ---
btnLogin.onclick = () => {
  if (!nameSelect.value) return alert("なまえを選んでね");
  loginScreen.classList.add('hidden');
  waitScreen.classList.remove('hidden');
};

// 隠し機能：ロゴを3回クリックすると先生画面へ（開発用）
document.querySelector('.logo').onclick = () => {
  loginScreen.classList.add('hidden');
  teacherScreen.classList.remove('hidden');
};

// --- 5. Firebaseの魔法（ここが重要！） ---

// A: 先生がボタンを押した時の動き
btnDraw.onclick = () => {
  const statusRef = ref(db, 'gameStatus');
  set(statusRef, { 
    state: "answering", 
    timestamp: Date.now() 
  });
  alert("全員の画面を切り替えました！");
};

// B: 全員の画面が自動で変わる仕組み（見守り役）
const statusRef = ref(db, 'gameStatus');
onValue(statusRef, (snapshot) => {
  const data = snapshot.val();
  if (data && data.state === "answering") {
    // 待機画面を隠して、何かメッセージを出す（今はアラートだけ）
    if (!teacherScreen.classList.contains('hidden')) return; // 先生はそのまま
    waitScreen.innerHTML = "<h2 style='color:yellow'>カードが引かれました！回答してください！</h2>";
  }
});

loadMember();