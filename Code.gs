/*
==================================================
  過去問クイズシステム - GAS仕様書
==================================================

【全体の流れ】
1. Webブラウザから kakomonName と PASSCODE を受信
2. 全体マスタ (adminシート) から対象の fileId を検索
3. 学校マスタ (ADMINシート) を開き、データ取得

【メンテナンスメモ】
- 全体マスタのシート名は小文字 'admin'
- 学校マスタのシート名は大文字 'ADMIN'
- 変更時は必ず「デプロイを更新」を行うこと！
==================================================

このGASのウェブアプリ: load_gsheet.js に貼り付ける。
https://script.google.com/macros/s/AKfycbzEsnGKR0mNzRc_ECKgN4H0WHQ1x4j-djwKHCNZ9Hx4kgf3YDqrZc9YQ4cJ0y4-ML4DYw/exec


【全体マスタ】シート（タブ）名を admin にします。

1行目（ヘッダー）に、以下の列を作成する。列名は camelCase を採用。この列名は、Code.gs で使用するので変更しないこと。

schoolName
kakomonName
fileId

【学校マスタ】

ADMIN シート（学校の先生が管理）

ここに Passcode や各シート名（SHEET_MONDAI 等）を配置し、先生が自由に変更できるようにします。
admin のシート名と admin 中の列名は ALL_CAPS を採用。この列名は、Code.gs で使用するので変更しないこと。

SCHOOL_NAME
KAKOMON_NAME
PASSCODE
SHEET_MONDAI
SHEET_CATEGORY

SHEET_MONDAI で指定されているシートには、以下の列がある。

CATEGORY	
QUESTION
CORRECT: CORRECT1 でも可能。CORRECT と CORRECT1 は、混在させないでください。
CORRECT1 - CORRECT3:（オプション）追加。社会福祉士国家試験など複数選択用。
WRONG1	
WRONG2	
WRONG3 - WRONG7:（オプション）追加
EXPLANATION


SHEET_CATEGORY で指定されているシートには、以下の列がある。

CATEGORY: SHEET_MONDAI の問題のうち、CATEGORY を抽出する。
NUM: CATEGORY の抽出する件数

 */



