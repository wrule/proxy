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
const http = () => axios_1.default.create({
    baseURL: `http://10.10.30.103:8081/api`,
    headers: { cookie },
});
const httpPaaS = () => axios_1.default.create({
    baseURL: `http://10.10.30.103:8083/api`,
    headers: { cookie },
});
const app = (0, express_1.default)();
app.use('/test', express_1.default.json(), (req, res) => {
    res.json(req.body);
});
app.use('/detail', express_1.default.json(), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const type = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.type) !== null && _b !== void 0 ? _b : '';
    const keywords = (_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.keywords) !== null && _d !== void 0 ? _d : '';
    if (type === 'SCRIPT') {
        const script = (yield vectorQuery(type, keywords))[0];
        const [{ data: meta }, { data: detail }] = yield Promise.all([
            http().post(`xsea/script/query`, { scriptId: script.data.scriptId, workspaceId: script.data.productId }),
            http().post(`xsea/script/queryDetail`, { scriptId: script.data.scriptId, workspaceId: script.data.productId }),
        ]);
        res.json({
            success: true,
            prompt: `请向用户简要解释 detail 字段内的关键信息，200字以内`,
            detail: { meta, detail },
        });
    }
    else if (type === 'RECORD') {
        const record = (yield vectorQuery(type, keywords))[0];
        const [{ data: detail }] = yield Promise.all([
            http().post(`xsea/report/query`, { id: record.data.recordId, workspaceId: record.data.productId }),
        ]);
        res.json({
            success: true,
            prompt: `请向用户简要解释 detail 字段内的关键信息`,
            detail,
        });
    }
    else {
        res.json({
            success: false,
            prompt: `暂时不支持查看 ${type} 详情，请用中文向用户解释`,
        });
    }
}));
app.use('/run/script', express_1.default.json(), (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    // 脚本搜索关键字
    const keywords = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.keywords) !== null && _b !== void 0 ? _b : '';
    // 持续时长，默认两分钟
    const duration = (_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.duration) !== null && _d !== void 0 ? _d : 60 * 2;
    // 最大并发，默认100
    const maxUserNum = (_f = (_e = req.body) === null || _e === void 0 ? void 0 : _e.maxUserNum) !== null && _f !== void 0 ? _f : 100;
    res.json(req.body);
});
app.use('/run/goal', express_1.default.json(), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // 目标搜索关键词
    const keywords = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.keywords) !== null && _b !== void 0 ? _b : '';
    const goal = (yield vectorQuery('GOAL', keywords))[0];
    console.log(goal);
    const { data } = yield http().post(`xsea/sceneExec/start`, {
        flag: false,
        envId: '822313712173449216',
        workspaceId: goal.data.productId,
        planId: goal.data.planId,
        goalId: goal.data.goalId,
        id: goal.data.sceneId,
    });
    const execId = data.object;
    res.json({
        success: true,
        prompt: `目标执行成功，请以markdown url的形式引导用户查看压测监控，[${goal.data.goalName}压测监控页面](http://10.10.30.103:8081/${822313712173449216}/product/business/${goal.data.productId}/plan/targetExecute?sceneExecId=${execId})`,
    });
}));
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
        const res = yield httpPaaS().post(`paas/users/login`, {
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
function vectorQuery(type, keywords) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { data } = yield http().post(`xsea/vector/query`, { type, text: keywords });
        const result = (_a = data.object) !== null && _a !== void 0 ? _a : [];
        return result;
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
