/* --- スコア管理用 --- */
let correctCount = 0;
let answeredCount = 0;

function updateScoreDisplay() {
  const scoreDiv = document.getElementById("score");
  if (scoreDiv) {
    const rate = answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100);
    
    // コメントの判定
    let comment = "まずは 1 問解こう！";
    if (answeredCount > 0) {
      comment = rate < 60 ? "がんばれ！" : "この調子！";
    }

    scoreDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px; padding: 10px; border-bottom: 2px solid #eee; margin-bottom: 20px;">
      <img src="Baba.png" alt="AI Assoc Prof Baba" width="80" height="80" style="border-radius: 50%; border: 2px solid #007bff;">
      <div style="line-height: 1.5;">
        <div style="font-size: 1.2rem; font-weight: bold;">
          スコア: <span style="font-size: 1.6rem; color: #007bff;">${correctCount}</span> / ${answeredCount} (${rate}%)
        </div>
        <div style="font-size: 1rem; color: #555;">${comment}</div>
      </div>
    </div>
  `;
  }
}

function mdInline(text) {
  const html = marked.parse(text || "").replace(/^<p>|<\/p>\n?$/g, "");
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["ruby", "rt"]
  });
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderQuiz(quizData, containerId = "quiz") {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`#${containerId} が見つかりません`);
    return;
  }

  // 初期化
  correctCount = 0;
  answeredCount = 0;
  updateScoreDisplay();

  container.innerHTML = "";
  
  quizData.forEach((q, index) => {
    const div = document.createElement("div");
    div.style.marginBottom = "2em";
  
    let html = `<p><strong>Q${index + 1}. ${mdInline(q.question)}</strong></p>`;
  
    const correct = q.choices[0];
    const shuffled = shuffle([...q.choices]);
  
    shuffled.forEach(choice => {
      html += `<button 
        data-correct="${choice === correct}" 
        onclick='checkAnswer(this, ${JSON.stringify(q.explanation)})'>
        ${mdInline(choice)}
      </button>`;
    });
  
    html += `<p class="result"></p>`;
    html += `<p class="explanation" style="display:none;"></p>`;
  
    div.innerHTML = html;
    container.appendChild(div);
  });
}

function checkAnswer(btn, explanation) {
  const parent = btn.parentElement;
  const result = parent.querySelector(".result");
  const exp = parent.querySelector(".explanation");

  const buttons = parent.querySelectorAll("button");
  if (buttons[0].disabled) return; // すでに回答済みなら何もしない

  buttons.forEach(b => b.disabled = true);

  answeredCount++; // 回答数を増やす

  if (btn.dataset.correct === "true") {
    btn.classList.add("correct");
    result.textContent = "正解！";
    correctCount++; // 正解数を増やす
  } else {
    btn.classList.add("wrong");
    result.textContent = "不正解";
    buttons.forEach(b => {
      if (b.dataset.correct === "true") b.classList.add("correct");
    });
  }

  // スコア表示を更新
  updateScoreDisplay();

  const html = marked.parse(explanation || "（解説なし）");
  exp.innerHTML = DOMPurify.sanitize(html, {
    ADD_TAGS: ["ruby", "rt"]
  });
  exp.style.display = "block";
}

/* --- 以下、バリデーション・CSV読み込み関数（変更なし） --- */
function validateQuizData(quizData) {
  quizData.forEach((q, index) => {
    if (!q.question) console.warn(`Q${index + 1} に問題文なし`);
    if (!q.explanation) console.warn(`Q${index + 1} に解説なし`);
  });
}

async function loadCSV(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch失敗");
    const text = await res.text();
    return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  } catch (e) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.onload = function () {
        const data = Papa.parse(xhr.responseText, { header: true, skipEmptyLines: true }).data;
        resolve(data);
      };
      xhr.onerror = reject;
      xhr.send();
    });
  }
}

function convertToQuizData(csvData) {
  return csvData.map(row => ({
    // CSVの列名が「category」または「カテゴリ」に対応
    category: row.category || row["カテゴリ"] || "",
    question: row.question || row["問題"],
    choices: [
      row.correct || row["正解"],
      row.wrong1 || row["誤答1"],
      row.wrong2 || row["誤答2"],
      row.wrong3 || row["誤答3"],
      row.wrong4 || row["誤答4"]
    ].filter(Boolean),
    explanation: row.explanation || row["解説"]
  }));
}

/* --- 将来的に initQuiz 内で使う抽出ロジックのイメージ --- */

/* --- 配列からランダムに指定数を取り出す補助関数 --- */
function getRandomSubset(array, count) {
  const shuffled = shuffle([...array]);
  return shuffled.slice(0, count);
}

async function initQuiz() {
  const url = window.quizCSV;
  const config = window.quizConfig; // 学校側の設定を取得

  if (!url) return;

  const csvData = await loadCSV(url);
  const allData = convertToQuizData(csvData);

  let finalQuizData = [];

  if (config) {
    // 設定がある場合：カテゴリごとに抽出
    Object.keys(config).forEach(category => {
      const count = config[category];
      const filtered = allData.filter(q => q.category === category);
      
      if (filtered.length > 0) {
        finalQuizData = finalQuizData.concat(getRandomSubset(filtered, count));
      } else {
        console.warn(`カテゴリ「${category}」の問題が見つかりませんでした。`);
      }
    });
    
    // 最後に全体をシャッフル（カテゴリ順に並ばないようにする）
    finalQuizData = shuffle(finalQuizData);
  } else {
    // 設定がない場合：今まで通り全件表示
    finalQuizData = allData;
  }

  validateQuizData(finalQuizData);
  renderQuiz(finalQuizData);
}

async function initQuiz_original() {
  const url = window.quizCSV;
  if (!url) return;
  const csvData = await loadCSV(url);
  const quizData = convertToQuizData(csvData);
  validateQuizData(quizData);
  renderQuiz(quizData);
}

document.addEventListener("DOMContentLoaded", initQuiz);