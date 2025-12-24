const express = require('express');
const path = require('path');
const fs = require('fs');
const rangeParser = require('range-parser');
const bytes = require('bytes');
const NodeCache = require('node-cache');
const axios = require('axios');  
const { S3Client, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const app = express();
const PORT = process.env.PORT || 3000;

require('dotenv').config();

const ADMIN_PASSWORD = process.env.PASSWORD || 'admin';
const musicDir = path.join(__dirname, process.env.MUSIC_DIR || 'music');

const R2_BUCKET_NAME = 'music';
const AUDIO_EXTS = ['.mp3', '.flac', '.wav', '.aac', '.m4a', '.ogg', '.opus', '.webm'];

const GIT_BRANCH = 'main';
const GIT_PATH = process.env.GIT_PATH || 'music';
const GIT_PROXY_URL = process.env.GIT_URL;

const WEBDAV_PATH = process.env.WEBDAV_PATH || 'music';
const WEBDAV_URL = process.env.WEBDAV_URL;
const WEBDAV_USER = process.env.WEBDAV_USER;
const WEBDAV_PASS = process.env.WEBDAV_PASS;

function isAudioFile(name) {
  const lowerName = String(name || '').toLowerCase();
  return AUDIO_EXTS.some(ext => lowerName.endsWith(ext));
}

function getProxiedUrl(rawUrl) {
  if (!GIT_PROXY_URL || !rawUrl) {
    return rawUrl;
  }
  
  if (rawUrl.includes('raw.githubusercontent.com')) {
    const targetUrl = encodeURIComponent(rawUrl);
    return `${GIT_PROXY_URL}?url=${targetUrl}`;
  }
  
  return rawUrl;
}

async function fetchWithProxy(url, options = {}) {
  if (!GIT_PROXY_URL) {
    return axios.get(url, options);
  }
  
  if (url.includes('api.github.com') || url.includes('raw.githubusercontent.com')) {
    try {
      const directResponse = await axios.get(url, options);
      return directResponse;
    } catch (error) {
      if (error.response && error.response.status >= 400) {
        console.log(`Direct request failed (${error.response.status}), trying proxy...`);
      } else {
        console.log(`Direct request error: ${error.message}, trying proxy...`);
      }
      
      const targetUrl = encodeURIComponent(url);
      const proxiedUrl = `${GIT_PROXY_URL}?url=${targetUrl}`;
      
      const proxyOptions = {
        ...options,
        headers: {
          ...options.headers,
          'X-Target-URL': url,
          'X-Proxy-Type': 'github-api'
        }
      };
      
      console.log(`Using proxy: ${proxiedUrl}`);
      return axios.get(proxiedUrl, proxyOptions);
    }
  }
  
  return axios.get(url, options);
}

function buildBasicAuth(user, pass) {
  try {
    const credentials = Buffer.from(`${user}:${pass}`).toString('base64');
    return `Basic ${credentials}`;
  } catch (error) {
    return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }
}

function resolveMusicBase(base) {
  const b = String(base || '').replace(/\/+$/g, '');
  return `${b}/${WEBDAV_PATH}`;
}

function getR2Client() {
  const accountId = process.env.ACCOUNT_ID;
  const accessKeyId = process.env.ACCESS_KEY_ID;
  const secretAccessKey = process.env.SECRET_ACCESS_KEY;
  
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }
  
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir, { recursive: true });
  console.log(`Created music directory: ${musicDir}`);
}

