export default async (request, context) => {
  const auth = request.headers.get("authorization");

  // ユーザー名: user / パスワード: password の場合
  // 独自の ID/PASS にしたい場合は、ここを書き換えるか環境変数を使う
  const expectedAuth = "Basic " + btoa("nuhw:nuhw");

  if (auth !== expectedAuth) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
    });
  }

  return await context.next();
};

export const config = { path: "/*" };