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
require("dotenv/config");
const axios_1 = __importDefault(require("axios"));
const express_1 = __importDefault(require("express"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const dayjs_1 = __importDefault(require("dayjs"));
let cookie = '';
const envId = () => { var _a; return (_a = /sys_env_id=(\d+)/.exec(cookie)) === null || _a === void 0 ? void 0 : _a[1]; };
const http = () => {
    const instance = axios_1.default.create({
        baseURL: `${process.env.XSEA_URL}/api`,
        headers: { cookie },
    });
    instance.interceptors.response.use((response) => response, (error) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 401) {
            console.log('检测到401错误，正在更新cookie...');
            yield updateCookie();
            // 更新请求头中的cookie并重试
            error.config.headers.cookie = cookie;
            return instance.request(error.config);
        }
        return Promise.reject(error);
    }));
    return instance;
};
const httpPaaS = () => {
    const instance = axios_1.default.create({
        baseURL: `${process.env.PAAS_URL}/api`,
        headers: { cookie },
    });
    instance.interceptors.response.use((response) => response, (error) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 401) {
            console.log('检测到401错误，正在更新cookie...');
            yield updateCookie();
            // 更新请求头中的cookie并重试
            error.config.headers.cookie = cookie;
            return instance.request(error.config);
        }
        return Promise.reject(error);
    }));
    return instance;
};
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
app.use('/run/script', express_1.default.json(), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    try {
        // 脚本搜索关键字
        const keywords = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.keywords) !== null && _b !== void 0 ? _b : '';
        // 持续时长，默认两分钟
        const duration = (_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.duration) !== null && _d !== void 0 ? _d : 60 * 2;
        // 最大并发，默认100
        const maxUserNum = (_f = (_e = req.body) === null || _e === void 0 ? void 0 : _e.maxUserNum) !== null && _f !== void 0 ? _f : 100;
        // 1. 搜索脚本
        const scripts = yield vectorQuery('SCRIPT', keywords);
        if (!scripts || scripts.length === 0) {
            res.json({
                success: false,
                prompt: `未找到匹配关键词"${keywords}"的脚本，请检查关键词是否正确`,
            });
            return;
        }
        const script = scripts[0];
        const productId = script.data.productId;
        const scriptId = script.data.scriptId;
        // 2. 创建或获取快速压测计划
        const planName = '快速压测归档计划';
        let targetPlan = null;
        while ((targetPlan === null || targetPlan === void 0 ? void 0 : targetPlan.name) !== planName) {
            const planListRes = yield http().post(`xsea/plan/v2/planList`, {
                workspaceId: productId,
                pageNum: 1,
                pageSize: 1,
                condition: { name: planName },
                name: planName,
            });
            targetPlan = (_h = (_g = planListRes.data.object) === null || _g === void 0 ? void 0 : _g.list) === null || _h === void 0 ? void 0 : _h[0];
            if ((targetPlan === null || targetPlan === void 0 ? void 0 : targetPlan.name) !== planName) {
                yield http().post(`xsea/plan/v2/addPlan`, {
                    name: planName,
                    planPurpose: planName,
                    planRange: {
                        start: (0, dayjs_1.default)().format('YYYY-MM-DD'),
                        end: (0, dayjs_1.default)().add(100, 'years').format('YYYY-MM-DD'),
                    },
                    version: '1.0',
                    workspaceId: productId,
                });
            }
        }
        // 3. 创建压测目标
        const goalName = `快速压测 ${(0, dayjs_1.default)().format('MM_DD_HH_mm_ss_SSS')}`;
        yield http().post(`xsea/plan/goal/save`, {
            type: 'BASELINE',
            name: goalName,
            planId: targetPlan.id,
            sceneScriptIds: [scriptId],
            syncLoops: false,
            syncModelConf: false,
            syncRps: false,
            syncScriptConf: true,
            syncThinkTime: false,
            syncTransactionPercent: false,
            envId: envId(),
        });
        const goalRes = yield http().post(`xsea/plan/goal/list`, {
            planId: targetPlan.id,
            pageNum: 1,
            pageSize: 1,
            condition: { name: goalName },
        });
        const targetGoal = (_k = (_j = goalRes.data.object) === null || _j === void 0 ? void 0 : _j.list) === null || _k === void 0 ? void 0 : _k[0];
        // 4. 构造并发曲线
        const { data: strategyData } = yield http().post(`xsea/scene/script/queryStrategy`, { id: targetGoal.sceneId });
        const object = (_l = strategyData.object) !== null && _l !== void 0 ? _l : {};
        (_m = object.sceneScriptConfModelList) === null || _m === void 0 ? void 0 : _m.forEach((item) => {
            item.sceneStrategies = generateLoadCurve(duration, maxUserNum);
            item.threadNum = maxUserNum;
        });
        yield http().post(`xsea/scene/script/modifyStrategy`, object);
        // 5. 启动压测
        const { data: execData } = yield http().post(`xsea/sceneExec/start`, {
            envId: envId(),
            flag: false,
            goalId: targetGoal.id,
            id: targetGoal.sceneId,
            planId: targetPlan.id,
            workspaceId: productId,
        });
        const success = execData.success && typeof execData.object === 'string';
        res.json(Object.assign({ success: !!success }, (success ? {
            prompt: `脚本"${script.data.scriptName}"压测启动成功！持续时间${duration}秒，最大并发${maxUserNum}。[点击查看压测执行页面](${process.env.XSEA_URL}/${envId()}/product/business/${productId}/plan/targetExecute?sceneExecId=${execData.object})`,
            execUrl: `${process.env.XSEA_URL}/${envId()}/product/business/${productId}/plan/targetExecute?sceneExecId=${execData.object}`,
            sceneUrl: `${process.env.XSEA_URL}/${envId()}/product/business/${productId}/plan/target?id=${targetPlan.id}&goalId=${targetGoal.id}`,
        } : {
            prompt: `压测启动失败：${execData.message || '未知错误'}`,
            errorInfo: execData,
        })));
    }
    catch (error) {
        console.error('快速压测执行失败:', error);
        res.json({
            success: false,
            prompt: `压测执行过程中发生错误：${error.message || '未知错误'}`,
        });
    }
}));
app.use('/run/goal', express_1.default.json(), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // 目标搜索关键词
    const keywords = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.keywords) !== null && _b !== void 0 ? _b : '';
    const goal = (yield vectorQuery('GOAL', keywords))[0];
    const { data } = yield http().post(`xsea/sceneExec/start`, {
        flag: false,
        envId: envId(),
        workspaceId: goal.data.productId,
        planId: goal.data.planId,
        goalId: goal.data.goalId,
        id: goal.data.sceneId,
    });
    const execId = data.object;
    res.json(Object.assign({ success: data.success }, (data.success ? {
        prompt: `目标执行成功，请以markdown url的形式引导用户查看压测监控，[${goal.data.goalName}压测监控页面](${process.env.XSEA_URL}/${envId()}/product/business/${goal.data.productId}/plan/targetExecute?sceneExecId=${execId})`,
    } : {
        message: data.message,
    })));
}));
app.use('/api', (req, res, next) => {
    req.headers.cookie = cookie;
    next();
});
const proxyMiddleware = (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: `${process.env.XSEA_URL}/api`,
    changeOrigin: true,
});
app.use('/api', proxyMiddleware);
function updateCookie() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const res = yield httpPaaS().post(`paas/users/login`, {
            loginType: "USERNAME",
            password: process.env.PASSWORD,
            sessionId: "",
            sig: "",
            token: "",
            userName: process.env.USER_NAME,
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
function generateLoadCurve(durationSeconds, maxConcurrency) {
    const result = [];
    const segments = 10;
    let time = 0, concurrency = 0, index = 0;
    for (let i = 1; i <= segments; ++i) {
        const newTime = Math.floor((durationSeconds / segments) * i);
        const newConcurrency = Math.floor((maxConcurrency / segments) * i);
        const diffTime = newTime - time;
        const riseTime = Math.floor(diffTime / 3);
        const diffConcurrency = newConcurrency - concurrency;
        result.push({
            index: ++index,
            period: riseTime,
            userNum: diffConcurrency,
        });
        result.push({
            index: ++index,
            period: diffTime - riseTime,
            userNum: 0,
        });
        time = newTime;
        concurrency = newConcurrency;
    }
    return result;
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield updateCookie();
        app.listen(3000);
        console.log('app.listen(3000)...');
    });
}
main();