function getContentType(ext) {
  const contentTypes = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

const cache = new NodeCache({ 
  stdTTL: 7200,
  checkperiod: 120,
  maxKeys: 500
});

const stats = {
  totalBytes: 0,
  requests: 0
};

app.set('json spaces', 2);

app.use('/static', express.static(musicDir));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/music/:filename', async (req, res) => {
  const filename = req.params.filename;
  
  if (!filename.match(/^[a-zA-Z0-9\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5\s\-_.]+\.(mp3|wav|flac|m4a)$/)) {
    return res.status(400).send('Invalid filename');
  }

  const normalizedPath = path.normalize(filename);
  if (normalizedPath.includes('..')) {
    return res.status(403).send('Access denied');
  }

  const filepath = path.join(musicDir, filename);

  let fileInfo = cache.get(filepath);
  if (!fileInfo) {
    try {
      const stat = await fs.promises.stat(filepath);
      fileInfo = {
        size: stat.size,
        mtime: stat.mtime.toUTCString(),
        exists: true
      };
      cache.set(filepath, fileInfo);
    } catch (err) {
      return res.status(404).send('File not found');
    }
  }

  const range = req.headers.range;

  res.set({
    'Cache-Control': 'public, max-age=3600',
    'Last-Modified': fileInfo.mtime,
    'Accept-Ranges': 'bytes',
    'Content-Type': getContentType(path.extname(filename).toLowerCase()),
    'Content-Disposition': 'inline; filename*=UTF-8\'\'' + encodeURIComponent(filename),
    'X-Content-Type-Options': 'nosniff'
  });

  if (range) {
    const ranges = rangeParser(fileInfo.size, range);
    
    if (ranges === -1 || ranges === -2) {
      return res.status(416).send('Range not satisfiable');
    }

    const { start, end } = ranges[0];
    const chunk = end - start + 1;

    res.status(206);
    res.set({
      'Content-Range': `bytes ${start}-${end}/${fileInfo.size}`,
      'Content-Length': chunk
    });

    const stream = fs.createReadStream(filepath, { 
      start, 
      end,
      highWaterMark: 64 * 1024
    });

    stats.totalBytes += chunk;
    stats.requests += 1;

    stream.on('error', (error) => {
      console.error(`Stream error for ${filename}:`, error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    });

    stream.pipe(res);
  } else {
    res.set({
      'Content-Length': fileInfo.size
    });

    const stream = fs.createReadStream(filepath, {
      highWaterMark: 64 * 1024
    });

    stats.totalBytes += fileInfo.size;
    stats.requests += 1;

    stream.on('error', (error) => {
      console.error(`Stream error for ${filename}:`, error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    });

    stream.pipe(res);
  }
});

app.get('/stats', (req, res) => {
  res.json({
    totalTransferred: bytes(stats.totalBytes),
    totalRequests: stats.requests
  });
});

app.get('/api/download', async (req, res) => {
  const { url, name } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'Please provide a music url' });
  }

  const urlFileName = decodeURIComponent(path.basename(url));
  const urlExt = path.extname(urlFileName).toLowerCase();

  if (!['.mp3', '.wav', '.flac', '.m4a'].includes(urlExt)) {
    return res.status(400).json({ error: 'Unsupported file format' });
  }

  const fullName = name ? (name + urlExt) : urlFileName;

  if (!fullName.match(/^[a-zA-Z0-9\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5\s\-_.]+\.(mp3|wav|flac|m4a)$/)) {
    return res.status(400).json({ error: 'filename is wrong' });
  }

  const savePath = path.join(musicDir, fullName);

  if (fs.existsSync(savePath)) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/music/${encodeURIComponent(fullName)}`;
    
    return res.status(200).json({
      warning: 'The song already exists',
      url: fileUrl
    });
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');

  res.json({
    success: true,
    message: 'The song added to download list successfully',
    filename: fullName,
    futureUrl: `${protocol}://${host}/music/${encodeURIComponent(fullName)}`,
  });

  try {
    const response = await axios({
      method: 'GET',
      url: url,
      timeout: 300000,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(savePath);

    response.data.pipe(writer);

    writer.on('error', (err) => {
      console.error(`Download error for ${fullName}:`, err.message);
      fs.unlink(savePath, () => {});
    });

    writer.on('finish', () => {
      console.log(`Download finished ${fullName}`);
    });
  } catch (error) {
    console.error(`Download failed for ${fullName}:`, error.message);
    fs.unlink(savePath, () => {});
  }
});

