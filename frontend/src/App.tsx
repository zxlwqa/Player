import React, { useEffect, useMemo, useState } from 'react';

type MusicItem = {
  filename: string;
  url: string;
  size: string;
  extension: string;
  lastModified: string;
};

// 默认同源，不使用环境变量
const DEFAULT_API_BASE = '';

export default function App(): JSX.Element {
  const [items, setItems] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [namesToDelete, setNamesToDelete] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const apiBase = useMemo(() => DEFAULT_API_BASE.replace(/\/$/, ''), []);

  async function fetchList(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/music/list`);
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const data = await res.json();
      setItems(data.data || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }

  async function deleteMusic(): Promise<void> {
    if (!password) {
      alert('请先填写管理密码');
      return;
    }
    const params = new URLSearchParams();
    params.set('password', password);
    if (namesToDelete.trim() === '*') {
      params.set('all', 'true');
    } else if (namesToDelete.trim().length > 0) {
      params.set('names', namesToDelete.trim());
    } else {
      alert('请输入待删除的歌曲名，或使用 * 表示全部');
      return;
    }
    const res = await fetch(`${apiBase}/api/delete/music?${params.toString()}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '删除失败');
      return;
    }
    alert(data.message || '删除成功');
    fetchList();
  }

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.filename.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif', padding: '24px', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ margin: 0 }}>在线音乐播放器</h1>
      <p style={{ marginTop: 8, color: '#666' }}>浏览、播放、下载，支持后台删除。</p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜索文件名..."
          style={{ padding: '8px 12px', flex: '1 1 220px', border: '1px solid #ddd', borderRadius: 8 }}
        />
        <button onClick={fetchList} style={{ padding: '8px 14px', borderRadius: 8, background: '#1677ff', color: '#fff', border: 'none' }}>刷新</button>
      </div>

      <div style={{ marginTop: 20, padding: 16, border: '1px solid #eee', borderRadius: 12, background: '#fafafa' }}>
        <h3 style={{ marginTop: 0 }}>删除歌曲</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="管理密码"
            style={{ padding: '8px 12px', flex: '1 1 160px', border: '1px solid #ddd', borderRadius: 8 }}
          />
          <input
            value={namesToDelete}
            onChange={e => setNamesToDelete(e.target.value)}
            placeholder="歌曲名(逗号分隔) 或 * 删除全部"
            style={{ padding: '8px 12px', flex: '2 1 260px', border: '1px solid #ddd', borderRadius: 8 }}
          />
          <button onClick={deleteMusic} style={{ padding: '8px 14px', borderRadius: 8, background: '#ff4d4f', color: '#fff', border: 'none' }}>删除</button>
        </div>
      </div>

      {loading && <p>加载中...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ marginTop: 20 }}>
        {filtered.length === 0 ? (
          <p>暂无数据</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 180px', gap: 12, alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>文件名</div>
            <div style={{ fontWeight: 600 }}>大小</div>
            <div style={{ fontWeight: 600 }}>格式</div>
            <div style={{ fontWeight: 600 }}>操作</div>
            {filtered.map(item => (
              <React.Fragment key={item.filename}>
                <div style={{ wordBreak: 'break-all' }}>{item.filename}</div>
                <div>{item.size}</div>
                <div>{item.extension}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <audio controls src={item.url} style={{ height: 32 }} />
                  <a href={item.url} download style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 8, textDecoration: 'none' }}>下载</a>
                  <a href={item.url} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 8, textDecoration: 'none' }}>直链</a>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <footer style={{ marginTop: 36, color: '#888', fontSize: 12 }}>
        接口基址：{apiBase || '(同源)'}
      </footer>
    </div>
  );
}


