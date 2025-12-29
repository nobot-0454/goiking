import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

// ログイン
document.getElementById('btn-google-login').onclick = () => signInWithPopup(auth, provider);
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        studentScreen.classList.remove('hidden');
    }
});

// 先生モード切替（ロゴを3回クリック）
let clicks = 0;
document.querySelector('.logo-trigger').onclick = () => {
    clicks++;
    if (clicks >= 3) {
        studentScreen.classList.add('hidden');
        teacherScreen.classList.remove('hidden');
        alert("先生モード起動！");
    }
};

// 先生操作：お題
const wordList = [{name:"コイキング",cat:"ポケモン"},{name:"ギャラドス",cat:"ポケモン"},{name:"たきのぼり",cat:"わざ"}];
document.getElementById('btn-draw').onclick = () => {
    const item = wordList[Math.floor(Math.random() * wordList.length)];
    const time = parseInt(document.getElementById('input-ans-time').value) || 60;
    set(ref(db, 'gameStatus'), {
        phase: "answering",
        hint1: item.cat, hint2: item.name[0], hint3: (item.name.length - 1) + "文字以上",
        example: item.name, endTime: Date.now() + (time * 1000)
    });
    set(ref(db, 'answers'), null);
    hasSubmitted = false; hasVoted = false;
};

// 先生操作：投票
document.getElementById('btn-start-vote').onclick = () => {
    const time = parseInt(document.getElementById('input-vote-time').value) || 60;
    update(ref(db, 'gameStatus'), { phase: "voting", endTime: Date.now() + (time * 1000) });
};

// リアルタイム同期
onValue(ref(db, 'gameStatus'), (snap) => {
    const data = snap.val();
    if (!data) return; // データがない時は何もしない（待機表示のまま）

    // タイマー
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const remain = Math.ceil((data.endTime - Date.now()) / 1000);
        timerDisplay.innerText = remain > 0 ? `残り時間: ${remain}秒` : "終了！";
    }, 1000);

    // 先生・児童それぞれの表示更新
    if (!teacherScreen.classList.contains('hidden')) {
        document.getElementById('teacher-info').innerText = `例: ${data.example}`;
    } else {
        updateStudentUI(data);
    }
});

function updateStudentUI(data) {
    if (data.phase === "answering") {
        body.className = hasSubmitted ? "bg-finished" : "bg-answering";
        studentArea.innerHTML = hasSubmitted ? `<p>送信完了！待機中...</p>` : `
            <div class="hint-card">
                <p>①種類: ${data.hint1}</p><p>②最初: ${data.hint2}</p><p>③文字: ${data.hint3}</p>
                <input type="text" id="ans-input" placeholder="答えを入力">
                <button id="ans-send" class="primary-btn">送信</button>
            </div>`;
        if (document.getElementById('ans-send')) {
            document.getElementById('ans-send').onclick = () => {
                const val = document.getElementById('ans-input').value.trim();
                if (val) {
                    set(ref(db, 'answers/' + currentUser.uid), { name: currentUser.displayName, text: val, votes: 0 });
                    hasSubmitted = true; updateStudentUI(data);
                }
            };
        }
    } else if (data.phase === "voting") {
        body.className = hasVoted ? "bg-finished" : "bg-voting";
        studentArea.innerHTML = hasVoted ? `<p>投票完了！</p>` : `<h3>いいと思う言葉に投票！</h3><div id="vote-list"></div>`;
    }
}

// 回答表示
onValue(ref(db, 'answers'), (snap) => {
    const voteList = document.getElementById('vote-list');
    const teacherList = document.getElementById('teacher-view-answers');
    let vHtml = ""; let tHtml = "";
    snap.forEach(child => {
        const d = child.val();
        vHtml += `<div class="ans-item"><span>${d.text}</span><button onclick="window.castVote('${child.key}')" class="primary-btn">👍 ${d.votes||0}</button></div>`;
        tHtml += `<div class="ans-item">${d.name}: ${d.text} (👍 ${d.votes||0})</div>`;
    });
    if (voteList) voteList.innerHTML = vHtml;
    if (teacherList) teacherList.innerHTML = tHtml;
});

window.castVote = (uid) => {
    if (hasVoted) return;
    const vRef = ref(db, `answers/${uid}/votes`);
    onValue(vRef, s => { update(ref(db, `answers/${uid}`), { votes: (s.val() || 0) + 1 }); }, { onlyOnce: true });
    hasVoted = true; body.className = "bg-finished";
    studentArea.innerHTML = `<p>投票完了！</p>`;
};