function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)}${units[unitIndex]}`;
}

app.get('/api/music/list', async (req, res) => {
  try {
    const files = await fs.promises.readdir(musicDir);
    const musicFiles = files.filter(file => 
      ['.mp3', '.wav', '.flac', '.m4a'].includes(path.extname(file).toLowerCase())
    );

    const currentUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const urlObj = new URL(currentUrl);
    const protocol = req.headers['x-forwarded-proto'] || urlObj.protocol;
    const host = urlObj.host;

    const musicList = await Promise.all(musicFiles.map(async file => {
      const filePath = path.join(musicDir, file);
      const stat = await fs.promises.stat(filePath);
      return {
        filename: file,
        url: `${protocol}://${host}/music/${encodeURIComponent(file)}`,
        size: formatFileSize(stat.size),
        extension: path.extname(file).slice(1).toUpperCase(),
        lastModified: stat.mtime.toLocaleString()
      };
    }));

    res.json({
      total: musicList.length,
      data: musicList
    });
  } catch (error) {
    res.status(500).json({
      error: 'Get music list failed',
      details: error.message
    });
  }
});

app.get('/api/r2/list', async (req, res) => {
  try {
    const r2Client = getR2Client();
    if (!r2Client) {
      return res.status(500).json({ 
        error: 'R2存储桶未配置',
        message: '请设置环境变量 ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY'
      });
    }
    
    const command = new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME });
    const response = await r2Client.send(command);
    
    const objects = response.Contents || [];
    const audioFiles = objects
      .filter(obj => {
        const name = (obj.Key || '').toLowerCase();
        return AUDIO_EXTS.some(ext => name.endsWith(ext));
      })
      .map(obj => {
        const name = obj.Key || '';
        const base = name.replace(/\.[^.]+$/, '');
        const title = base.replace(/\s*-\s*/g, ' - ').replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim() || name;
        
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const fileUrl = `${protocol}://${host}/api/r2/stream?key=${encodeURIComponent(name)}`;
        
        return {
          filename: name,
          url: fileUrl,
          size: formatFileSize(obj.Size || 0),
          extension: path.extname(name).slice(1).toUpperCase()
        };
      });
    
    res.json({
      total: audioFiles.length,
      data: audioFiles
    });
  } catch (error) {
    console.error('R2 歌单获取错误:', error);
    res.status(500).json({ 
      error: '获取R2歌单失败',
      details: error.message 
    });
  }
});

