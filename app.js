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
const studentScreen = document.getElementById('student-screen');
const teacherScreen = document.getElementById('teacher-screen');
const studentArea = document.getElementById('student-area');
const timerDisplay = document.getElementById('timer-display');

let currentUser = null;
let hasSubmitted = false;
let hasVoted = false;
let timerInterval = null;

// --- 1. ログイン & 初期画面 ---
document.getElementById('btn-google-login').onclick = () => signInWithPopup(auth, provider);
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').classList.add('hidden');
        studentScreen.classList.remove('hidden');
    }
});

// --- 2. 先生モードへの切り替え（3回クリックを確実に） ---
let clickCount = 0;
document.getElementById('teacher-mode-trigger').onclick = () => {
    clickCount++;
    if (clickCount >= 3) {
        studentScreen.classList.add('hidden');
        teacherScreen.classList.remove('hidden');
        body.className = "bg-blue"; // 先生画面は常に青ベース
    }
};

// --- 3. 先生操作：お題(例)を出して開始 ---
const wordList = [
    { name: "コイキング", cat: "ポケモン" }, { name: "ピカチュウ", cat: "ポケモン" },
    { name: "たきのぼり", cat: "わざ" }, { name: "きずぐすり", cat: "どうぐ" },
    { name: "カビゴン", cat: "ポケモン" }, { name: "モンスターボール", cat: "どうぐ" }
];

document.getElementById('btn-draw').onclick = () => {
    const item = wordList[Math.floor(Math.random() * wordList.length)];
    const ansTime = parseInt(document.getElementById('input-ans-time').value) || 60;
    const minLenText = document.getElementById('select-min-len').value;

    set(ref(db, 'gameStatus'), {
        phase: "answering",
        hint1: item.cat,
        hint2: item.name[0] + "（" + getKanaRow(item.name[0]) + "）",
        hint3: minLenText,
        example: item.name,
        endTime: Date.now() + (ansTime * 1000)
    });
    set(ref(db, 'answers'), null); // 全員の回答をリセット
    hasSubmitted = false; hasVoted = false;
};

// --- 4. 先生操作：投票タイム開始 ---
document.getElementById('btn-start-vote').onclick = () => {
    const voteTime = parseInt(document.getElementById('input-vote-time').value) || 60;
    update(ref(db, 'gameStatus'), {
        phase: "voting",
        endTime: Date.now() + (voteTime * 1000)
    });
};

// --- 5. リアルタイム同期 & タイマー ---
onValue(ref(db, 'gameStatus'), (snap) => {
    const data = snap.val();
    if (!data) return;

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const remain = Math.ceil((data.endTime - Date.now()) / 1000);
        if (remain <= 0) {
            timerDisplay.innerText = "終了！";
            clearInterval(timerInterval);
        } else {
            timerDisplay.innerText = `のこり: ${remain}秒`;
        }
    }, 1000);

    // 背景色とUIの更新
    if (teacherScreen.classList.contains('hidden')) {
        updateStudentUI(data);
    } else {
        document.getElementById('teacher-example-area').innerHTML = `<h3>お題の例: ${data.example}</h3>`;
    }
});

function updateStudentUI(data) {
    if (data.phase === "answering") {
        // 回答前は赤、回答後は青
        body.className = hasSubmitted ? "bg-blue" : "bg-red";
        studentArea.innerHTML = hasSubmitted ? `<p>送信しました。みんなを待っています...</p>` : `
            <div class="hint-card">
                <p>①種類: <strong>${data.hint1}</strong></p>
                <p>②最初: <strong>${data.hint2}</strong></p>
                <p>③文字: <strong>${data.hint3}</strong></p>
                <input type="text" id="ans-input" placeholder="答えを入力">
                <button id="ans-send" class="primary-btn" style="width:100%">送信</button>
            </div>`;
        const btn = document.getElementById('ans-send');
        if (btn) btn.onclick = () => {
            const val = document.getElementById('ans-input').value.trim();
            if (val) {
                set(ref(db, 'answers/' + currentUser.uid), { name: currentUser.displayName, text: val, votes: 0 });
                hasSubmitted = true; updateStudentUI(data);
            }
        };
    } else if (data.phase === "voting") {
        // 投票前は黄、投票後は青
        body.className = hasVoted ? "bg-blue" : "bg-yellow";
        studentArea.innerHTML = hasVoted ? `<h3>投票完了！結果を楽しみに待とう</h3><div id="vote-list"></div>` : `<h3>いいな！と思う言葉に投票しよう</h3><div id="vote-list"></div>`;
    }
}

// 回答一覧の表示（先生は名前付き、児童は言葉のみ）
onValue(ref(db, 'answers'), (snap) => {
    const voteList = document.getElementById('vote-list');
    const teacherView = document.getElementById('teacher-view-answers');
    let vHtml = ""; let tHtml = "<h3>みんなの回答一覧</h3>";

    if (snap.exists()) {
        snap.forEach(child => {
            const d = child.val();
            // 児童用（投票ボタン）
            vHtml += `<div class="ans-item"><span>${d.text}</span><button onclick="window.castVote('${child.key}')" class="primary-btn" style="padding:5px 10px;">👍 ${d.votes || 0}</button></div>`;
            // 先生用（名前と内容と得票）
            tHtml += `<div class="ans-item" style="font-size:0.9rem;"><span>${d.name}: ${d.text}</span><span>👍 ${d.votes || 0}</span></div>`;
        });
    }
    if (voteList) voteList.innerHTML = vHtml;
    if (teacherView) teacherView.innerHTML = tHtml;
});

// 投票アクション
window.castVote = (uid) => {
    if (hasVoted) return;
    const vRef = ref(db, `answers/${uid}/votes`);
    onValue(vRef, s => {
        update(ref(db, `answers/${uid}`), { votes: (s.val() || 0) + 1 });
    }, { onlyOnce: true });
    hasVoted = true;
    const currentPhase = document.getElementById('main-body').className; // 状態維持のため
    body.className = "bg-blue";
};

function getKanaRow(c){
    const code = c.charCodeAt(0);
    if(code>=12353&&code<=12362) return "あ行"; if(code>=12363&&code<=12372) return "か行";
    if(code>=12373&&code<=12382) return "さ行"; if(code>=12383&&code<=12392) return "た行";
    if(code>=12393&&code<=12402) return "な行"; if(code>=12403&&code<=12417) return "は行";
    if(code>=12418&&code<=12422) return "ま行"; if(code>=12423&&code<=12427) return "や行";
    if(code>=12428&&code<=12432) return "ら行"; return "わ行";
}
