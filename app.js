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

// DOM要素
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

// --- 先生モード切り替え ---
let clickCount = 0;
document.getElementById('teacher-trigger').onclick = () => {
    clickCount++;
    if (clickCount >= 3) {
        studentScreen.classList.add('hidden');
        teacherScreen.classList.remove('hidden');
        body.className = "bg-wait";
    }
};

// --- ログイン ---
document.getElementById('btn-google-login').onclick = () => signInWithPopup(auth, provider);
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        if (teacherScreen.classList.contains('hidden')) studentScreen.classList.remove('hidden');
    }
});

// --- 先生操作 ---
const words = [{n:"コイキング",c:"ポケモン"},{n:"ピカチュウ",c:"ポケモン"},{n:"きずぐすり",c:"どうぐ"},{n:"たきのぼり",c:"わざ"}];

document.getElementById('btn-draw').onclick = () => {
    const item = words[Math.floor(Math.random() * words.length)];
    const time = parseInt(document.getElementById('input-ans-time').value) || 60;
    set(ref(db, 'gameStatus'), {
        phase: "answering",
        hint1: item.c, hint2: item.n[0], hint3: document.getElementById('select-min-len').value,
        example: item.n, endTime: Date.now() + (time * 1000)
    });
    set(ref(db, 'answers'), null);
    hasSubmitted = false; hasVoted = false;
};

document.getElementById('btn-start-vote').onclick = () => {
    const time = parseInt(document.getElementById('input-vote-time').value) || 60;
    update(ref(db, 'gameStatus'), { phase: "voting", endTime: Date.now() + (time * 1000) });
};

// --- 同期メイン処理 ---
onValue(ref(db, 'gameStatus'), (snap) => {
    const data = snap.val();
    if (!data) return;

    // タイマー
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const remain = Math.ceil((data.endTime - Date.now()) / 1000);
        timerDisplay.innerText = remain > 0 ? `のこり ${remain}秒` : "終了！";
    }, 1000);

    // 画面更新
    if (!teacherScreen.classList.contains('hidden')) {
        document.getElementById('teacher-example').innerText = `現在のお題に当てはまる言葉の例: ${data.example}`;
    } else {
        updateStudentUI(data);
    }
});

function updateStudentUI(data) {
    if (data.phase === "answering") {
        body.className = hasSubmitted ? "bg-blue" : "bg-red";
        studentArea.innerHTML = hasSubmitted ? `<p>送信しました。みんなの回答を待っています...</p>` : `
            <div class="hint-card">
                <p>①種類: <b>${data.hint1}</b></p><p>②最初: <b>${data.hint2}</b></p><p>③制限: <b>${data.hint3}</b></p>
                <input type="text" id="ans-input" placeholder="回答を入力" style="width:80%; padding:10px;">
                <button id="ans-send" class="primary-btn" style="width:100%">送信</button>
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
        body.className = hasVoted ? "bg-blue" : "bg-yellow";
        studentArea.innerHTML = hasVoted ? `<h3>投票完了！結果を待とう</h3><div id="vote-list"></div>` : `<h3>いいと思う言葉に投票！</h3><div id="vote-list"></div>`;
    }
}

// 回答リストの同期
onValue(ref(db, 'answers'), (snap) => {
    const vList = document.getElementById('vote-list');
    const tView = document.getElementById('teacher-view-answers');
    let vHtml = ""; let tHtml = "<h3 style='color:white'>児童の回答一覧</h3>";

    if (snap.exists()) {
        snap.forEach(child => {
            const d = child.val();
            vHtml += `<div class="ans-item"><span>${d.text}</span><button onclick="window.castVote('${child.key}')" class="primary-btn" style="padding:5px 10px;">👍 ${d.votes||0}</button></div>`;
            tHtml += `<div class="ans-item"><span><b>${d.name}</b>: ${d.text}</span><span>👍 ${d.votes||0}</span></div>`;
        });
    }
    if (vList && !hasVoted) vList.innerHTML = vHtml;
    if (tView) tView.innerHTML = tHtml;
});

window.castVote = (uid) => {
    if (hasVoted) return;
    const vRef = ref(db, `answers/${uid}/votes`);
    onValue(vRef, s => { update(ref(db, `answers/${uid}`), { votes: (s.val() || 0) + 1 }); }, { onlyOnce: true });
    hasVoted = true;
    body.className = "bg-blue";
    studentArea.innerHTML = "<h3>投票ありがとうございます！</h3>";
};
