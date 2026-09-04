# AGENTS.md

给在本仓库里改代码的 AI 助手。产品说明见根目录 `README.md`，规划以 `docs/` 为准。

## 这是什么

课程《AI 赋能系统化问题分析与解决》的配套产品「问题分析与解决工作台」。学员自定选题，按八步走完课题。无账号。界面始终简体中文。

## 改代码时必须遵守

- **AI 发散，人收敛。** 不要让模型宣布唯一真因或唯一对策，不要替学员通过闸门。
- **不编造数据。** 证据不足写「未知」。禁止「意识不足 / 沟通不到位 / 加强管理 / 加强培训」一类空话进入原因或对策。
- **闸门由学员自检。** 勾清单 + 依据 ≥12 字；禁止只写「没问题」。判断 1 解锁第 2 步；判断 2 解锁第 3–5 步；判断 3 解锁第 6–8 步。
- **第 7、8 步由学员自己填写**，不要接 AI 代写结论或复盘。
- **第 5 步 Gate 3 只在对策矩阵阶段显示**，不要在 5W / SCAMPER 子阶段拦截。
- **`patchCase` 必须读最新再写**，避免并行覆盖。旧课题靠 `normalizeCase` 补字段。
- **空输入要看得见。** `.field input` 无边框，空框必须包在 `.field` / `.need-row` 等有边框的容器里。
- **不要把 API Key 写入导出文件。** 不要加注册登录。不要做讲师端（一期不做）。
- 只改与当前任务有关的文件，不要顺手重构、不要新写无关 markdown。

## 八步与关键文件

| 步 | UI | 领域 / AI |
| --- | --- | --- |
| 1 明确问题 | `src/app/workspace/StepDefine.tsx` | `src/domain/case.ts` |
| 2 分解问题 | `StepDecompose.tsx` | `src/domain/analyze.ts`，`src/ai/roles/analyst.ts` |
| 3 设定目标 | `StepGoal.tsx` | `src/domain/goal.ts` |
| 4 把握真因 | `StepCause.tsx` | `src/domain/cause.ts`，`src/ai/roles/cause.ts` |
| 5 制定对策 | `StepRemedy.tsx` | `src/domain/remedy.ts`，`src/ai/roles/innovator.ts` |
| 6 贯彻实施 | `StepPlan.tsx` | `src/domain/plan.ts`，`src/ai/roles/experimenter.ts` |
| 7 评价结果 | `StepReview.tsx` | `src/domain/review.ts`（学员自填） |
| 8 巩固成果 | `StepConsolidate.tsx` | `src/domain/review.ts`（学员自填） |

工作台总控：`src/app/workspace/WorkspacePage.tsx`（子阶段 `goNext`、闸门显示、导出）。  
存储：`src/storage/db.ts`。Word / PPT：`src/storage/office.ts`，文稿结构：`src/storage/report.ts`。

第 2 步子阶段：`tree` → `matrix` → `focus`。  
第 5 步子阶段：`causes` → `fiveW` → `scamper` → `matrix`。

## 模型调用

学员在设置页自配 OpenAI 兼容接口。部分网关不支持 `response_format: json_object`，解析用 `src/ai/json.ts` 的 `parseModelJson` 从回复里抠 JSON。无 API 时必须给出可改骨架，不要空白失败。

## 导出

工作台任意步骤可导出 JSON、Markdown、Word（.docx）、PPT（.pptx）。JSON 用于导入恢复；Office 文档由当前课题即时生成。
