export default async (request, context) => {
  const auth = request.headers.get("authorization");

  // 1. ユーザー名とパスワードのリストを定義
  const users = {
    "sw": "nuhw",
    "nuhw": "sw"
  };

  if (auth) {
    // 2. ブラウザから送られてくる "Basic dXNlcjpwYXNz" 形式を解析
    const base64Credentials = auth.split(" ")[1];
    const credentials = atob(base64Credentials); // "user:pass" に変換
    const [username, password] = credentials.split(":");

    // 3. ユーザー名が存在し、かつパスワードが一致するかチェック
    if (users[username] === password) {
      return await context.next();
    }
  }

  // 認証失敗時、または初回アクセス時
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Secure Area"',
    },
  });
};

export const config = { path: "/*" };