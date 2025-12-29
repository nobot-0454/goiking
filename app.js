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

const loginScreen = document.getElementById('login-screen');
const waitScreen = document.getElementById('wait-screen');
const teacherScreen = document.getElementById('teacher-screen');
const studentArea = document.getElementById('student-area');

let currentUser = null;
let isTeacher = false; // 先生かどうかを判定するフラグ

// --- 1. ログイン機能 ---
document.getElementById('btn-google-login').onclick = () => signInWithPopup(auth, provider);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        waitScreen.classList.remove('hidden');
    }
});

// --- 2. 先生モード切り替え（3回クリック） ---
function setTeacherCommand(selector) {
    let count = 0;
    const el = document.querySelector(selector);
    if(el) el.onclick = () => {
        count++;
        if(count >= 3) {
            isTeacher = true; // 先生フラグを立てる
            teacherScreen.classList.remove('hidden');
            waitScreen.classList.add('hidden');
            alert("せんせいモードになりました！");
            count = 0;
        }
    };
}
setTeacherCommand('.logo');
setTeacherCommand('.logo-trigger');

// --- 3. 先生の操作：お題を出す ---
const wordList = [
    { name: "コイキング", cat: "ポケモン" }, { name: "ピカチュウ", cat: "ポケモン" },
    { name: "たきのぼり", cat: "わざ" }, { name: "モンスターボール", cat: "どうぐ" },
    { name: "ギャラドス", cat: "ポケモン" }, { name: "きずぐすり", cat: "どうぐ" },
    { name: "なみのり", cat: "わざ" }, { name: "カビゴン", cat: "ポケモン" }
];

document.getElementById('btn-draw').onclick = () => {
    const item = wordList[Math.floor(Math.random() * wordList.length)];
    const row = getKanaRow(item.name[0]);
    
    // データベースを更新（ここが児童への合図になります）
    set(ref(db, 'gameStatus'), {
        state: "playing",
        hint1: item.cat,
        hint2: row,
        hint3: item.name.length,
        answer: item.name,
        timestamp: Date.now() // 毎回違う値にして更新を確実に通知させる
    });
    set(ref(db, 'answers'), null); 
    document.getElementById('teacher-info').innerText = `現在のお題：${item.name}`;
};

// --- 4. 児童の画面更新とお題受信（順番に表示する演出） ---
onValue(ref(db, 'gameStatus'), (snap) => {
    const data = snap.val();
    // ログイン済み かつ 先生画面ではない時
    if (data?.state === "playing" && !isTeacher) {
        
        // 1. まず枠を作る
        studentArea.innerHTML = `
            <div class="hint-card">
                <div id="q1" class="big-hint hidden">①種類：<br><strong>${data.hint1}</strong></div>
                <div id="q2" class="big-hint hidden">②何行：<br><strong>${data.hint2}</strong></div>
                <div id="q3" class="big-hint hidden">③文字数：<br><strong>${data.hint3}文字</strong></div>
                
                <div id="input-area" class="hidden" style="margin-top:20px;">
                    <input type="text" id="ans-input" placeholder="答えを入力">
                    <button id="ans-send" class="primary-btn" style="width:100%">送信</button>
                </div>
            </div>
            <div id="all-answers"></div>
        `;

        // 2. 順番に表示させる（演出）
        setTimeout(() => { document.getElementById('q1').classList.remove('hidden'); }, 0);
        setTimeout(() => { document.getElementById('q2').classList.remove('hidden'); }, 1500);
        setTimeout(() => { 
            document.getElementById('q3').classList.remove('hidden'); 
            document.getElementById('input-area').classList.remove('hidden'); // 入力欄も出す
        }, 3000);

        // 送信ボタンの処理
        document.getElementById('ans-send').onclick = () => {
            const text = document.getElementById('ans-input').value.trim();
            if(text) {
                set(ref(db, 'answers/' + currentUser.uid), {
                    name: currentUser.displayName,
                    text: text,
                    votes: 0
                });
                document.getElementById('ans-send').disabled = true;
                document.getElementById('ans-send').innerText = "送信済み";
            }
        };
    }
});

// --- 5. 回答一覧の表示（変更なし） ---
onValue(ref(db, 'answers'), (snap) => {
    const area = document.getElementById('all-answers');
    if(!area) return;
    area.innerHTML = "";
    if(snap.exists()){
        snap.forEach(child => {
            const d = child.val();
            const div = document.createElement('div');
            div.className = "ans-item";
            div.innerHTML = `
                <span>${d.text}</span>
                <button class="vote-btn" onclick="window.castVote('${child.key}')">👍 ${d.votes || 0}</button>
            `;
            area.appendChild(div);
        });
    }
});

window.castVote = (uid) => {
    const vRef = ref(db, `answers/${uid}/votes`);
    onValue(vRef, (s) => {
        const currentVotes = s.val() || 0;
        update(ref(db, `answers/${uid}`), { votes: currentVotes + 1 });
    }, { onlyOnce: true });
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
