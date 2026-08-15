# ADR-0002：提詞狀態存成單一 JSON widget，取代 `string_1..string_10`

**狀態**：已接受並實作（2026-08-15）

## 背景

目前節點宣告十個 widget：`string_1` … `string_10`（`string_combiner.py`）。前端把每個 widget 增強成 chips 容器（`dynamic_chips.js:373`），並提供上下交換按鈕。

這十個框在程式裡**沒有名字**，只有編號。它們的語意（哪一格是畫質、哪一格是角色）只存在使用者腦中，而交換按鈕會讓那份腦內對照表漂移。

十這個數字是遷就：原本想要的是可動態增減的框，當時沒找到做法，所以硬編。

值得注意的反證：使用者真實的正向提詞只含約八個語意群，**「十格不夠」並不成立**。這次改動的價值不在無限格，而在把「區塊」變成有名字、可重排、可整組開關的頭等公民。

### 為什麼不是一般的動態輸入

ComfyUI 生態常見的「動態輸入」講的是**接點（socket）**：Python 宣告少量 `("*",)` 輸入，JS 監聽連線變化增減 slot。本專案要的是動態的**文字 widget**，那是另一回事。

實務上的作法是把整包狀態塞進**一個 widget 的序列化值**，前端自行渲染。本機已有現成範例：`rgthree-comfy` 的 Power Lora Loader，其 `widgets_values` 為

```python
[{}, {'type': 'PowerLoraLoaderHeaderWidget'},
 {'on': False, 'lora': 'styles/Orizen_Style.safetensors', 'strength': 0.6},
 {'on': True,  'lora': 'body/FAT_MON_ILL_V2_epoch_10.safetensors', 'strength': 1}, {}, '']
```

一個 widget、數量任意的結構化物件。這正是本專案需要的形狀，而且使用者的工作流裡本來就在用它。

關鍵前提：**chips 本來就活在 JS 裡**。`string_1..10` 這十個 Python 欄位對前端毫無價值，它們只是把 JS 的狀態硬塞回 ComfyUI 的序列化機制。Python 不需要知道有幾個區塊。

## 決定

移除 `string_1` … `string_10`，改為**單一 widget 承載整份提詞狀態的 JSON**。

概念結構（欄位名待實作時定案）：

```
blocks: [
  { name: "品質",  enabled: true,  chips: [ {text, weight}, ... ] },
  { name: "角色",  enabled: true,  chips: [ ... ] },
  ...
]
```

由此連帶確定：

- **區塊數量不限**
- **區塊有自由文字名稱**，附一組預設（品質／角色／人數／體型／髮／服裝／動作／場景），使用者隨時可改。名稱存在 workflow JSON 裡，跟著區塊走，不是寫死的清單 —— 因為工作流結構未必永遠一樣。
- **區塊有 on/off 開關**，關掉的區塊保留內容但不進輸出。設計階段加是一個布林欄位；事後加要動資料結構和整個渲染層。

不採用「假動態」（保留十個宣告、用 JS 隱藏沒用到的框）：上限仍在，而且區塊名稱得另外找地方存。

## 後果

- **破壞所有既有 workflow。** widget 結構完全改變，舊 `.json` 載入後對不上。**不寫遷移** —— 目前沒有正式使用的 workflow，全是測試資料，重建即可。這個窗口在節點被接進正式工作流後就關閉。
- 「把 chip 拖到另一個區塊」的語意從**移動位置**變成**重新分類**。
- `templates.json` 的格式必須跟著改：範本改存「一串區塊」，長度 1 即單一區塊範本。現有範本是測試資料，丟棄重建，不寫遷移。（範本格式本身容易反轉，不另立 ADR。）
- 這次改寫與 [ADR-0003](0003-ui-hosted-by-addDOMWidget.md) 的 `addDOMWidget` 遷移碰同一批程式碼，**必須一起做**，分開做等於同一塊改兩次。
- 區塊名稱一旦穩定，未來可考慮用標籤庫的分類自動歸位 chip（目前刻意不做，理由見 `CONTEXT.md` 的「分類」條目）。