app.get('/api/r2/stream', async (req, res) => {
  try {
    const { key } = req.query;
    
    if (!key) {
      return res.status(400).json({ error: '缺少 key 参数' });
    }
    
    const r2Client = getR2Client();
    if (!r2Client) {
      return res.status(500).json({ 
        error: 'R2存储桶未配置',
        message: '请设置环境变量 ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY'
      });
    }
    
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key
      });
      
      let contentType = 'audio/mpeg';
      let contentLength = 0;
      
      try {
        const headResponse = await r2Client.send(headCommand);
        contentType = headResponse.ContentType || 'audio/mpeg';
        contentLength = headResponse.ContentLength || 0;
      } catch (headError) {
        if (headError.name === 'NotFound') {
          return res.status(404).json({ error: '文件不存在' });
        }
        throw headError;
      }
      
      const fileNameLower = key.toLowerCase();
      if (fileNameLower.endsWith('.mp3')) contentType = 'audio/mpeg';
      else if (fileNameLower.endsWith('.wav')) contentType = 'audio/wav';
      else if (fileNameLower.endsWith('.flac')) contentType = 'audio/flac';
      else if (fileNameLower.endsWith('.aac')) contentType = 'audio/aac';
      else if (fileNameLower.endsWith('.m4a')) contentType = 'audio/mp4';
      else if (fileNameLower.endsWith('.ogg')) contentType = 'audio/ogg';
      else if (fileNameLower.endsWith('.opus')) contentType = 'audio/opus';
      else if (fileNameLower.endsWith('.webm')) contentType = 'audio/webm';
      
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : contentLength - 1;
          
          const getCommand = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Range: `bytes=${start}-${end}`
          });
          
          const objectResponse = await r2Client.send(getCommand);
          const chunks = [];
          for await (const chunk of objectResponse.Body) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${contentLength}`);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          
          return res.status(206).send(buffer);
        }
      }
      
      const getCommand = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key
      });
      
      const objectResponse = await r2Client.send(getCommand);
      const chunks = [];
      for await (const chunk of objectResponse.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('R2 文件获取错误:', error);
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        return res.status(404).json({ error: '文件不存在' });
      }
      return res.status(500).json({ 
        error: '获取文件失败',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('R2 流式传输错误:', error);
    res.status(500).json({ 
      error: 'R2 流式传输失败',
      details: error.message 
    });
  }
});

app.get('/api/webdav/list', async (req, res) => {
  try {
    if (!WEBDAV_URL || !WEBDAV_USER || !WEBDAV_PASS) {
      return res.status(500).json({ 
        error: 'WebDAV未配置',
        message: '请设置环境变量 WEBDAV_URL, WEBDAV_USER, WEBDAV_PASS'
      });
    }
    
    const url = resolveMusicBase(WEBDAV_URL).replace(/\/+$/g, '') + '/';
    
    try {
      const response = await axios({
        method: 'PROPFIND',
        url: url,
        headers: {
          'Depth': '1',
          'Authorization': buildBasicAuth(WEBDAV_USER, WEBDAV_PASS),
          'Content-Type': 'application/xml'
        },
        responseType: 'text'
      });
      
      const text = response.data;
      const hrefs = [];
      const hrefRegex = /<\s*[^:>]*:?href\s*>\s*([^<]+)\s*<\s*\/\s*[^:>]*:?href\s*>/ig;
      let match;
      while ((match = hrefRegex.exec(text)) !== null) {
        hrefs.push(match[1]);
      }
      
      const audioFiles = [];
      const base = new URL(url);
      const basePathname = base.pathname.replace(/\/+$/g, '') || '/';
      
      for (const href of hrefs) {
        try {
          const u = new URL(href, base);
          let pathname = decodeURIComponent(u.pathname);
          pathname = pathname.replace(/\/+$/g, '');
          
          if (!pathname || pathname === basePathname || pathname === basePathname + '/') {
            continue;
          }
          
          if (!pathname.startsWith(basePathname)) {
            continue;
          }
          
          const relativePath = pathname.substring(basePathname.length);
          const segs = relativePath.split('/').filter(Boolean);
          const filename = segs.pop() || '';
          
          if (!filename) {
            continue;
          }
          
          if (isAudioFile(filename)) {
            const baseName = filename.replace(/\.[^.]+$/, '');
            const title = baseName.replace(/\s*-\s*/g, ' - ').replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim() || filename;
            
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const host = req.get('host');
            const fileUrl = `${protocol}://${host}/api/webdav/stream?path=${encodeURIComponent(pathname)}`;
            
            audioFiles.push({
              filename: filename,
              url: fileUrl,
              size: '0 B',
              extension: path.extname(filename).slice(1).toUpperCase()
            });
          }
        } catch (e) {
          continue;
        }
      }
      
      res.json({
        total: audioFiles.length,
        data: audioFiles
      });
    } catch (error) {
      console.error('WebDAV PROPFIND 错误:', error);
      
      if (error.response) {
        const status = error.response.status;
        let errorDetails = `WebDAV 错误: ${status}`;
        
        if (status === 401) {
          errorDetails = 'WebDAV 认证失败，请检查用户名和密码';
        } else if (status === 403) {
          errorDetails = 'WebDAV 访问被拒绝';
        } else if (status === 404) {
          errorDetails = 'WebDAV 路径不存在';
        }
        
        return res.status(status).json({ 
          error: errorDetails,
          details: error.response.data || error.message
        });
      }
      
      throw error;
    }
  } catch (error) {
    console.error('WebDAV 歌单获取错误:', error);
    res.status(500).json({ 
      error: '获取WebDAV歌单失败',
      details: error.message 
    });
  }
});

