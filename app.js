import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5IykzdYCrQOxwLJNG4UdobcAw8NFp9NI",
  authDomain: "goiking.firebaseapp.com",
  databaseURL: "https://goiking-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "goiking",
  storageBucket: "goiking.firebasestorage.app",
  messagingSenderId: "932749736562",
  appId: "1:932749736562:web:383bd467bcd1a20955a0eb"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const body = document.getElementById('main-body');
const loginScreen = document.getElementById('login-screen');
const studentScreen = document.getElementById('student-screen');
const teacherScreen = document.getElementById('teacher-screen');
const studentArea = document.getElementById('student-area');
const timerDisplay = document.getElementById('timer-display');

let currentUser = null;
let hasSubmitted = false;
let hasVoted = false;
let timerInterval = null;

// --- 先生モード切り替え（ログイン前でも後でも動くように最初に設定） ---
let clickCount = 0;
document.getElementById('teacher-mode-trigger').onclick = () => {
    clickCount++;
    if (clickCount >= 3) {
        loginScreen.classList.add('hidden');
        studentScreen.classList.add('hidden');
        teacherScreen.classList.remove('hidden');
        body.className = "bg-blue";
        alert("先生モードに切り替わりました");
    }
};

// --- ログイン処理 ---
document.getElementById('btn-google-login').onclick = () => signInWithPopup(auth, provider);
document.getElementById('btn-logout').onclick = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        if (clickCount < 3) studentScreen.classList.remove('hidden');
        body.className = "bg-blue"; // ログイン直後は青
    } else {
        loginScreen.classList.remove('hidden');
        studentScreen.classList.add('hidden');
    }
});

// --- 先生：お題出し ---
const wordList = [{name:"コイキング",cat:"ポケモン"},{name:"ギャラドス",cat:"ポケモン"},{name:"たきのぼり",cat:"わざ"}];
document.getElementById('btn-draw').onclick = () => {
    const item = wordList[Math.floor(Math.random() * wordList.length)];
    const time = parseInt(document.getElementById('input-ans-time').value) || 60;
    set(ref(db, 'gameStatus'), {
        phase: "answering",
        hint1: item.cat, hint2: item.name[0], hint3: document.getElementById('select-min-len').value,
        example: item.name, endTime: Date.now() + (time * 1000)
    });
    set(ref(db, 'answers'), null);
    hasSubmitted = false; hasVoted = false;
};

// --- 先生：投票開始 ---
document.getElementById('btn-start-vote').onclick = () => {
    const time = parseInt(document.getElementById('input-vote-time').value) || 60;
    update(ref(db, 'gameStatus'), { phase: "voting", endTime: Date.now() + (time * 1000) });
};

// --- リアルタイム同期 ---
onValue(ref(db, 'gameStatus'), (snap) => {
    const data = snap.val();
    if (!data) return;

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const remain = Math.ceil((data.endTime - Date.now()) / 1000);
        timerDisplay.innerText = remain > 0 ? `のこり: ${remain}秒` : "終了！";
    }, 1000);

    if (teacherScreen.classList.contains('hidden')) {
        updateStudentUI(data);
    } else {
        document.getElementById('teacher-example-area').innerHTML = `<h3>お題の例: ${data.example}</h3>`;
    }
});

function updateStudentUI(data) {
    if (data.phase === "answering") {
        body.className = hasSubmitted ? "bg-blue" : "bg-red";
        if (!hasSubmitted) {
            studentArea.innerHTML = `
                <div class="hint-card">
                    <p>①種類: ${data.hint1}</p><p>②最初: ${data.hint2}</p><p>③文字: ${data.hint3}</p>
                    <input type="text" id="ans-input" placeholder="答えを入力">
                    <button id="ans-send" class="primary-btn" style="width:100%">送信</button>
                </div>`;
            document.getElementById('ans-send').onclick = () => {
                const val = document.getElementById('ans-input').value.trim();
                if (val) {
                    set(ref(db, 'answers/' + currentUser.uid), { name: currentUser.displayName, text: val, votes: 0 });
                    hasSubmitted = true; body.className = "bg-blue";
                    studentArea.innerHTML = "<p>送信しました。待機中...</p>";
                }
            };
        }
    } else if (data.phase === "voting") {
        body.className = hasVoted ? "bg-blue" : "bg-yellow";
        if (!hasVoted) studentArea.innerHTML = `<h3>投票しよう！</h3><div id="vote-list"></div>`;
    }
}

// 回答の表示
onValue(ref(db, 'answers'), (snap) => {
    const voteList = document.getElementById('vote-list');
    const teacherView = document.getElementById('teacher-view-answers');
    let vHtml = ""; let tHtml = "<h3>回答一覧</h3>";
    snap.forEach(child => {
        const d = child.val();
        vHtml += `<div class="ans-item"><span>${d.text}</span><button onclick="window.castVote('${child.key}')" class="primary-btn">👍 ${d.votes||0}</button></div>`;
        tHtml += `<div class="ans-item">${d.name}: ${d.text} (👍 ${d.votes||0})</div>`;
    });
    if (voteList && !hasVoted) voteList.innerHTML = vHtml;
    if (teacherView) teacherView.innerHTML = tHtml;
});

window.castVote = (uid) => {
    if (hasVoted) return;
    const vRef = ref(db, `answers/${uid}/votes`);
    onValue(vRef, s => { update(ref(db, `answers/${uid}`), { votes: (s.val() || 0) + 1 }); }, { onlyOnce: true });
    hasVoted = true; body.className = "bg-blue";
    studentArea.innerHTML = "<h3>投票ありがとうございます！</h3>";
};
