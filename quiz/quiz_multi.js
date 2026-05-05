/* --- スコア管理用 --- */
let correctCount = 0;
let answeredCount = 0;
let currentQuizData = []; 

/* =========================
    読み込み・データ処理系
========================= */

// データ変換：CSV用（正解列の統合と5択調整）
function convertToQuizData(csvData) {
  return csvData.map(row => {
    const findKey = (name) => Object.keys(row).find(k => k.trim().toLowerCase() === name);
    const getVal = (name) => {
      const key = findKey(name);
      return key ? row[key].toString().trim() : "";
    };

    const question = getVal("question");
    if (!question || question.toLowerCase() === "question") return null;

    // 1. すべての正解列を統合して配列にする
    const corrects = [
      getVal("correct"),
      getVal("correct1"),
      getVal("correct2"),
      getVal("correct3")
    ].filter(Boolean);

    // 2. 誤答列（1〜5）をすべて取得
    const allWrongs = [
      getVal("wrong1"),
      getVal("wrong2"),
      getVal("wrong3"),
      getVal("wrong4"),
      getVal("wrong5")
    ].filter(Boolean);

    // 3. 合計5択にするために必要な誤答数を計算
    const neededWrongCount = 5 - corrects.length;
    const selectedWrongs = shuffle([...allWrongs]).slice(0, Math.max(0, neededWrongCount));

    return {
      category: getVal("category"),
      question: question,
      corrects: corrects,
      wrongs: selectedWrongs,
      explanation: getVal("explanation") || "解説はありません。"
    };
  }).filter(Boolean);
}

