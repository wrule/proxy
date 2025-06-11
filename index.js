"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const express_1 = __importDefault(require("express"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
let cookie = '';
const app = (0, express_1.default)();
app.use('/test', express_1.default.json(), (req, res) => {
    res.json(req.body);
});
app.use('/detail', express_1.default.json(), (req, res) => {
    var _a, _b, _c, _d;
    const type = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.type) !== null && _b !== void 0 ? _b : '';
    const keywords = (_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.keywords) !== null && _d !== void 0 ? _d : '';
    if (type === 'SCRIPT') {
        res.json({
            success: true,
            prompt: `暂时不支持查看 ${type} 详情，请用中文向用户解释`,
        });
    }
    else if (type === 'RECORD') {
        res.json({
            success: true,
            prompt: `暂时不支持查看 ${type} 详情，请用中文向用户解释`,
        });
    }
    else {
        res.json({
            success: false,
            prompt: `暂时不支持查看 ${type} 详情，请用中文向用户解释`,
        });
    }
});
app.use('/run/script', express_1.default.json(), (req, res) => {
    res.json(req.body);
});
app.use('/run/goal', express_1.default.json(), (req, res) => {
    res.json(req.body);
});
app.use('/api', (req, res, next) => {
    req.headers.cookie = cookie;
    next();
});
const proxyMiddleware = (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: 'http://10.10.30.103:8081/api',
    changeOrigin: true,
});
app.use('/api', proxyMiddleware);
function updateCookie() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const res = yield axios_1.default.post(`http://10.10.30.103:8083/api/paas/users/login`, {
            loginType: "USERNAME",
            password: "8AoKBvcXDBCI/ogMgvNQNg==",
            sessionId: "",
            sig: "",
            token: "",
            userName: "admin",
        });
        cookie = ((_a = res.headers['set-cookie']) !== null && _a !== void 0 ? _a : []).map((item) => item.split(';')[0]).join('; ');
        console.log(cookie);
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield updateCookie();
        app.listen(3000);
        console.log('app.listen(3000)...');
    });
}
main();
