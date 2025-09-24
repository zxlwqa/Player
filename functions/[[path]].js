export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  // 仅处理根路径，其他路径交给默认处理/现有函数
  if (url.pathname === '/' || url.pathname === '') {
    const primary = new URL('/index.html', url);
    const secondary = new URL('/public/index.html', url);

    let upstream = await env.ASSETS.fetch(new Request(primary.toString(), request));
    if (!upstream.ok) {
      upstream = await env.ASSETS.fetch(new Request(secondary.toString(), request));
    }
    if (upstream.ok) {
      const headers = new Headers(upstream.headers);
      if (!headers.get('cache-control')) headers.set('cache-control', 'public, max-age=300');
      return new Response(upstream.body, { status: upstream.status, headers });
    }
  }

  // 交给静态资源或更具体的 Functions 路由
  return context.next();
}


