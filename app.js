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

// 要素の取得
const body = document.getElementById('main-body');
const loginScreen = document.getElementById('login-screen');
const studentScreen = document.getElementById('student-screen');
const teacherScreen = document.getElementById('teacher-screen');

let currentUser = null;
let hasSubmitted = false;
let hasVoted = false;

// --- 【最重要】先生モード切り替え（JS読み込み直後に実行） ---
let clickCount = 0;
document.getElementById('teacher-trigger').onclick = () => {
    clickCount++;
    if (clickCount >= 3) {
        loginScreen.classList.add('hidden');
        studentScreen.classList.add('hidden');
        teacherScreen.classList.remove('hidden');
        body.className = "bg-wait";
        alert("先生モード起動。お題を出してください。");
    }
};

// --- ログイン処理 ---
document.getElementById('btn-google-login').onclick = () => {
    signInWithPopup(auth, provider).catch(err => alert("ログインエラー: " + err.message));
};

onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        // 先生画面が開いていない時だけ児童画面を出す
        if (teacherScreen.classList.contains('hidden')) {
            studentScreen.classList.remove('hidden');
        }
    }
});

// --- 先生操作 ---
const words = [{n:"コイキング",c:"ポケモン"},{n:"ピカチュウ",c:"ポケモン"},{n:"きずぐすり",c:"どうぐ"},{n:"たきのぼり",c:"わざ"}];

document.getElementById('btn-draw').onclick = () => {
    const item = words[Math.floor(Math.random() * words.length)];
    set(ref(db, 'gameStatus'), {
        phase: "answering",
        hint1: item.c, hint2: item.n[0],
        endTime: Date.now() + (60 * 1000)
    });
    set(ref(db, 'answers'), null);
    hasSubmitted = false; hasVoted = false;
};

document.getElementById('btn-start-vote').onclick = () => {
    update(ref(db, 'gameStatus'), { phase: "voting", endTime: Date.now() + (60 * 1000) });
};

// --- リアルタイム同期 ---
onValue(ref(db, 'gameStatus'), (snap) => {
    const data = snap.val();
    if (!data) return;

    // 児童画面の更新
    if (!studentScreen.classList.contains('hidden')) {
        updateStudentUI(data);
    }
});

function updateStudentUI(data) {
    const area = document.getElementById('student-area');
    if (data.phase === "answering") {
        body.className = hasSubmitted ? "bg-blue" : "bg-red";
        area.innerHTML = hasSubmitted ? `<p>送信済み。待機中...</p>` : `
            <div class="hint-card">
                <p>種類: ${data.hint1} / 最初: ${data.hint2}</p>
                <input type="text" id="ans-input" placeholder="答えを入力" style="width:70%; padding:10px;">
                <button id="ans-send" class="primary-btn">送信</button>
            </div>`;
        if (document.getElementById('ans-send')) {
            document.getElementById('ans-send').onclick = () => {
                const val = document.getElementById('ans-input').value.trim();
                if (val && currentUser) {
                    set(ref(db, 'answers/' + currentUser.uid), { name: currentUser.displayName, text: val, votes: 0 });
                    hasSubmitted = true; updateStudentUI(data);
                }
            };
        }
    } else if (data.phase === "voting") {
        body.className = hasVoted ? "bg-blue" : "bg-yellow";
        area.innerHTML = hasVoted ? `<p>投票完了！</p><div id="vote-list"></div>` : `<h3>投票してください</h3><div id="vote-list"></div>`;
    }
}

// 回答一覧
onValue(ref(db, 'answers'), (snap) => {
    const vList = document.getElementById('vote-list');
    const tView = document.getElementById('teacher-view-answers');
    let vHtml = ""; let tHtml = "<h3 style='color:white'>回答状況</h3>";

    snap.forEach(child => {
        const d = child.val();
        vHtml += `<div class="ans-item"><span>${d.text}</span><button onclick="window.castVote('${child.key}')" class="primary-btn">👍 ${d.votes||0}</button></div>`;
        tHtml += `<div class="ans-item"><span>${d.name}: ${d.text}</span><span>👍 ${d.votes||0}</span></div>`;
    });
    if (vList && !hasVoted) vList.innerHTML = vHtml;
    if (tView) tView.innerHTML = tHtml;
});

window.castVote = (uid) => {
    if (hasVoted) return;
    const vRef = ref(db, `answers/${uid}/votes`);
    onValue(vRef, s => { update(ref(db, `answers/${uid}`), { votes: (s.val() || 0) + 1 }); }, { onlyOnce: true });
    hasVoted = true; body.className = "bg-blue";
};
