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

  container.innerHTML = "";
  
  quizData.forEach((q, index) => {
    const div = document.createElement("div");
  
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
  buttons.forEach(b => b.disabled = true);

  if (btn.dataset.correct === "true") {
    btn.classList.add("correct");
    result.textContent = "正解！";
  } else {
    btn.classList.add("wrong");
    result.textContent = "不正解";

    buttons.forEach(b => {
      if (b.dataset.correct === "true") {
        b.classList.add("correct");
      }
    });
  }

  const html = marked.parse(explanation || "（解説なし）");
  exp.innerHTML = DOMPurify.sanitize(html, {
    ADD_TAGS: ["ruby", "rt"]
  });
  exp.style.display = "block";
}

function validateQuizData(quizData) {
  quizData.forEach((q, index) => {
    if (!q.question) console.warn(`Q${index + 1} に問題文なし`);
    if (!q.explanation) console.warn(`Q${index + 1} に解説なし`);
  });
}

/* =========================
   CSV読み込み（両対応版）
========================= */

async function loadCSV(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch失敗");

    const text = await res.text();

    return Papa.parse(text, {
      header: true,
      skipEmptyLines: true
    }).data;

  } catch (e) {
    console.warn("fetch失敗 → XHRにフォールバック", e);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.onload = function () {
        const data = Papa.parse(xhr.responseText, {
          header: true,
          skipEmptyLines: true
        }).data;
        resolve(data);
      };
      xhr.onerror = reject;
      xhr.send();
    });
  }
}

function convertToQuizData(csvData) {
  return csvData.map(row => ({
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

/* =========================
   初期化
========================= */

async function initQuiz() {
  const url = window.quizCSV;

  if (!url) {
    console.error("CSV URL が指定されていません");
    return;
  }

  const csvData = await loadCSV(url);
  const quizData = convertToQuizData(csvData);

  validateQuizData(quizData);
  renderQuiz(quizData);
}

document.addEventListener("DOMContentLoaded", initQuiz);