async function fetchWebdavWithProxy(options = {}) {
  if (!GIT_PROXY_URL) {
    return axios(options);
  }
  
  const url = options.url;
  if (!url) {
    return axios(options);
  }
  
  try {
    const directResponse = await axios(options);
    return directResponse;
  } catch (error) {
    if (error.response && error.response.status >= 400) {
      console.log(`[webdav] Direct request failed (${error.response.status}), trying proxy...`);
    } else {
      console.log(`[webdav] Direct request error: ${error.message}, trying proxy...`);
    }
    
    const targetUrl = encodeURIComponent(url);
    const proxiedUrl = `${GIT_PROXY_URL}?url=${targetUrl}`;
    
    const proxyOptions = {
      ...options,
      url: proxiedUrl,
      headers: {
        ...options.headers,
        'X-Target-URL': url,
        'X-Proxy-Type': 'webdav',
        'Authorization': options.headers?.['Authorization'] || buildBasicAuth(WEBDAV_USER, WEBDAV_PASS)
      }
    };
    
    console.log(`[webdav] Using proxy: ${proxiedUrl}`);
    return axios(proxyOptions);
  }
}

app.get('/api/webdav/stream', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    
    if (!filePath) {
      return res.status(400).json({ error: '缺少 path 参数' });
    }
    
    if (!WEBDAV_URL || !WEBDAV_USER || !WEBDAV_PASS) {
      return res.status(500).json({ 
        error: 'WebDAV未配置',
        message: '请设置环境变量 WEBDAV_URL, WEBDAV_USER, WEBDAV_PASS'
      });
    }
    
    let webdavUrl;
    if (filePath.startsWith('http')) {
      webdavUrl = filePath;
    } else {
      const webdavBaseUrl = new URL(WEBDAV_URL);
      const webdavBasePath = webdavBaseUrl.pathname.replace(/\/+$/g, '') || '/';
      
      let normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
      
      if (normalizedPath.startsWith(webdavBasePath)) {
        webdavUrl = `${webdavBaseUrl.origin}${normalizedPath}`;
      } else {
        if (!normalizedPath.startsWith('/')) {
          normalizedPath = '/' + normalizedPath;
        }
        webdavUrl = `${webdavBaseUrl.origin}${webdavBasePath}${normalizedPath}`;
      }
    }
    
    try {
      let contentLength = 0;
      let contentType = 'audio/mpeg';
      
      try {
        const headResponse = await fetchWebdavWithProxy({
          method: 'HEAD',
          url: webdavUrl,
          headers: {
            'Authorization': buildBasicAuth(WEBDAV_USER, WEBDAV_PASS)
          }
        });
        
        contentLength = parseInt(headResponse.headers['content-length'] || '0', 10);
        contentType = headResponse.headers['content-type'] || 'audio/mpeg';
      } catch (headError) {
        console.log('WebDAV HEAD 请求失败，将使用 GET 请求:', headError.message);
      }
      
      const fileNameLower = filePath.toLowerCase();
      if (fileNameLower.endsWith('.mp3')) contentType = 'audio/mpeg';
      else if (fileNameLower.endsWith('.wav')) contentType = 'audio/wav';
      else if (fileNameLower.endsWith('.flac')) contentType = 'audio/flac';
      else if (fileNameLower.endsWith('.aac')) contentType = 'audio/aac';
      else if (fileNameLower.endsWith('.m4a')) contentType = 'audio/mp4';
      else if (fileNameLower.endsWith('.ogg')) contentType = 'audio/ogg';
      else if (fileNameLower.endsWith('.opus')) contentType = 'audio/opus';
      else if (fileNameLower.endsWith('.webm')) contentType = 'audio/webm';
      
      const rangeHeader = req.headers.range;
      if (rangeHeader && contentLength > 0) {
        const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1], 10);
          const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : contentLength - 1;
          
          const rangeResponse = await fetchWebdavWithProxy({
            method: 'GET',
            url: webdavUrl,
            headers: {
              'Authorization': buildBasicAuth(WEBDAV_USER, WEBDAV_PASS),
              'Range': `bytes=${start}-${end}`
            },
            responseType: 'arraybuffer'
          });
          
          const buffer = Buffer.from(rangeResponse.data);
          
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${contentLength}`);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          
          return res.status(206).send(buffer);
        }
      }
      
      const getResponse = await fetchWebdavWithProxy({
        method: 'GET',
        url: webdavUrl,
        headers: {
          'Authorization': buildBasicAuth(WEBDAV_USER, WEBDAV_PASS)
        },
        responseType: 'arraybuffer'
      });
      
      const buffer = Buffer.from(getResponse.data);
      const actualLength = buffer.length;
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', actualLength);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('WebDAV 文件获取错误:', error);
      
      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          return res.status(401).json({ error: 'WebDAV 认证失败' });
        } else if (status === 404) {
          return res.status(404).json({ error: '文件不存在' });
        }
      }
      
      return res.status(500).json({ 
        error: '获取文件失败',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('WebDAV 流式传输错误:', error);
    res.status(500).json({ 
      error: 'WebDAV 流式传输失败',
      details: error.message 
    });
  }
});

app.get('/api/github/list', async (req, res) => {
  try {
    const repoFull = process.env.GIT_REPO;
    const token = process.env.GIT_TOKEN;
    
    if (!repoFull) {
      return res.status(500).json({ 
        error: 'GitHub仓库未配置',
        message: '请设置环境变量 GIT_REPO'
      });
    }
    
    if (!token) {
      return res.status(500).json({ 
        error: 'GitHub Token未配置',
        message: '请设置环境变量 GIT_TOKEN'
      });
    }
    
    const [owner, repo] = String(repoFull).split('/');
    
    if (!owner || !repo) {
      return res.status(400).json({ 
        error: 'GIT_REPO 格式无效',
        details: 'GIT_REPO 应为 "owner/repo" 格式',
        provided: repoFull
      });
    }
    
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${GIT_PATH}?ref=${encodeURIComponent(GIT_BRANCH)}`;
    
    try {
      const response = await fetchWithProxy(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'Player'
        }
      });
      
      const items = Array.isArray(response.data) ? response.data : [];
      const audioFiles = items.filter(item => item && item.type === 'file' && isAudioFile(item.name));
      
      const musicList = audioFiles.map(item => {
        const filename = item.name || '';
        const rawUrl = item.download_url || 
          `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(GIT_BRANCH)}/${GIT_PATH}/${encodeURIComponent(filename)}`;
        
        const finalUrl = getProxiedUrl(rawUrl);
        
        return {
          filename: filename,
          url: finalUrl,
          size: formatFileSize(item.size || 0),
          extension: path.extname(filename).slice(1).toUpperCase()
        };
      });
      
      res.json({
        total: musicList.length,
        data: musicList
      });
    } catch (error) {
      console.error('GitHub API 错误:', error);
      
      if (error.response) {
        const status = error.response.status;
        let errorDetails = `GitHub API 错误: ${status}`;
        
        if (status === 401) {
          errorDetails = 'GitHub Token 无效或已过期';
        } else if (status === 403) {
          errorDetails = 'GitHub Token 缺少仓库访问权限';
        } else         if (status === 404) {
          errorDetails = `仓库不存在或 ${GIT_PATH} 目录不存在`;
        }
        
        return res.status(status).json({ 
          error: errorDetails,
          details: error.response.data?.message || error.message
        });
      }
      
      throw error;
    }
  } catch (error) {
    console.error('GitHub 歌单获取错误:', error);
    res.status(500).json({ 
      error: '获取GitHub歌单失败',
      details: error.message 
    });
  }
});

