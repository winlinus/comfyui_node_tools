# ADR-0004：節點同時輸出 `STRING` 與（可選的）`CONDITIONING`

**狀態**：已接受並實作（2026-08-15）

## 背景

節點目前只輸出 `STRING`，因此每次使用都必須再接一個 `CLIPTextEncode` 才能得到 KSampler 需要的 `CONDITIONING`。使用者回報這是實際操作上的主要缺點。

三個選項：

- **維持 `STRING`** —— 現狀，永遠多一個節點。
- **改成 `CONDITIONING`** —— 節點多吃一個 `CLIP` 輸入，直接接 KSampler。但字串消失在節點內部，無法檢視、存 metadata 或餵給其他節點。
- **兩者都輸出** —— `CLIP` 設為 optional 輸入。

`user/default/workflows/SD-IL_basic.json` 使用的是**普通 `CLIPTextEncode`**，不是 `CLIPTextEncodeSDXL` 那類帶 width/height/crop 的變體。這使第三個選項乾淨可行 —— 沒有額外參數需要複製進來。若當初用的是 SDXL 變體，維持 `STRING` 反而比較誠實。

## 決定

節點輸出 `STRING`，並新增一個 **optional 的 `CLIP` 輸入**：

- 未接 `CLIP` → 只提供 `STRING`（現狀行為不變）
- 已接 `CLIP` → 同時提供 `CONDITIONING`

## 後果

- 可直接接上 KSampler，工作流少一個節點。
- 字串出口保留，仍可檢視、存 metadata、餵其他節點。
- 對既有 workflow **非破壞性** —— 新增一個 optional 輸入不會讓舊檔失效。（這點與 [ADR-0002](0002-prompt-state-as-single-json-widget.md) 相反，該項會破壞。）
- 綁定普通 `CLIPTextEncode` 的行為。日後若工作流改用 SDXL 變體的編碼節點，這個決定要重新檢視。
- 正面與負面提詞各自是一個節點實例，所以 KSampler 的兩個 conditioning 輸入分別來自兩個編輯器節點。
