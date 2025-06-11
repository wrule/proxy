import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  console.log(req.url, req.body);
  req.headers.cookie = 'sys_token=13e2ad0f65574cc497759e121573de67; sys_env_id=822313712173449216; sys_env_code=Init';
  next();
});

const proxyMiddleware = createProxyMiddleware<Request, Response>({
  target: 'http://10.10.30.103:8081/api',
  changeOrigin: true,
});

app.use('/api', proxyMiddleware);

app.listen(3000);