// 統合読み込み関数
async function loadData(url) {
  const separator = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}v=${new Date().getTime()}`;

  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error("ファイルの取得に失敗しました");

  // JSONの場合
  if (url.toLowerCase().endsWith(".json")) {
    const jsonData = await res.json();
    return jsonData.map(q => {
      // JSONでも文字列または配列のどちらでも受け取れるようにガード
      const c = q.corrects ? (Array.isArray(q.corrects) ? q.corrects : [q.corrects]) : [q.correct || ""];
      const w = q.wrongs || [];
      const neededW = 5 - c.filter(Boolean).length;
      return {
        ...q,
        corrects: c.filter(Boolean),
        wrongs: shuffle([...w]).slice(0, neededW),
        explanation: q.explanation || "解説なし"
      };
    });
  } 
  
  // CSVの場合
  const text = await res.text();
  const csvResult = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  return convertToQuizData(csvResult);
}

/* =========================
    判定・UI制御系
========================= */

function toggleSelection(btn) {
  if (btn.parentElement.parentElement.querySelector(".submit-btn").disabled) return;
  btn.classList.toggle("selected");
}

function checkAnswerMulti(quizIndex, explanation) {
  const items = document.querySelectorAll(".quiz-item");
  const itemDiv = items[quizIndex];
  const result = itemDiv.querySelector(".result");
  const exp = itemDiv.querySelector(".explanation");
  const submitBtn = itemDiv.querySelector(".submit-btn");
  const choiceButtons = itemDiv.querySelectorAll(".choice-btn");

  const selectedButtons = Array.from(choiceButtons).filter(btn => btn.classList.contains("selected"));
  if (selectedButtons.length === 0) {
    alert("選択肢を1つ以上選んでください。");
    return;
  }

  // ロック
  submitBtn.disabled = true;
  choiceButtons.forEach(b => b.style.cursor = "default");

  answeredCount++;

  // 判定
  const selectedCorrectCount = selectedButtons.filter(btn => btn.dataset.correct === "true").length;
  const totalCorrectCount = Array.from(choiceButtons).filter(btn => btn.dataset.correct === "true").length;
  const isPerfect = (selectedCorrectCount === selectedButtons.length) && (selectedCorrectCount === totalCorrectCount);

  if (isPerfect) {
    result.textContent = "正解！";
    result.className = "result correct-text";
    correctCount++;
  } else {
    result.textContent = "不正解";
    result.className = "result wrong-text";
  }

  // ビジュアルフィードバック
  choiceButtons.forEach(btn => {
    if (btn.dataset.correct === "true") btn.classList.add("reveal-correct");
    if (btn.classList.contains("selected") && btn.dataset.correct === "false") btn.classList.add("reveal-wrong");
  });

  updateScoreDisplay();
  const html = marked.parse(explanation || "（解説なし）");
  exp.innerHTML = DOMPurify.sanitize(html, { ADD_TAGS: ["ruby", "rt"] });
  exp.style.display = "block";
}

/* =========================
    印刷機能
========================= */

// 印刷ボタンから呼び出されるメイン関数
function preparePrint() {
  const data = currentQuizData;
  if (!data || data.length === 0) {
    alert("クイズデータが準備できていません。");
    return;
  }
  // 印刷用レンダリングを実行
  renderQuizForPrint(data);
}

// 印刷用表示の生成
function renderQuizForPrint(quizData) {
  const container = document.getElementById("quiz");
  const popupContainer = document.getElementById("popup-container");

  // ポップアップやスコアを隠す
  if (popupContainer) popupContainer.style.display = "none";
  const scoreDiv = document.getElementById("score");
  if (scoreDiv) scoreDiv.style.display = "none";

  // タイトルと名前入力欄
  container.innerHTML = `
    <div style="text-align:center; border-bottom: 2px solid #000; margin-bottom: 20px; padding-bottom: 10px;">
      <h2 style="margin:0;">確認テスト</h2>
      <p style="text-align:right; margin: 10px 0 0 0;">氏名：__________________________</p>
    </div>
  `;

  let currentCategory = "";

  quizData.forEach((q, index) => {
    // カテゴリ見出し
    if (q.category && q.category !== currentCategory) {
      currentCategory = q.category;
      const categoryTitle = document.createElement("h3");
      categoryTitle.style.borderBottom = "1px solid #666";
      categoryTitle.style.marginTop = "30px";
      categoryTitle.style.paddingBottom = "5px";
      categoryTitle.textContent = currentCategory;
      container.appendChild(categoryTitle);
    }

    const div = document.createElement("div");
    div.style.breakInside = "avoid";
    div.style.pageBreakInside = "avoid";
    div.style.marginBottom = "2rem";

    // 正解と誤答を合体させてシャッフル（常に5択になるよう調整済みデータを使用）
    const choices = shuffle([...q.corrects, ...q.wrongs]);

    div.innerHTML = `
      <p style="margin-bottom: 0.8rem;"><strong>問${index + 1}. ${mdInline(q.question)}</strong></p>
      <div style="margin-left: 20px;">
        ${choices.map((c, i) => `
          <div style="margin-bottom: 8px; display: flex; align-items: flex-start;">
            <span style="margin-right: 10px;">（ ${i + 1} ）</span>
            <span>${mdInline(c)}</span>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(div);
  });

  // 少し待ってから印刷ダイアログを表示
  setTimeout(() => {
    window.print();
    // 印刷が終わったら画面を元に戻す
    location.reload(); // 確実に元に戻すためにリロードするのが安全です
  }, 500);
}

/* =========================
    表示・レンダリング系
========================= */

function renderQuiz(quizData, containerId = "quiz") {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  let currentCategory = "";

  quizData.forEach((q, index) => {
    // カテゴリ見出し
    if (q.category && q.category !== currentCategory) {
      currentCategory = q.category;
      const categoryTitle = document.createElement("h3");
      categoryTitle.className = "category-title";
      categoryTitle.textContent = currentCategory;
      container.appendChild(categoryTitle);
    }

    const div = document.createElement("div");
    div.classList.add("quiz-item");

    // 選択肢の準備
    const allChoices = [
      ...q.corrects.map(text => ({ text, isCorrect: true })),
      ...q.wrongs.map(text => ({ text, isCorrect: false }))
    ];
    const shuffled = shuffle([...allChoices]);

    // HTML組み立て
    let html = `<p><strong>Q${index + 1}. ${mdInline(q.question)}</strong></p>`;
    
    // 選択肢ボタン群
    html += `<div class="choices-container">`;
    shuffled.forEach(choice => {
      html += `<button type="button" class="choice-btn" data-correct="${choice.isCorrect}" onclick="toggleSelection(this)">${mdInline(choice.text)}</button>`;
    });
    html += `</div>`;

    // 確定ボタン・結果・解説（これらがすべて quiz-item の直下になり、CSSで左寄せされます）
    const safeExp = q.explanation ? JSON.stringify(q.explanation) : '""';
    html += `
      <button class="submit-btn" onclick='checkAnswerMulti(${index}, ${safeExp})'>回答を確定する</button>
      <p class="result"></p>
      <div class="explanation" style="display:none;"></div>
    `;

    div.innerHTML = html;
    container.appendChild(div);
  });
  updateScoreDisplay();
}

/* =========================
    共通ツール・初期化（変更なし）
========================= */

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function mdInline(text) {
  const html = marked.parse(text.replace(/\\n/g, "\n") || "").replace(/^<p>|<\/p>\n?$/g, "");
  return DOMPurify.sanitize(html, { ADD_TAGS: ["ruby", "rt"] });
}

/* =========================
    スコア表示・コメント機能
========================= */

function updateScoreDisplay() {
  const scoreDiv = document.getElementById("score");
  if (!scoreDiv) return;

  const rate = answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100);

  // Baba先生のコメント集
  const comments = {
    start: ["まずは一問！", "ここからスタート！", "気軽に始めよう"],
    low: ["がんばれ！", "まだ伸びる！", "ここからが勝負", "復習しよう"],
    high: ["この調子！", "いい感じ！", "そのまま突き進め", "完璧に近い！"]
  };

  let comment;
  if (answeredCount === 0) {
    comment = getRandom(comments.start);
  } else if (rate < 60) {
    comment = getRandom(comments.low);
  } else {
    comment = getRandom(comments.high);
  }

  // スコア表示のHTML生成（画像含む）
  scoreDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #fdfdfd; border-radius: 10px; border: 1px solid #eee; max-width: fit-content; margin-bottom: 20px;">
      <img src="Baba.png" alt="Baba" width="80" height="80" style="border-radius: 50%; border: 2px solid #007bff; background:white; object-fit: cover;">
      <div>
        <div style="font-weight: bold; font-size: 1.1rem;">スコア: ${correctCount}/${answeredCount} (${rate}%)</div>
        <div style="font-size: 0.9rem; color: #555; margin-top: 4px;">${comment}</div>
      </div>
    </div>
  `;
}

// 配列からランダムに取得する補助関数
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function initQuiz() {
  const container = document.getElementById("quiz");
  const url = window.quizCSV || window.quizJSON;
  if (!container || !url) return;

  try {
    container.innerHTML = "読み込み中...";
    let data = await loadData(url);

    // 1. カテゴリごとにグループ化（CSVに登場する順番を保持）
    const groups = data.reduce((acc, obj) => {
      const key = obj.category || "未分類";
      if (!acc[key]) acc[key] = [];
      acc[key].push(obj);
      return acc;
    }, {});

    // 2. 各カテゴリごとの処理
    data = Object.keys(groups).flatMap(catName => {
      let group = [...groups[catName]];

      // カテゴリ内をシャッフル（noShuffleQuestions が指定されていない場合）
      if (!window.noShuffleQuestions) {
        group = shuffle(group);
      }

      // html側の quizConfig で指定された数だけ抽出
      const config = window.quizConfig;
      if (config && typeof config === "object") {
        const limit = config[catName];
        // 設定に数値がある場合のみ slice を実行
        if (typeof limit === "number") {
          group = group.slice(0, limit);
        }
      }

      return group;
    });

    currentQuizData = data; 
    renderQuiz(data);
  } catch (e) {
    console.error(e);
    container.innerHTML = `<p style="color:red;">エラー: ${e.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", initQuiz);