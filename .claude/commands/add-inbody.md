# Add InBody

新增 InBody 量測數據：自動讀取圖片、解析數據、更新 JSON 與 Excel。

## 工作流程

**Step 1 — 找圖片**

使用 Glob 工具找出 `Inbody/要新增的數據` 資料夾內所有圖片檔（*.jpg, *.jpeg, *.png）。
若資料夾是空的，回報「找不到新圖片」並停止。
若圖片數量超過 3 張，回報「目前有 X 張圖片，每次最多處理 3 張，請先移除多餘圖片再重新執行」並停止。

**Step 2 — 讀取並解析每張圖片**

對每張圖片：
1. 用 Read 工具讀取圖片（Claude 支援視覺分析）
2. 從 InBody 報告中擷取以下欄位：

```
date（格式 YYYY/MM/DD，從「檢測日期/時間」欄讀取）
體重(kg)
骨骼肌重SMM(kg)
體脂肪重(kg)
BMI(kg/m²)
體脂肪率(%)
除脂體重(kg)
身體總水量(L)
蛋白質重量(kg)
礦物質重量(kg)
InBody評分
目標體重(kg)
體重控制(kg)
脂肪控制(kg)
肌肉控制(kg)
內臟脂肪級別
腰臀圍比
SMI肌肉量指數(kg/m²)
骨礦含量(kg)
基礎代謝率(kcal)
建議熱量攝取(kcal)

部位肌肉：右上肢_kg, 右上肢_%, 左上肢_kg, 左上肢_%, 軀幹_kg, 軀幹_%, 右下肢_kg, 右下肢_%, 左下肢_kg, 左下肢_%
部位脂肪：右上肢_kg, 右上肢_%, 左上肢_kg, 左上肢_%, 軀幹_kg, 軀幹_%, 右下肢_kg, 右下肢_%, 左下肢_kg, 左下肢_%
圍度(cm)：頸部, 胸部, 腰部, 臀部, 右臂, 左臂, 右大腿, 左大腿
```

**Step 3 — 讀取現有 JSON**

用 Read 工具讀取 `Inbody/inbody_data.json`。

**Step 4 — 檢查重複並合併**

- 若解析出的 date 已存在於 `records[]` 中，跳過並告知使用者「該日期已存在」
- 若是新日期，append 到 `records[]`
- 同時在 `history[]` 中 append `{ date, 體重(kg), 骨骼肌重(kg), 體脂肪率(%) }`（若該日期不存在）
- 用 Write 工具將更新後的 JSON 寫回 `Inbody/inbody_data.json`

**Step 5 — 重新產生 Excel 並移動已處理圖片**

用 Bash 工具執行（`--move` 會自動將 `要新增的數據/` 內的圖片移至 `已處理/`）：
```
python auto_script/generate_inbody_excel.py --move
```

> 資料夾路徑統一由 `auto_script/generate_inbody_excel.py` 管理，腳本也會自動建立 `要新增的數據/` 與 `已處理/` 若不存在。

**Step 6 — 輸出 1 個月與 6 個月變化摘要**

從更新後的資料中分別計算兩段變化：

**1 個月變化：**
1. 以 `history[]` 排序找出最新日期與最接近 1 個月前的日期（±10 天內）；若無則標注「無足夠資料」
2. 骨骼肌重、體脂肪率 從 `history[]` 取值
3. 身體總水量 從 `records[]` 依日期比對取值（若該日期無 record 則填 —）
4. 計算並輸出變化（正數加 +，負數保留 -）

**6 個月變化：**
1. 以 `history[]` 排序找出最新日期與最接近 6 個月前的日期（±15 天內）；若無則取最舊一筆並標注實際間距
2. 骨骼肌重、體脂肪率 從 `history[]` 取值
3. 身體總水量 從 `records[]` 依日期比對取值（若該日期無 record 則填 —）
4. 計算並輸出變化（正數加 +，負數保留 -）

## 完成回報

```
新增完成：

- 解析圖片：X 張
- 新增日期：YYYY/MM/DD（, YYYY/MM/DD...）
- 略過重複：（若有）
- Excel 已更新：Inbody/InBody_數據報表.xlsx
- 圖片已移至：Inbody/已處理/

📊 1 個月變化（YYYY/MM/DD → YYYY/MM/DD）
  骨骼肌重：X.X kg → X.X kg（±X.X kg）
  體脂肪率：X.X% → X.X%（±X.X%）
  身體總水量：X.X L → X.X L（±X.X L）

📊 6 個月變化（YYYY/MM/DD → YYYY/MM/DD）
  骨骼肌重：X.X kg → X.X kg（±X.X kg）
  體脂肪率：X.X% → X.X%（±X.X%）
  身體總水量：X.X L → X.X L（±X.X L）
```

## 注意事項

- 若欄位在圖片中看不清楚，填 null 並在回報中標注「請人工確認」
- 不修改 `profile` 欄位（id, height_cm, age, gender）
- 不刪除任何現有記錄
- 使用者說「數據變化」、「inbody變化」、「身體變化」時，直接讀取 `Inbody/inbody_data.json` 並輸出 1 個月與 6 個月變化摘要，不需要其他步驟