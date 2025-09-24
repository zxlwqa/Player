export async function onRequest(context) {
  const { env, request } = context;
  // 优先尝试 /index.html，其次回退到 /public/index.html
  const base = new URL(request.url);
  const primary = new URL('/index.html', base);
  const secondary = new URL('/public/index.html', base);

  let upstream = await env.ASSETS.fetch(new Request(primary.toString(), request));
  if (!upstream.ok) {
    upstream = await env.ASSETS.fetch(new Request(secondary.toString(), request));
  }
  if (!upstream.ok) {
    // 兜底：回退到默认静态资源处理
    return await context.next();
  }
  const headers = new Headers(upstream.headers);
  if (!headers.get('cache-control')) {
    headers.set('cache-control', 'public, max-age=300');
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}


