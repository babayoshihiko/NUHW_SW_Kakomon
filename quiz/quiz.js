/* --- スコア管理用 --- */
let correctCount = 0;
let answeredCount = 0;
let currentQuizData = []; 

/* =========================
   読み込み・データ処理系
========================= */

// データ変換：CSV(Google Spread)用。correct と wrongs に分ける
function convertToQuizData(csvData) {
  return csvData.map(row => {
    const findKey = (name) => Object.keys(row).find(k => k.trim().toLowerCase() === name);
    const getVal = (name) => {
      const key = findKey(name);
      return key ? row[key].toString().trim() : "";
    };

    const question = getVal("question");
    if (!question || question.toLowerCase() === "question") return null;

    return {
      category: getVal("category"),
      question: question,
      correct: getVal("correct"), // 正解
      wrongs: [
        getVal("wrong1"),
        getVal("wrong2"),
        getVal("wrong3"),
        getVal("wrong4")
      ].filter(Boolean), // 誤答を配列にする
      explanation: getVal("explanation") || "解説はありません。"
    };
  }).filter(Boolean);
}

// 統合読み込み関数（Google / CSV / JSON 対応）
async function loadData(url) {
  // URLに応じてキャッシュバスターの記号を変える
  const separator = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}v=${new Date().getTime()}`;

  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error("ファイルの取得に失敗しました");

  // JSONの場合
  if (url.toLowerCase().endsWith(".json")) {
    const jsonData = await res.json();
    // JSONが古い形式（choices）だった場合の互換性維持
    return jsonData.map(q => {
      if (q.choices && !q.correct) {
        return {
          ...q,
          correct: q.choices[0],
          wrongs: q.choices.slice(1)
        };
      }
      return q;
    });
  } 
  
  // CSV / Google Spread の場合
  const text = await res.text();
  const csvResult = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  return convertToQuizData(csvResult);
}

/* =========================
   表示・クイズ制御系
========================= */

function renderQuiz(quizData, containerId = "quiz") {
  const container = document.getElementById(containerId);
  const popupContainer = document.getElementById("popup-container");
  if (!container) return;

  if (popupContainer) popupContainer.style.display = "flex";
  container.innerHTML = "";

  quizData.forEach((q, index) => {
    const div = document.createElement("div");
    div.style.marginBottom = "2em";
    div.classList.add("quiz-item");

    let html = `<p><strong>Q${index + 1}. ${mdInline(q.question)}</strong></p>`;

    // 正解と誤答を合体させてシャッフル
    const allChoices = [
      { text: q.correct, isCorrect: true },
      ...q.wrongs.map(w => ({ text: w, isCorrect: false }))
    ];
    const shuffled = shuffle([...allChoices]);

    shuffled.forEach(choice => {
      // データの渡し方をJSON文字列にして安全に
      const safeExp = q.explanation ? JSON.stringify(q.explanation) : '""';
      html += `<button 
                data-correct="${choice.isCorrect}" 
                onclick='checkAnswer(this, ${safeExp})'>
                ${mdInline(choice.text)}
              </button>`;
    });

    html += `<p class="result"></p><p class="explanation" style="display:none;"></p>`;
    div.innerHTML = html;
    container.appendChild(div);
  });
  
  updateScoreDisplay();
}

function checkAnswer(btn, explanation) {
  const parent = btn.parentElement;
  const result = parent.querySelector(".result");
  const exp = parent.querySelector(".explanation");
  const buttons = parent.querySelectorAll("button");

  if (buttons[0].disabled) return;
  buttons.forEach(b => b.disabled = true);

  answeredCount++;

  if (btn.dataset.correct === "true") {
    btn.classList.add("correct");
    result.textContent = "正解！";
    correctCount++;
  } else {
    btn.classList.add("wrong");
    result.textContent = "不正解";
    // 正解ボタンをハイライト
    buttons.forEach(b => {
      if (b.dataset.correct === "true") b.classList.add("correct");
    });
  }

  updateScoreDisplay();
  const html = marked.parse(explanation || "（解説なし）");
  exp.innerHTML = DOMPurify.sanitize(html, { ADD_TAGS: ["ruby", "rt"] });
  exp.style.display = "block";
}

/* =========================
   印刷機能
========================= */

// 印刷ボタンから呼び出される関数
function preparePrint() {
  // currentQuizData または window.currentQuizData を参照
  const data = currentQuizData || window.currentQuizData;
  
  if (!data || data.length === 0) {
    alert("クイズデータが準備できていません。画面に問題が表示されてから実行してください。");
    return;
  }
  // 印刷用レンダリングを実行
  renderQuizForPrint(data);
}

// 印刷用レンダリング
function renderQuizForPrint(quizData) {
  const container = document.getElementById("quiz");
  const popupContainer = document.getElementById("popup-container");

  if (popupContainer) popupContainer.style.display = "none";

  container.innerHTML = `
    <div style="text-align:center; border-bottom: 2px solid #000; margin-bottom: 20px;">
      <h2>確認テスト</h2>
      <p style="text-align:right;">氏名：__________________________</p>
    </div>
  `;

  quizData.forEach((q, index) => {
    const div = document.createElement("div");
    div.style.breakInside = "avoid";
    div.style.pageBreakInside = "avoid";
    div.style.marginBottom = "2.5rem";

    // 選択肢を合体（印刷時はシャッフル不要ならそのままでも良いが、一応シャッフル）
    const choices = shuffle([q.correct, ...q.wrongs]);

    div.innerHTML = `
      <p style="margin-bottom: 0.5rem;"><strong>問${index + 1}. ${mdInline(q.question)}</strong></p>
      <div style="margin-left: 20px;">
        ${choices.map((c, i) => `<div style="margin-bottom: 6px;">（ ${i + 1} ） ${mdInline(c)}</div>`).join('')}
      </div>
    `;
    container.appendChild(div);
  });

  setTimeout(() => {
    window.print();
    renderQuiz(quizData); // 印刷後に元の画面に戻す
  }, 500);
}

/* =========================
   共通ツール・初期化
========================= */

function updateScoreDisplay() {
  const scoreDiv = document.getElementById("score");
  if (!scoreDiv) return;
  const rate = answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100);
  let comment = answeredCount === 0 ? "まずは一問！" : (rate < 60 ? "がんばれ！" : "この調子！");
  
  scoreDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; padding: 5px;">
      <img src="Baba.png" alt="Baba" width="50" height="50" style="border-radius: 50%; border: 2px solid #007bff; background:white;">
      <div>
        <div style="font-weight: bold;">スコア: ${correctCount}/${answeredCount} (${rate}%)</div>
        <div style="font-size: 0.8rem; color: #444;">${comment}</div>
      </div>
    </div>
  `;
}

function mdInline(text) {
  const html = marked.parse(text || "").replace(/^<p>|<\/p>\n?$/g, "");
  return DOMPurify.sanitize(html, { ADD_TAGS: ["ruby", "rt"] });
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function initQuiz() {
  const container = document.getElementById("quiz");
  const url = window.quizCSV || window.quizJSON;
  const config = window.quizConfig;
  if (!container || !url) return;

  try {
    container.innerHTML = "データを読み込み中...";
    const allData = await loadData(url);
    
    let finalQuizData = [];
    if (config && Object.keys(config).length > 0) {
      Object.keys(config).forEach(cat => {
        const count = config[cat];
        const filtered = allData.filter(q => q.category && q.category.trim() === cat.trim());
        if (filtered.length > 0) {
          const subset = shuffle([...filtered]).slice(0, count);
          finalQuizData = finalQuizData.concat(subset);
        }
      });
      finalQuizData = shuffle(finalQuizData);
    } else {
      finalQuizData = allData;
    }

    if (finalQuizData.length === 0) finalQuizData = allData;
    currentQuizData = finalQuizData; 
    renderQuiz(finalQuizData);
  } catch (e) {
    console.error(e);
    container.innerHTML = `<p style="color:red;">エラー: ${e.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", initQuiz);