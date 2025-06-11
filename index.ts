import axios from 'axios';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

app.use('/test', express.json(), (req: Request, res: Response) => {
  res.json(req.body);
});

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  req.headers.cookie = 'sys_token=13e2ad0f65574cc497759e121573de67; sys_env_id=822313712173449216; sys_env_code=Init';
  next();
});

const proxyMiddleware = createProxyMiddleware<Request, Response>({
  target: 'http://10.10.30.103:8081/api',
  changeOrigin: true,
});

app.use('/api', proxyMiddleware);

app.listen(3000);

async function loginGetCookie() {
  const res = await axios.post(`http://10.10.30.103:8083/api/paas/users/login`, {
    loginType: "USERNAME",
    password: "8AoKBvcXDBCI/ogMgvNQNg==",
    sessionId: "",
    sig: "",
    token: "",
    userName: "admin",
  });
  return (res.headers['set-cookie'] ?? []).map((item) => item.split(';')[0]).join('; ');
}

async function main() {
  console.log(await loginGetCookie());
}

main();
