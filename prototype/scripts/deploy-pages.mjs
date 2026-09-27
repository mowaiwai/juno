import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'mowaiwai';
const REPO = 'juno';
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

async function api(path, method = 'GET', body) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`https://api.github.com${path}`, opts);
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

// 如果仓库为空，先用 Contents API 初始化 main 分支
async function initMain() {
  try {
    await api(`/repos/${OWNER}/${REPO}/git/refs/heads/main`);
    console.log('main 分支已存在');
  } catch {
    const readme = Buffer.from('# Juno\n\nAI+HR SaaS 高保真可点击原型（React 18 + Vite + TS + AntD 5 + ECharts + Zustand，纯前端 mock）。\n\n在线预览：https://mowaiwai.github.io/juno/\n').toString('base64');
    const result = await api(`/repos/${OWNER}/${REPO}/contents/README.md`, 'PUT', {
      message: 'init: README',
      content: readme,
    });
    console.log('main 已初始化，commit:', result.commit.sha.slice(0, 7));
  }
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

async function deploy() {
  await initMain();

  const files = walk(DIST);
  console.log(`上传 ${files.length} 个文件...`);

  const entries = [];
  for (const abs of files) {
    const rel = relative(DIST, abs).split(sep).join('/');
    const blob = await api(`/repos/${OWNER}/${REPO}/git/blobs`, 'POST', {
      content: readFileSync(abs).toString('base64'),
      encoding: 'base64',
    });
    entries.push({ path: rel, mode: '100644', type: 'blob', sha: blob.sha });
    console.log('  blob', rel);
  }

  const tree = await api(`/repos/${OWNER}/${REPO}/git/trees`, 'POST', { tree: entries });
  const commit = await api(`/repos/${OWNER}/${REPO}/git/commits`, 'POST', {
    message: 'deploy: GitHub Pages',
    tree: tree.sha,
    parents: [],
  });

  try {
    await api(`/repos/${OWNER}/${REPO}/git/refs`, 'POST', { ref: 'refs/heads/gh-pages', sha: commit.sha });
    console.log('已创建 gh-pages 分支');
  } catch {
    await api(`/repos/${OWNER}/${REPO}/git/refs/heads/gh-pages`, 'PATCH', { sha: commit.sha, force: true });
    console.log('已更新 gh-pages 分支');
  }

  try {
    await api(`/repos/${OWNER}/${REPO}/pages`, 'POST', { source: { branch: 'gh-pages', path: '/' } });
    console.log('已开启 GitHub Pages');
  } catch {
    console.log('Pages 可能已开启');
  }

  console.log(`完成 -> https://${OWNER}.github.io/${REPO}/`);
}

deploy().catch(e => { console.error(e); process.exit(1); });
