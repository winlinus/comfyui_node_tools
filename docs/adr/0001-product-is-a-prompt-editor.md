# ADR-0001：產品是提詞編輯器，不是字串工具包

**狀態**：已接受（2026-08-15）

## 背景

專案長期存在身分不明的問題，具體證據是同一個東西有五個名字：repo `comfyui_node_tools`、README「ComfyUI String Tools」、class `DynamicStringCombiner`、顯示名稱 "Prompt Editor"、category 與 API 路由 `string_tools`。

兩種讀法會導向完全不同的專案：

- **字串工具節點包** — 核心是「合併字串」這個資料流動作，chips UI 是附贈的介面。合理的擴充是字串分割、取代、正則等節點。
- **提詞編輯介面** — 核心是「人在 ComfyUI 裡舒服地寫、改、重排、存提詞」。合理的擴充是負面提詞、權重批次調整、與 LoRA 語法整合。

程式碼重量壓倒性地指向後者：`string_combiner.py` 46 行（把十個字串用分隔符接起來），`js/dynamic_chips.js` 1729 行，`js/tags.json` 436KB。`__init__.py` 的 130 行中約 100 行是為前端服務的範本 CRUD API。比例約 37:1。

`tags.json` 是提詞領域專用資產（Danbooru 標籤 + 中文翻譯），泛用字串工具不需要它。

## 決定

**這是一個給單一使用者的 SD-IL txt2img 提詞編輯器，ComfyUI 節點只是載體。**

同時確定範圍界線：

- **個人專用**。不公開發佈到 ComfyUI Manager / registry。
- 只服務一條 txt2img 工作流（`SD-IL_basic.json`）。

「個人專用」是明確承認，不是「以後也許會公開」。含糊的公開意圖會讓每個決定都付一半的公開成本卻拿不到公開的好處。

## 後果

- 未來的功能以「編輯提詞的人」為判準，不以「處理字串的資料流」為判準。要不要做某個功能，問的是「這讓寫提詞更順嗎」。
- 不需要 LICENSE、`pyproject.toml` 註冊資料、標籤庫授權來源、向後相容承諾。
- 範本存檔可以繼續放在 package 目錄（`templates.json`），不必處理「使用者更新會被蓋掉」的問題。
- 破壞性變更成本低。目前沒有任何正式使用的 workflow 引用這個節點，這是做結構性改動的窗口。
- 五個名字必須收斂，見 [ADR-0005](0005-consolidate-naming-to-prompt-editor.md)。

## 之後若要公開

這是一個獨立的、可以之後再做的決定。屆時要補的至少有：LICENSE、打包 metadata、`tags.json` 的來源與授權說明、範本存檔改到使用者目錄、以及開始考慮向後相容。
