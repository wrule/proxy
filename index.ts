import axios from 'axios';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

let cookie = '';

const http = () => axios.create({
  baseURL: `http://10.10.30.103:8081/api`,
  headers: { cookie },
});

const httpPaaS = () => axios.create({
  baseURL: `http://10.10.30.103:8083/api`,
  headers: { cookie },
});

const app = express();

app.use('/test', express.json(), (req: Request, res: Response) => {
  res.json(req.body);
});

app.use('/detail', express.json(), async (req: Request, res: Response) => {
  const type = req.body?.type ?? '';
  const keywords = req.body?.keywords ?? '';
  if (type === 'SCRIPT') {
    const script = (await vectorQuery(type, keywords))[0];
    const [{ data: meta }, { data: detail }] = await Promise.all([
      http().post(`xsea/script/query`, { scriptId: script.data.scriptId, workspaceId: script.data.productId }),
      http().post(`xsea/script/queryDetail`, { scriptId: script.data.scriptId, workspaceId: script.data.productId }),
    ]);
    res.json({
      success: true,
      prompt: `请向用户简要解释 detail 字段内的关键信息，200字以内`,
      detail: { meta, detail },
    });
  } else if (type === 'RECORD') {
    const record = (await vectorQuery(type, keywords))[0];
    res.json({
      success: true,
      prompt: `请向用户简要解释 detail 字段内的关键信息`,
      detail: record,
    });
  } else {
    res.json({
      success: false,
      prompt: `暂时不支持查看 ${type} 详情，请用中文向用户解释`,
    });
  }
});

app.use('/run/script', express.json(), (req: Request, res: Response) => {
  // 脚本搜索关键字
  const keywords = req.body?.keywords ?? '';
  // 持续时长，默认两分钟
  const duration = req.body?.duration ?? 60 * 2;
  // 最大并发，默认100
  const maxUserNum = req.body?.maxUserNum ?? 100;
  res.json(req.body);
});

app.use('/run/goal', express.json(), (req: Request, res: Response) => {
  // 目标搜索关键词
  const keywords = req.body?.keywords ?? '';
  res.json(req.body);
});

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  req.headers.cookie = cookie;
  next();
});

const proxyMiddleware = createProxyMiddleware<Request, Response>({
  target: 'http://10.10.30.103:8081/api',
  changeOrigin: true,
});

app.use('/api', proxyMiddleware);

async function updateCookie() {
  const res = await httpPaaS().post(`paas/users/login`, {
    loginType: "USERNAME",
    password: "8AoKBvcXDBCI/ogMgvNQNg==",
    sessionId: "",
    sig: "",
    token: "",
    userName: "admin",
  });
  cookie = (res.headers['set-cookie'] ?? []).map((item) => item.split(';')[0]).join('; ');
  console.log(cookie);
}

async function vectorQuery(type: string, keywords: string) {
  const { data } = await http().post(`xsea/vector/query`, { type, text: keywords });
  const result: any[] = data.object ?? [];
  return result;
}

async function main() {
  await updateCookie();
  app.listen(3000);
  console.log('app.listen(3000)...');
}

main();
