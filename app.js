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
const studentArea = document.getElementById('student-area');
const timerDisplay = document.getElementById('timer-display');
const teacherInfo = document.getElementById('teacher-info');

let currentUser = null;
let hasSubmitted = false;
let hasVoted = false;
let timerInterval = null;

// --- ログイン設定 ---
document.getElementById('btn-google-login').onclick = () => signInWithPopup(auth, provider);
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('wait-screen').classList.remove('hidden');
        body.className = "bg-default";
    }
});

// 先生画面切替（ロゴを3回クリック）
let clickCount = 0;
document.querySelector('.logo-trigger').onclick = () => {
    clickCount++;
    if(clickCount >= 3) {
        document.getElementById('teacher-screen').classList.remove('hidden');
        document.getElementById('wait-screen').classList.add('hidden');
    }
};

// --- 先生の操作：お題（例）を出す ---
const wordList = [
    { name: "コイキング", cat: "ポケモン" }, { name: "ピカチュウ", cat: "ポケモン" },
    { name: "たきのぼり", cat: "わざ" }, { name: "きずぐすり", cat: "どうぐ" }
];

document.getElementById('btn-draw').onclick = () => {
    const item = wordList[Math.floor(Math.random() * wordList.length)];
    const duration = parseInt(document.getElementById('input-ans-time').value);
    
    // 文字数制限を「X文字以上」にランダム設定（例の文字数-1など）
    const minLength = Math.max(2, item.name.length - Math.floor(Math.random() * 2));

    set(ref(db, 'gameStatus'), {
        phase: "answering",
        hint1: item.cat,
        hint2: getKanaRow(item.name[0]),
        hint3: `${minLength}文字以上`,
        example: item.name,
        endTime: Date.now() + (duration * 1000)
    });
    set(ref(db, 'answers'), null);
    hasSubmitted = false;
    hasVoted = false;
};

// --- 先生の操作：投票開始 ---
document.getElementById('btn-start-vote').onclick = () => {
    const duration = parseInt(document.getElementById('input-vote-time').value);
    update(ref(db, 'gameStatus'), {
        phase: "voting",
        endTime: Date.now() + (duration * 1000)
    });
};

// --- リアルタイム同期（カウントダウンと画面更新） ---
onValue(ref(db, 'gameStatus'), (snap) => {
    const data = snap.val();
    if (!data) return;

    // タイマー処理
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const remaining = Math.ceil((data.endTime - Date.now()) / 1000);
        if (remaining <= 0) {
            timerDisplay.innerText = "終了！";
            clearInterval(timerInterval);
        } else {
            timerDisplay.innerText = `残り時間: ${remaining}秒`;
        }
    }, 1000);

    // 先生画面の「例」表示
    if (!document.getElementById('teacher-screen').classList.contains('hidden')) {
        teacherInfo.innerText = `お題の例: ${data.example || '---'}`;
    }

    // 児童画面の描画
    updateStudentUI(data);
});

function updateStudentUI(data) {
    if (!document.getElementById('teacher-screen').classList.contains('hidden')) return;

    if (data.phase === "answering") {
        body.className = hasSubmitted ? "bg-bg-voted-or-sent" : "bg-answering";
        studentArea.innerHTML = `
            <div class="hint-card">
                <p>①種類：<strong>${data.hint1}</strong></p>
                <p>②最初の音：<strong>${data.hint2}</strong></p>
                <p>③文字数：<strong>${data.hint3}</strong></p>
                ${hasSubmitted ? '<p>送信完了！みんなの回答を待っています...</p>' : 
                '<input type="text" id="ans-input" placeholder="言葉を入力"><button id="ans-send" class="primary-btn">送信</button>'}
            </div>
        `;
        if (document.getElementById('ans-send')) {
            document.getElementById('ans-send').onclick = () => {
                const val = document.getElementById('ans-input').value.trim();
                if (val) {
                    set(ref(db, 'answers/' + currentUser.uid), { name: currentUser.displayName, text: val, votes: 0 });
                    hasSubmitted = true;
                }
            };
        }
    } else if (data.phase === "voting") {
        body.className = hasVoted ? "bg-bg-voted-or-sent" : "bg-voting";
        studentArea.innerHTML = `<h3>いいな！と思う言葉に投票しよう</h3><div id="vote-list"></div>`;
    }
}

// 回答一覧の同期（先生・児童共通）
onValue(ref(db, 'answers'), (snap) => {
    const teacherList = document.getElementById('teacher-view-answers');
    const voteList = document.getElementById('vote-list');
    let html = "";
    
    if (snap.exists()) {
        snap.forEach(child => {
            const d = child.val();
            html += `<div class="ans-item">
                <span>${d.text}</span>
                <button class="primary-btn" onclick="window.castVote('${child.key}')" style="padding:5px 10px;">👍 ${d.votes || 0}</button>
            </div>`;
        });
    }

    if (voteList) voteList.innerHTML = html;
    if (teacherList) {
        let tHtml = "<h3>児童の回答一覧</h3>";
        snap.forEach(child => {
            const d = child.val();
            tHtml += `<div class="ans-item"><strong>${d.name}</strong>: ${d.text} (👍 ${d.votes || 0})</div>`;
        });
        teacherList.innerHTML = tHtml;
    }
});

// 投票アクション
window.castVote = (uid) => {
    if (hasVoted) return alert("投票は1回までです");
    update(ref(db, `answers/${uid}`), { votes: (Date.now()) }); // 簡易的なカウントアップはトランザクション推奨ですが、今回はシンプルに
    // 実際には update(ref(db, 'answers/' + uid), { votes: current + 1 })
    const vRef = ref(db, `answers/${uid}/votes`);
    onValue(vRef, s => {
        update(ref(db, `answers/${uid}`), { votes: (s.val() || 0) + 1 });
    }, { onlyOnce: true });
    hasVoted = true;
    body.className = "bg-bg-voted-or-sent";
};

function getKanaRow(c) {
    const code = c.charCodeAt(0);
    if (code >= 12353 && code <= 12362) return "あ行";
    if (code >= 12363 && code <= 12372) return "か行";
    if (code >= 12373 && code <= 12382) return "さ行";
    if (code >= 12383 && code <= 12392) return "た行";
    if (code >= 12393 && code <= 12402) return "な行";
    if (code >= 12403 && code <= 12417) return "は行";
    if (code >= 12418 && code <= 12422) return "ま行";
    if (code >= 12423 && code <= 12427) return "や行";
    if (code >= 12428 && code <= 12432) return "ら行";
    return "わ行";
}
