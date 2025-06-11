"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const app = (0, express_1.default)();
app.use('/api', (req, res, next) => {
    console.log(req.url, req.body);
    req.headers.cookie = 'sys_token=13e2ad0f65574cc497759e121573de67; sys_env_id=822313712173449216; sys_env_code=Init';
    next();
});
const proxyMiddleware = (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: 'http://10.10.30.103:8081/api',
    changeOrigin: true,
});
app.use('/api', proxyMiddleware);
app.listen(3000);