app.post('/api/delete/music', async (req, res) => {
  const { names, password, all } = req.query;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Invalid password' });
  }

  try {
    let filesToDelete = [];
    
    if (all === 'true') {
      const files = await fs.promises.readdir(musicDir);
      filesToDelete = files.filter(file => 
        ['.mp3', '.wav', '.flac', '.m4a'].includes(path.extname(file).toLowerCase())
      );
    } 
    else if (names) {
      const nameList = typeof names === 'string' ? names.split(',') : names;
      const files = await fs.promises.readdir(musicDir);
      
      filesToDelete = files.filter(file => {
        const filenameWithoutExt = path.basename(file, path.extname(file));
        const songNamePart = filenameWithoutExt.split('-')[0].trim().toLowerCase();
        return nameList.some(name => 
          songNamePart === name.trim().toLowerCase() && 
          ['.mp3', '.wav', '.flac', '.m4a'].includes(path.extname(file).toLowerCase())
        );
      });
    } 
    else {
      return res.status(400).json({ error: 'Please provide names parameter or set all=true' });
    }

    if (filesToDelete.length === 0) {
      return res.status(404).json({ error: 'No matching songs found' });
    }

    await Promise.all(filesToDelete.map(async file => {
      const filePath = path.join(musicDir, file);
      await fs.promises.unlink(filePath);
      cache.del(filePath);
    }));

    res.json({
      success: true,
      message: `Deleted ${filesToDelete.length} song(s)`,
      deletedFiles: filesToDelete
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete song(s)',
      details: error.message
    });
  }
});