function doGet(e) {
  try {
    const params = e.parameter || {};
    const kakomonName = params.kakomonName || "";
    const schoolName = params.schoolName || "";
    const inputPasscode = params.passcode || "";

    if (!kakomonName) {
      return responseJson({
        status: "error",
        message: "kakomonNameが指定されていません。"
      });
    }

    // ==================================================
    // 1. 全体マスタ「admin」から fileId を取得
    // ==================================================
    const masterSheet = getMasterSheetData_("admin");

    const masterRule = masterSheet.find(row => {
      return row["schoolName"] === schoolName &&
             row["kakomonName"] === kakomonName;
    });

    if (!masterRule) {
      return responseJson({
        status: "error",
        message:
          `全体マスタ「admin」に一致するデータがありません。\n` +
          `schoolName="${schoolName}"\n` +
          `kakomonName="${kakomonName}"`
      });
    }

    const fileId = String(masterRule["fileId"] || "");

    if (!fileId) {
      return responseJson({
        status: "error",
        message:
          `全体マスタ「admin」に fileId が設定されていません。\n` +
          `schoolName="${schoolName}"\n` +
          `kakomonName="${kakomonName}"`
      });
    }

    // ==================================================
    // 2. fileId の学校ブックを開く
    // ==================================================
    let schoolSS;

    try {
      schoolSS = SpreadsheetApp.openById(fileId);
    } catch (err) {
      return responseJson({
        status: "error",
        message:
          `学校ブックを開けませんでした。\n` +
          `fileId="${fileId}"\n` +
          `GASエラー: ${err.message}`
      });
    }

    // ==================================================
    // 3. 学校ブックの「ADMIN」を取得
    // ==================================================
    const adminSheet = getSheetDataFromSpreadsheet_(schoolSS, "ADMIN");

    if (adminSheet.length === 0) {
      return responseJson({
        status: "error",
        message:
          `学校ブック内に ADMIN シートのデータがありません。\n` +
          `schoolName="${schoolName}"\n` +
          `kakomonName="${kakomonName}"\n` +
          `fileId="${fileId}"\n` +
          `ブック名="${schoolSS.getName()}"`
      });
    }

    // ==================================================
    // 4. ADMINシートから対象の過去問を検索
    // ==================================================
    const adminRule = adminSheet.find(row => {
      return row["KAKOMON_NAME"] === kakomonName &&
            row["SCHOOL_NAME"] === schoolName;
    });

    if (!adminRule) {
      const adminColumns =
        adminSheet.length > 0
          ? Object.keys(adminSheet[0])
          : [];

      const adminFirstRow =
        adminSheet.length > 0
          ? adminSheet[0]
          : null;

      return responseJson({
        status: "error",
        message:
          `ADMINシート内に KAKOMON_NAME="${kakomonName}" / SCHOOL_NAME="${schoolName}" ` +
          `に一致する行が見つかりませんでした。\n\n` +
          `【DEBUG】\n` +
          `ADMIN行数: ${adminSheet.length}\n` +
          `列名: ${JSON.stringify(adminColumns)}\n` +
          `先頭データ: ${JSON.stringify(adminFirstRow)}`
      });
    }

    // ==================================================
    // 5. パスコード認証
    // ==================================================
    const requiredPasscode = String(adminRule["PASSCODE"] || "");

    if (requiredPasscode !== "") {
      if (!inputPasscode) {
        return responseJson({
          status: "auth_required",
          message: "パスコードを入力してください。"
        });
      }

      if (inputPasscode !== requiredPasscode) {
        return responseJson({
          status: "error",
          message: "パスコードが正しくありません。"
        });
      }
    }

    // ==================================================
    // 6. ADMINで指定されたシート名を取得
    // ==================================================
    const targetMondaiSheet =
      adminRule["SHEET_MONDAI"] || "MONDAI";

    const targetCategorySheet =
      adminRule["SHEET_CATEGORY"] || "SHEET_CATEGORY";

    // ==================================================
    // 7. 学校ブック内の各シートからデータ取得
    // ==================================================
    const rawCategories =
      getSheetDataFromSpreadsheet_(schoolSS, targetCategorySheet);

    const allMondai =
      getSheetDataFromSpreadsheet_(schoolSS, targetMondaiSheet);

    // ==================================================
    // 8. CATEGORY / NUM に基づいて問題を抽出
    // ==================================================
    let finalQuestions = [];
    const categorySummary = [];

    if (rawCategories.length > 0) {

      rawCategories.forEach(catRow => {

        const catName = catRow["CATEGORY"] || "";
        const reqNum = Number(catRow["NUM"]) || 0;

        if (!catName) return;

        const catMondai = allMondai.filter(
          m => m["CATEGORY"] === catName
        );

        const selected =
          catMondai.slice(
            0,
            reqNum > 0 ? reqNum : catMondai.length
          );

        finalQuestions =
          finalQuestions.concat(selected);

        categorySummary.push(
          `・${catName}: 設定NUM ${reqNum}件 / ` +
          `該当 ${catMondai.length}件 / ` +
          `抽出 ${selected.length}件`
        );
      });

    } else {

      // CATEGORY指定がない場合は全問題
      finalQuestions = allMondai;
    }

    // ==================================================
    // 9. 0件時エラー
    // ==================================================
    if (finalQuestions.length === 0) {

      let detailMsg =
        `【該当問題なし】問題データが 0 件でした。\n\n`;

      detailMsg += `■ 参照情報\n`;
      detailMsg += `・学校: ${schoolName}\n`;
      detailMsg += `・過去問: ${kakomonName}\n`;
      detailMsg += `・ブック: ${schoolSS.getName()}\n`;
      detailMsg += `・問題シート: ${targetMondaiSheet} ` +
                   `(全 ${allMondai.length} 件)\n`;
      detailMsg += `・カテゴリシート: ${targetCategorySheet} ` +
                   `(設定 ${rawCategories.length} 件)\n\n`;

      detailMsg +=
        `■ カテゴリ別抽出内訳\n` +
        (categorySummary.join("\n") || "カテゴリ指定なし");

      return responseJson({
        status: "error",
        message: detailMsg
      });
    }

    // ==================================================
    // 10. 正常レスポンス
    // ==================================================
    const resultObj = {
      status: "success",
      categories: rawCategories,
      num: finalQuestions.length,
      data: finalQuestions
    };

    return responseJson(resultObj);

  } catch (err) {

    return responseJson({
      status: "error",
      message: "GASエラー: " + err.message
    });
  }
}


// ==================================================
// 全体マスタ用
// 実行中のGASに紐付いたスプレッドシートから
// 「admin」を取得
// ==================================================
function getMasterSheetData_(sheetName) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = values[0];

  return values.slice(1).map(row => {

    const obj = {};

    headers.forEach((header, index) => {

      if (header !== "") {
        obj[header] = row[index];
      }

    });

    return obj;
  });
}


// ==================================================
// 学校ブック用
// fileIdで開いたスプレッドシートからシート取得
// ==================================================
function getSheetDataFromSpreadsheet_(ss, sheetName) {

  if (!sheetName) return [];

  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = values[0];

  return values.slice(1).map(row => {

    const obj = {};

    headers.forEach((header, index) => {

      if (header !== "") {
        obj[header] = row[index];
      }

    });

    return obj;
  });
}


// ==================================================
// JSONレスポンス
// ==================================================
function responseJson(data) {

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}



