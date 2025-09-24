export async function onRequest(context) {
  const { request, params, env } = context;

  const filename = params.filename;
  if (!filename || !/^[a-zA-Z0-9\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5\s\-_.]+\.(mp3|wav|flac|m4a)$/i.test(filename)) {
    return new Response('Invalid filename', { status: 400, headers: { 'access-control-allow-origin': '*' } });
  }

  // 透传 Range 请求，实现分片播放
  const headers = new Headers();
  const rangeHeader = request.headers.get('Range');
  if (rangeHeader) headers.set('Range', rangeHeader);

  // 直接从 Pages 静态资源（部署产物）中读取 /music/<filename>
  const assetUrl = new URL(request.url);
  assetUrl.pathname = `/music/${filename}`;

  const upstream = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET', headers }));

  if (!upstream.ok) {
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'no-cache'
      }
    });
  }

  const respHeaders = new Headers();
  const copyHeaders = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'last-modified',
    'etag',
  ];
  for (const h of copyHeaders) {
    const v = upstream.headers.get(h);
    if (v) respHeaders.set(h, v);
  }
  respHeaders.set('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
  respHeaders.set('x-content-type-options', 'nosniff');
  respHeaders.set('access-control-allow-origin', '*');
  respHeaders.set('cache-control', 'public, max-age=3600');

  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}