function formatGistJson(data) {
  const indent = '                     ';
  let result = '{"favorites":[\n';
  
  if (Array.isArray(data.favorites) && data.favorites.length > 0) {
    const favoritesLines = data.favorites.map((item, index) => {
      const comma = index < data.favorites.length - 1 ? ',' : '';
      return `${indent}${JSON.stringify(item)}${comma}`;
    });
    result += favoritesLines.join('\n');
  }
  
  result += '\n]}';
  return result;
}

async function fetchWithProxyForGist(url, options = {}) {
  if (!GIT_PROXY_URL) {
    return axios(url, options);
  }
  
  if (url.includes('api.github.com') || url.includes('raw.githubusercontent.com')) {
    try {
      const directResponse = await axios(url, options);
      return directResponse;
    } catch (error) {
      if (error.response && error.response.status >= 400) {
        console.log(`[gist] Direct request failed (${error.response.status}), trying proxy...`);
      } else {
        console.log(`[gist] Direct request error: ${error.message}, trying proxy...`);
      }
      
      const targetUrl = encodeURIComponent(url);
      const proxiedUrl = `${GIT_PROXY_URL}?url=${targetUrl}`;
      
      const proxyOptions = {
        ...options,
        headers: {
          ...options.headers,
          'X-Target-URL': url,
          'X-Proxy-Type': 'github-gist'
        }
      };
      
      console.log(`[gist] Using proxy: ${proxiedUrl}`);
      return axios(proxiedUrl, proxyOptions);
    }
  }
  
  return axios(url, options);
}

async function findOrCreateGist(token) {
  const GIST_DESCRIPTION = 'Music';
  const GIST_FILENAME = 'music.json';
  
  try {
    const listRes = await fetchWithProxyForGist('https://api.github.com/gists', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'web-music-player/0.1'
      }
    });
    
    if (listRes.status === 200) {
      const gists = Array.isArray(listRes.data) ? listRes.data : [];
      const found = gists.find(g => {
        return g.description === GIST_DESCRIPTION && 
               g.files && 
               g.files[GIST_FILENAME];
      });
      
      if (found) {
        return found.id;
      }
    } else {
      const errorText = listRes.data || '';
      try {
        const errorJson = typeof errorText === 'string' ? JSON.parse(errorText) : errorText;
        if (errorJson && errorJson.message && errorJson.message.includes('API rate limit exceeded')) {
          throw new Error('GitHub API 速率限制：请求过于频繁，请稍后再试。如果已配置 GIT_TOKEN，请确保使用有效的 GitHub Token 以提高速率限制。');
        }
      } catch (e) {
        if (e.message && e.message.includes('GitHub API 速率限制')) {
          throw e;
        }
      }
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      throw new Error('GitHub Token 无效或已过期');
    }
    if (error.message && error.message.includes('GitHub API 速率限制')) {
      throw error;
    }
    console.log('获取 Gist 列表失败，将创建新的 Gist:', error.message);
  }
  
  const defaultContent = {
    favorites: []
  };
  
  try {
    const createRes = await fetchWithProxyForGist('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'web-music-player/0.1'
      },
      data: {
        description: GIST_DESCRIPTION,
        public: false,
        files: {
          [GIST_FILENAME]: {
            content: formatGistJson(defaultContent)
          }
        }
      }
    });
    
    if (createRes.status === 201) {
      return createRes.data.id;
    } else {
      const errorText = createRes.data || '';
      let errorMessage = typeof errorText === 'string' ? errorText : JSON.stringify(errorText);
      
      try {
        const errorJson = typeof errorText === 'string' ? JSON.parse(errorText) : errorText;
        if (errorJson && errorJson.message && errorJson.message.includes('API rate limit exceeded')) {
          errorMessage = 'GitHub API 速率限制：请求过于频繁，请稍后再试。如果已配置 GIT_TOKEN，请确保使用有效的 GitHub Token 以提高速率限制。';
        }
      } catch {
      }
      
      throw new Error(`创建 Gist 失败: ${createRes.status} ${errorMessage}`);
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      throw new Error('GitHub Token 无效或已过期');
    }
    throw error;
  }
}

