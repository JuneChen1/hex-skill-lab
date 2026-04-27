# Student AI Skills

這是一組給學生練習的 AI Skill 範本。

它不是某個人的私人工作系統，而是一套可以直接拿去使用、改寫、覆盤的練習包。重點不是背格式，而是學會把 AI 從「一次性的 prompt」整理成「可以重複使用的工作流程」。

## 你會練到什麼

- 設計自己的 AI 人設與互動風格
- 把生活任務整理成可重複使用的 skill
- 用覆盤改進 skill，而不是一次寫完就放著
- 判斷 skill 什麼時候該問問題、什麼時候該直接執行
- 設計 agent 分工、CSV 報表、Calendar 排程與瀏覽器自動化的安全邊界

## 建議學習順序

這包 skill 的順序是刻意安排的：

```text
人設
→ 飲食紀錄任務
→ 覆盤
→ Skill 寫作檢查
→ Agent 分工
→ CSV 報表
→ Calendar 排程
→ 路線規劃
→ Chrome MCP 瀏覽器自動化
```

先從不需要外部工具的 skill 開始，再慢慢進到檔案、API 與瀏覽器自動化。

## Skill 清單

| 順序 | Skill                  | 用途                                    |
| ---- | ---------------------- | --------------------------------------- |
| 01   | `work-partner-persona` | 引導建立自己的工作合夥人人設            |
| 02   | `nutrition-log-review` | 建立飲食分析偏好，並分析飲食紀錄        |
| 03   | `retrospective`        | 對一次任務、學習或 skill 使用過程做覆盤 |
| 04   | `skill-writing-guide`  | 引導撰寫與審查自己的 Skill              |
| 05   | `agent-launcher`       | 建立 agent 分工，並判斷任務該交給誰     |
| 06   | `csv-financial-report` | 確認欄位與匿名化需求後產生 CSV 報表     |
| 07   | `scheduler`            | 建立排程偏好，使用 Calendar 找時段      |
| 08   | `route-planner`        | 建立交通偏好，規劃路線與出發時間        |
| 09   | `chrome-mcp`           | 使用 Chrome MCP 做安全的瀏覽器自動化    |

## 專案結構

```text
student-ai-skills/
  README.md
  skills/
    01-work-partner-persona/
      SKILL.md
    02-nutrition-log-review/
      SKILL.md
    03-retrospective/
      SKILL.md
    04-skill-writing-guide/
      SKILL.md
    05-agent-launcher/
      SKILL.md
    06-csv-financial-report/
      SKILL.md
    07-scheduler/
      SKILL.md
    08-route-planner/
      SKILL.md
    09-chrome-mcp/
      SKILL.md
```

## 使用方式

把想使用的 skill 資料夾複製到你的 AI agent 或支援 skills 的工具中。

每個 skill 都是一個獨立資料夾，裡面有一份 `SKILL.md`。你可以：

1. 先直接使用原版
2. 回答 skill 裡的引導問題
3. 讓 AI 根據你的回答產生個人化版本
4. 使用一段時間後，用 `retrospective` 覆盤並修改

## 建議練習流程

### 1. 建立人設

先使用 `01-work-partner-persona`。

它會問你：

- 你希望 AI 跟你的關係像什麼
- 它主要幫你處理什麼
- 它說話要像誰
- 它做判斷時要重視什麼
- 它什麼時候不該介入

最後會產生一份你自己的 persona skill。

### 2. 跑一個生活化任務

接著使用 `02-nutrition-log-review`。

先建立飲食分析偏好，再貼上一天的飲食紀錄，觀察 skill 怎麼根據你的目標給建議。

### 3. 覆盤剛剛的使用體驗

使用 `03-retrospective` 回頭檢查：

- 哪裡有幫助
- 哪裡問得不好
- 哪裡太籠統
- 下一版 skill 要加什麼規則

### 4. 修改 skill

使用 `04-skill-writing-guide` 把覆盤結果整理成更清楚的 `SKILL.md`。

這一步的重點是學會：

- 寫清楚適用情境
- 寫清楚不適用情境
- 設計穩定輸出格式
- 加上安全限制

### 5. 進到工具與自動化

後面的 skill 會逐步碰到更真實的工作流：

- `agent-launcher`：把任務交給不同 agent
- `csv-financial-report`：讀 CSV、分類、統計、匿名化
- `scheduler`：使用授權後的 Calendar 資料找時段
- `route-planner`：根據偏好規劃交通路線
- `chrome-mcp`：使用瀏覽器自動化開網頁、點擊、填表單、截圖

## 安全原則

使用這些 skill 時，請遵守下面原則：

- 不要放入真實 token、API key、cookie、密碼。
- 不要把真實個資、學生資料、客戶資料 commit 到 GitHub。
- 使用真實資料前，先確認你有權限處理那些資料。
- 讀取外部資料時，優先使用官方 API 與最小權限。
- 涉及付款、刪除、送出表單、建立外部資料時，要讓使用者最後確認。
- Chrome MCP 是瀏覽器自動化，不是大量爬蟲工具。
- 有官方 API 時，優先使用 API，不要用瀏覽器自動化硬抓資料。

## 可以改什麼

你可以改：

- skill 名稱
- 觸發描述
- 語氣
- 訪談問題
- 輸出格式
- 工作流程
- 安全邊界

建議不要一開始就改太多。先跑一次，再用覆盤結果決定要改哪裡。

## 不建議放進公開 repo 的內容

- 真實個資
- 真實學生或客戶資料
- token、secret、cookie、OAuth credentials
- 真實財務資料
- 未公開商業資料
- 特定網站的繞限制腳本
- 會自動付款、刪除、轉帳或送出合約的流程
