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

// 要素取得
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

// --- 1. ログインロジック ---
document.getElementById('btn-google-login').onclick = () => signInWithPopup(auth, provider);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        studentScreen.classList.remove('hidden'); // ログイン後はまず児童画面
    }
});

// --- 2. 先生モードへの切り替え（🐟を3回クリック） ---
let clicks = 0;
document.querySelector('.logo-trigger').onclick = () => {
    clicks++;
    if (clicks >= 3) {
        studentScreen.classList.add('hidden');
        teacherScreen.classList.remove('hidden');
        alert("先生モード起動！");
    }
};

// --- 3. 先生操作：お題を出す ---
const wordList = [{name:"コイキング",cat:"ポケモン"},{name:"ギャラドス",cat:"ポケモン"},{name:"たきのぼり",cat:"わざ"},{name:"きずぐすり",cat:"どうぐ"}];

document.getElementById('btn-draw').onclick = () => {
    const item = wordList[Math.floor(Math.random() * wordList.length)];
    const time = parseInt(document.getElementById('input-ans-time').value) || 60;
    const minLen = Math.max(2, item.name.length - 1);

    set(ref(db, 'gameStatus'), {
        phase: "answering",
        hint1: item.cat,
        hint2: item.name[0] + "（" + getKanaRow(item.name[0]) + "）",
        hint3: minLen + "文字以上",
        example: item.name,
        endTime: Date.now() + (time * 1000)
    });
    set(ref(db, 'answers'), null);
    hasSubmitted = false;
    hasVoted = false;
};

// --- 4. 先生操作：投票開始 ---
document.getElementById('btn-start-vote').onclick = () => {
    const time = parseInt(document.getElementById('input-vote-time').value) || 60;
    update(ref(db, 'gameStatus'), {
        phase: "voting",
        endTime: Date.now() + (time * 1000)
    });
};

// --- 5. リアルタイム同期（メイン） ---
onValue(ref(db, 'gameStatus'), (snap) => {
    const data = snap.val();
    if (!data) return;

    // タイマー更新 (NaN対策)
    if (timerInterval) clearInterval(timerInterval);
    if (data.endTime) {
        timerInterval = setInterval(() => {
            const remain = Math.ceil((data.endTime - Date.now()) / 1000);
            if (remain <= 0) {
                timerDisplay.innerText = "タイムアップ！";
                clearInterval(timerInterval);
            } else {
                timerDisplay.innerText = `残り時間: ${remain}秒`;
            }
        }, 1000);
    }

    // 先生用情報の表示
    if (!teacherScreen.classList.contains('hidden')) {
        document.getElementById('teacher-info').innerText = `例: ${data.example}`;
    }

    // 児童用UI更新
    if (!studentScreen.classList.contains('hidden')) {
        updateStudentUI(data);
    }
});

function updateStudentUI(data) {
    if (data.phase === "answering") {
        body.className = hasSubmitted ? "bg-finished" : "bg-answering";
        studentArea.innerHTML = hasSubmitted ? 
            `<p style="color:white">送信しました！待機中...</p>` : `
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
                hasSubmitted = true;
                updateStudentUI(data);
            }
        };
    } else if (data.phase === "voting") {
        body.className = hasVoted ? "bg-finished" : "bg-voting";
        studentArea.innerHTML = hasVoted ? `<p style="color:white">投票完了！集計を待っています</p>` : `<h3>いいと思う言葉に投票！</h3><div id="vote-list"></div>`;
    }
}

// 回答一覧の同期
onValue(ref(db, 'answers'), (snap) => {
    const voteList = document.getElementById('vote-list');
    const teacherList = document.getElementById('teacher-view-answers');
    let vHtml = ""; let tHtml = "<h3>児童の回答</h3>";

    if (snap.exists()) {
        snap.forEach(child => {
            const d = child.val();
            vHtml += `<div class="ans-item"><span>${d.text}</span><button onclick="window.castVote('${child.key}')" class="primary-btn" style="padding:5px 10px;">👍 ${d.votes||0}</button></div>`;
            tHtml += `<div class="ans-item"><span>${d.name}: ${d.text}</span><span>👍 ${d.votes||0}</span></div>`;
        });
    }
    if (voteList) voteList.innerHTML = vHtml;
    if (teacherList) teacherList.innerHTML = tHtml;
});

window.castVote = (uid) => {
    if (hasVoted) return;
    const vRef = ref(db, `answers/${uid}/votes`);
    onValue(vRef, s => {
        update(ref(db, `answers/${uid}`), { votes: (s.val() || 0) + 1 });
    }, { onlyOnce: true });
    hasVoted = true;
    body.className = "bg-finished";
    studentArea.innerHTML = `<p style="color:white">投票完了！</p>`;
};

function getKanaRow(c){
    const code = c.charCodeAt(0);
    if(code>=12353&&code<=12362) return "あ行"; if(code>=12363&&code<=12372) return "か行";
    if(code>=12373&&code<=12382) return "さ行"; if(code>=12383&&code<=12392) return "た行";
    if(code>=12393&&code<=12402) return "な行"; if(code>=12403&&code<=12417) return "は行";
    if(code>=12418&&code<=12422) return "ま行"; if(code>=12423&&code<=12427) return "や行";
    if(code>=12428&&code<=12432) return "ら行"; return "わ行";
}