app.post('/api/gist/favorites', async (req, res) => {
  try {
    const { action, favorites } = req.body;
    
    if (!action || (action !== 'save' && action !== 'load')) {
      return res.status(400).json({ 
        error: '无效的操作，必须是 "save" 或 "load"' 
      });
    }
    
    const token = process.env.GIT_TOKEN;
    if (!token) {
      return res.status(500).json({ 
        error: '服务器未配置: 缺少 GIT_TOKEN' 
      });
    }
    
    const GIST_FILENAME = 'music.json';
    const gistId = await findOrCreateGist(token);
    
    const getRes = await fetchWithProxyForGist(`https://api.github.com/gists/${gistId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'web-music-player/0.1'
      }
    });
    
    if (getRes.status !== 200) {
      const errorText = getRes.data || '';
      let errorMessage = typeof errorText === 'string' ? errorText : JSON.stringify(errorText);
      
      try {
        const errorJson = typeof errorText === 'string' ? JSON.parse(errorText) : errorText;
        if (errorJson && errorJson.message && errorJson.message.includes('API rate limit exceeded')) {
          errorMessage = 'GitHub API 速率限制：请求过于频繁，请稍后再试。如果已配置 GIT_TOKEN，请确保使用有效的 GitHub Token 以提高速率限制。';
        }
      } catch {
      }
      
      return res.status(getRes.status || 500).json({ 
        error: `获取 Gist 失败: ${errorMessage}` 
      });
    }
    
    const gist = getRes.data;
    const file = gist.files[GIST_FILENAME];
    const sha = file ? file.sha : null;
    
    let currentData = { favorites: [] };
    if (file && file.content) {
      try {
        const parsed = JSON.parse(file.content);
        if (Array.isArray(parsed)) {
          currentData.favorites = parsed;
        } else if (typeof parsed === 'object' && parsed.favorites) {
          currentData.favorites = Array.isArray(parsed.favorites) ? parsed.favorites : [];
        }
      } catch (e) {
        console.error('解析 Gist 内容失败:', e);
      }
    }
    
    if (action === 'save') {
      if (!Array.isArray(favorites)) {
        return res.status(400).json({ 
          error: '无效的收藏列表，必须是一个数组' 
        });
      }
      
      const updatedData = {
        favorites: favorites
      };
      
      const updateRes = await fetchWithProxyForGist(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'web-music-player/0.1'
        },
        data: {
          files: {
            [GIST_FILENAME]: {
              content: formatGistJson(updatedData),
              sha: sha
            }
          }
        }
      });
      
      if (updateRes.status !== 200) {
        const errorText = updateRes.data || '';
        let errorMessage = typeof errorText === 'string' ? errorText : JSON.stringify(errorText);
        
        try {
          const errorJson = typeof errorText === 'string' ? JSON.parse(errorText) : errorText;
          if (errorJson && errorJson.message && errorJson.message.includes('API rate limit exceeded')) {
            errorMessage = 'GitHub API 速率限制：请求过于频繁，请稍后再试。如果已配置 GIT_TOKEN，请确保使用有效的 GitHub Token 以提高速率限制。';
          }
        } catch {
        }
        
        return res.status(updateRes.status || 500).json({ 
          error: `更新 Gist 失败: ${errorMessage}` 
        });
      }
      
      return res.json({ ok: true, gistId });
    } else if (action === 'load') {
      return res.json({ 
        ok: true, 
        favorites: currentData.favorites || [], 
        gistId 
      });
    }
  } catch (error) {
    console.error('Gist 操作错误:', error);
    return res.status(500).json({ 
      error: error.message || 'Gist 操作失败' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`music service is running on port ${PORT}`);
});
