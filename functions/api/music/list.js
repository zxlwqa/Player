function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index++;
  }
  return `${size.toFixed(2)}${units[index]}`;
}

export async function onRequest(context) {
  const { env, request } = context;

  // 优先尝试读取静态资源 /music/manifest.json（建议在仓库根 music/ 下生成）
  try {
    const manifestUrl = new URL(request.url);
    manifestUrl.pathname = '/music/manifest.json';
    const res = await env.ASSETS.fetch(new Request(manifestUrl.toString()));
    if (res.ok) {
      const data = await res.json();
      // 期望数据格式：[{ filename, size, mtime }]
      const urlObj = new URL(request.url);
      const protocol = urlObj.protocol.replace(':', '');
      const host = urlObj.host;
      const list = Array.isArray(data) ? data : [];
      const out = list.map(item => ({
        filename: item.filename,
        url: `${protocol}://${host}/music/${encodeURIComponent(item.filename)}`,
        size: typeof item.size === 'number' ? formatFileSize(item.size) : undefined,
        extension: String(item.filename || '').split('.').pop()?.toUpperCase(),
        lastModified: item.mtime
      }));
      return new Response(JSON.stringify({ total: out.length, data: out }, null, 2), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*',
          'cache-control': 'public, s-maxage=300'
        }
      });
    }
  } catch (e) {
    // ignore and fallback
  }

  return new Response(JSON.stringify({
    error: 'manifest.json not found. 请在仓库的 music/ 目录生成 manifest.json 列表，示例：[{"filename":"a.mp3","size":12345,"mtime":"2024-01-01T00:00:00Z"}]'
  }, null, 2), {
    status: 404,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store'
    }
  });
}


