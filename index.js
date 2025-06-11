"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const app = (0, express_1.default)();
const proxyMiddleware = (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: 'http://www.example.org/api',
    changeOrigin: true,
});
app.use('/api', proxyMiddleware);
app.listen(3000);
