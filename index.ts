import axios from 'axios';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

let cookie = '';

const app = express();

app.use('/test', express.json(), (req: Request, res: Response) => {
  res.json(req.body);
});

app.use('/detail', express.json(), (req: Request, res: Response) => {
  const { type, keywords } = req.body;
  if (type === 'SCRIPT') {
    res.json({
      success: true,
      prompt: `暂时不支持查看 ${type} 详情，请用中文向用户解释`,
    });
  } else if (type === 'RECORD') {
    res.json({
      success: true,
      prompt: `暂时不支持查看 ${type} 详情，请用中文向用户解释`,
    });
  } else {
    res.json({
      success: false,
      prompt: `暂时不支持查看 ${type} 详情，请用中文向用户解释`,
    });
  }
});

app.use('/run/script', express.json(), (req: Request, res: Response) => {
  res.json(req.body);
});

app.use('/run/goal', express.json(), (req: Request, res: Response) => {
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
  const res = await axios.post(`http://10.10.30.103:8083/api/paas/users/login`, {
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

async function main() {
  await updateCookie();
  app.listen(3000);
  console.log('app.listen(3000)...');
}

main();
