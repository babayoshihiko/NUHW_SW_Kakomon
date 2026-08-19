

window.addEventListener("DOMContentLoaded", async () => {
  const gasUrl = "https://script.google.com/macros/s/AKfycbyfb8SbR4xyO9ygmKFrMHiqwexntoxXWf_hUfJwUIq-ywwqjr2dQtL8Qv6vVT8nuNg/exec";
  const ADMIN_SHEET_ID = "1tm6YBQ52wCqMjM4HSrpo1pp1gwNd9YpF-liLb-Cvqec";
  const ADMIN_SHEET_NAME = "admnin"; 

  const schoolName = window.schoolName || "";
  const kakomonName = window.kakomonName;

  if (!kakomonName) {
    console.error("❌ エラー: kakomonName が未設定のため処理を中断します。");
    return;
  }

  async function loadQuiz(passcode = "") {
    try {
      let fetchUrl = `${gasUrl}?id=${ADMIN_SHEET_ID}&adminSheetName=${encodeURIComponent(ADMIN_SHEET_NAME)}&kakomonName=${encodeURIComponent(kakomonName)}`;
      if (schoolName) fetchUrl += `&schoolName=${encodeURIComponent(schoolName)}`;
      if (passcode) fetchUrl += `&passcode=${encodeURIComponent(passcode)}`;

      const res = await fetch(fetchUrl);
      const data = await res.json();

      // パスコードチェック
      if (data.error === "PASSCODE_REQUIRED" || data.error === "PASSCODE_INCORRECT") {
        const msg = data.error === "PASSCODE_INCORRECT" ? "パスコードが違います。再入力してください:" : "パスコードを入力してください:";
        const input = prompt(msg);
        if (input) {
          loadQuiz(input); // パスコードを付けて再試行
        }
        return;
      }

      if (data.error) {
        console.error("❌ GASエラー:", data.error);
        return;
      }

      // 出題設定の格納
      window.quizConfig = data.quizConfig || {};

      // データの変換とグローバル格納
      const rawQuizData = data.quizData || [];
      window.currentQuizData = typeof convertToQuizData === "function" 
        ? convertToQuizData(rawQuizData) 
        : rawQuizData;

      // 描画
      if (typeof renderQuiz === "function") {
        renderQuiz(window.currentQuizData, "quiz");
      }
    } catch (err) {
      console.error("通信エラーが発生しました:", err);
    }
  }

  // 初期読み込み実行
  loadQuiz();
});

