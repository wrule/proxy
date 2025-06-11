import axios from 'axios';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dayjs from 'dayjs';

let cookie = '';
const envId = () => /sys_env_id=(\d+)/.exec(cookie)?.[1];

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
    const [{ data: detail }] = await Promise.all([
      http().post(`xsea/report/query`, { id: record.data.recordId, workspaceId: record.data.productId }),
    ]);
    res.json({
      success: true,
      prompt: `请向用户简要解释 detail 字段内的关键信息`,
      detail,
    });
  } else {
    res.json({
      success: false,
      prompt: `暂时不支持查看 ${type} 详情，请用中文向用户解释`,
    });
  }
});

app.use('/run/script', express.json(), async (req: Request, res: Response) => {
  try {
    // 脚本搜索关键字
    const keywords = req.body?.keywords ?? '';
    // 持续时长，默认两分钟
    const duration = req.body?.duration ?? 60 * 2;
    // 最大并发，默认100
    const maxUserNum = req.body?.maxUserNum ?? 100;

    // 1. 搜索脚本
    const scripts = await vectorQuery('SCRIPT', keywords);
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
    let targetPlan: any = null;
    
    while (targetPlan?.name !== planName) {
      const planListRes = await http().post(`xsea/plan/v2/planList`, {
        workspaceId: productId,
        pageNum: 1,
        pageSize: 1,
        condition: { name: planName },
        name: planName,
      });
      targetPlan = planListRes.data.object?.list?.[0];
      
      if (targetPlan?.name !== planName) {
        await http().post(`xsea/plan/v2/addPlan`, {
          name: planName,
          planPurpose: planName,
          planRange: {
            start: dayjs().format('YYYY-MM-DD'),
            end: dayjs().add(100, 'years').format('YYYY-MM-DD'),
          },
          version: '1.0',
          workspaceId: productId,
        });
      }
    }

    // 3. 创建压测目标
    const goalName = `快速压测 ${dayjs().format('MM_DD_HH_mm_ss_SSS')}`;
    await http().post(`xsea/plan/goal/save`, {
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

    const goalRes = await http().post(`xsea/plan/goal/list`, {
      planId: targetPlan.id,
      pageNum: 1,
      pageSize: 1,
      condition: { name: goalName },
    });
    const targetGoal = goalRes.data.object?.list?.[0];

    // 4. 构造并发曲线
    const { data: strategyData } = await http().post(
      `xsea/scene/script/queryStrategy`,
      { id: targetGoal.sceneId },
    );
    const object = strategyData.object ?? {};
    object.sceneScriptConfModelList?.forEach((item: any) => {
      item.sceneStrategies = generateLoadCurve(duration, maxUserNum);
      item.threadNum = maxUserNum;
    });
    await http().post(`xsea/scene/script/modifyStrategy`, object);

    // 5. 启动压测
    const { data: execData } = await http().post(`xsea/sceneExec/start`, {
      envId: envId(),
      flag: false,
      goalId: targetGoal.id,
      id: targetGoal.sceneId,
      planId: targetPlan.id,
      workspaceId: productId,
    });

    const success = execData.success && typeof execData.object === 'string';
    
    res.json({
      success: !!success,
      ...(success ? {
        prompt: `脚本"${script.data.scriptName}"压测启动成功！持续时间${duration}秒，最大并发${maxUserNum}。[点击查看压测执行页面](http://10.10.30.103:8081/${envId()}/product/business/${productId}/plan/targetExecute?sceneExecId=${execData.object})`,
        execUrl: `http://10.10.30.103:8081/${envId()}/product/business/${productId}/plan/targetExecute?sceneExecId=${execData.object}`,
        sceneUrl: `http://10.10.30.103:8081/${envId()}/product/business/${productId}/plan/target?id=${targetPlan.id}&goalId=${targetGoal.id}`,
      } : {
        prompt: `压测启动失败：${execData.message || '未知错误'}`,
        errorInfo: execData,
      }),
    });

  } catch (error: any) {
    console.error('快速压测执行失败:', error);
    res.json({
      success: false,
      prompt: `压测执行过程中发生错误：${error.message || '未知错误'}`,
    });
  }
});

app.use('/run/goal', express.json(), async (req: Request, res: Response) => {
  // 目标搜索关键词
  const keywords = req.body?.keywords ?? '';
  const goal = (await vectorQuery('GOAL', keywords))[0];
  const { data } = await http().post(`xsea/sceneExec/start`, {
    flag: false,
    envId: envId(),
    workspaceId: goal.data.productId,
    planId: goal.data.planId,
    goalId: goal.data.goalId,
    id: goal.data.sceneId,
  });
  const execId = data.object;
  res.json({
    success: data.success,
    ...(data.success ? {
      prompt: `目标执行成功，请以markdown url的形式引导用户查看压测监控，[${goal.data.goalName}压测监控页面](http://10.10.30.103:8081/${envId()}/product/business/${goal.data.productId}/plan/targetExecute?sceneExecId=${execId})`,
    } : {
      message: data.message,
    }),
  });
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

function generateLoadCurve(durationSeconds: number, maxConcurrency: number) {
  const result: {
    index: number,
    period: number,
    userNum: number,
  }[] = [];
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

async function main() {
  await updateCookie();
  app.listen(3000);
  console.log('app.listen(3000)...');
}

main();
