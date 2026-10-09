# 模型评测说明

## 目标

评测不是只看文案“像不像人写的”，而是检查模型是否遵守品牌事实边界。

测试集位于：

```text
tests/fixtures/model-eval-cases.json
```

当前包含 12 个案例，覆盖：

- 典型案例
- 复杂多平台输入
- 医疗功效
- 绝对化宣传
- 无依据年份
- 未证实的非遗、荣誉和宫廷身份
- 营养声称
- 受访原话
- 品牌语气
- 内容日历完整性

## 自动检查项

- 必须引用指定 `[Fxxx]` 事实编号
- 禁止出现未证实期限、功效、荣誉和绝对化词语
- 引用覆盖率
- 风险内容是否被标记
- 内容质量评分
- 模型和提示词版本

## 环境变量

```text
OPENAI_API_KEY=
OPENAI_MODEL=你的账号实际可用模型
OPENAI_BASE_URL=https://api.openai.com/v1
AI_API_MODE=responses
```

如果账号没有 `gpt-6` 权限，不要把 `OPENAI_MODEL` 留为空；请填写账号实际可用的模型。默认值只是代码兜底，不代表账号一定可用。

## 运行

不要求 Key，未配置时输出 `skipped`：

```bash
npm run eval:model
```

必须配置 Key 并真实调用模型：

```bash
npm run eval:model:required
```

报告输出：

```text
tests/artifacts/model-eval-report.json
```

报告包含每个案例的通过状态、缺失事实、禁用词命中、引用覆盖率、质量分、模型和适配模式。