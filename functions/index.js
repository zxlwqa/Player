export async function onRequest(context) {
  const { env, request } = context;
  // 将根路径映射到 /public/index.html（保持原请求的 URL 基础）
  const url = new URL(request.url);
  url.pathname = '/public/index.html';
  const upstream = await env.ASSETS.fetch(new Request(url.toString(), request));
  if (!upstream.ok) {
    return new Response('Not Found', { status: 404 });
  }
  const headers = new Headers(upstream.headers);
  if (!headers.get('cache-control')) {
    headers.set('cache-control', 'public, max-age=300');
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
