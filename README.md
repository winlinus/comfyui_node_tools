# ComfyUI Prompt Editor

這是一個 ComfyUI 的客製化節點，是為 SD-IL (Illustrious) 文生圖工作流打造的提詞編輯器。

## Prompt Editor (提詞編輯)

透過 **Dynamic Chips UI**，把提詞拆成可拖曳、可調權重、可分群的標籤來編輯，最後輸出成字串。

### 核心功能

*   **區塊 (Block)**：提詞依語意分群 —「品質」「角色」「服裝」「場景」之類。區塊數量不限，可命名、可上下重排。
*   **區塊開關**：每個區塊可以停用，內容保留但不進輸出。適合「拿掉這一群看看」的比較。
*   **自訂分隔符**：透過 `delimiter` 設定合併時的分隔符號（預設為逗號 `,`）。
*   **智慧過濾**：`remove_empty` 選項可自動移除空白並忽略空值，保持輸出整潔。

### 🌟 Dynamic Chips UI (互動式標籤介面)

每個區塊裡，提詞以 Chip 的形式存在：

*   **自動轉換 (Text to Chips)**：
    *   輸入文字後按下 `Enter` 或點擊外部 (Blur)，內容會自動轉換為 Chip。
    *   支援批次輸入：若輸入 `cat, dog, bird`，會自動切分為三個獨立的 Chip。
*   **權重調整 (Weight Adjustment)**：
    *   將滑鼠停留在 Chip 上，按住 **Shift + 滾動滑鼠滾輪** 即可增加或減少權重。
    *   自動套用 ComfyUI 權重格式 `(text:1.1)`。
    *   若權重為 1.0，會自動簡化為原始文字。
*   **拖曳重排 (Drag & Drop)**：
    *   **直覺排序**：可隨意拖曳 Chip 改變順序。
    *   **跨區塊移動**：把 Chip 從一個區塊拖到另一個區塊，等於重新分類。也支援跨節點拖曳。
    *   **精準插入**：提供視覺化的插槽 (Placeholder)，明確指示插入位置。
*   **編輯與管理**：
    *   **雙擊編輯**：對 Chip 點擊兩下即可修改內容。
    *   **清空區塊**：範本選單 (📑) 裡提供「清空這個區塊」。
*   **流暢體驗**：
    *   包含 Hover 上浮、點擊回饋與流暢的過渡動畫，操作手感極佳。

### 🚀 智慧標籤自動完成 (Smart Tag Autocomplete)

這不只是一個輸入框，而是一個強大的標籤搜尋引擎：

*   **雙語搜尋**：支援 **英文** 與 **中文** 關鍵字搜尋。
    *   輸入 "girl" 會找到 "1girl", "girl", "little_girl"...
    *   輸入 "女孩" 也會找到 "1girl (1女孩)", "little_girl (小女孩)"...
*   **即時預覽**：
    *   搜尋結果會同時顯示英文標籤與中文翻譯 (例如：`1girl (1女孩)`)。
    *   建立 Chip 後，畫面上也會保留中文翻譯，方便直覺辨識。
*   **鍵盤導航**：
    *   支援 `↑` `↓` 鍵選擇候選詞。
    *   按下 `Enter` 或 `Tab` 快速建立標籤。
    *   選單會自動捲動跟隨目前的焦點。
*   **正確的圖層行為**：整個介面透過 ComfyUI 官方的 `addDOMWidget` 掛載，因此層級、裁切、縮放平移與節點縮小 (Collapse) 都由 ComfyUI 自行處理，不會蓋住其他節點。

### ⚙️ 必要的設定檔案

為了啟用自動完成功能，請確保 **tags.json** 位於正確位置：
`custom_nodes/comfyui-prompt-editor/js/tags.json`

> 該檔案包含了標籤資料庫，格式需為 JSON Array。


### 輸入參數說明

*   **delimiter (STRING)**: 用來連接字串的分隔符號。例如 `,`、` ` (空格) 或 `\n` (換行)。
*   **remove_empty (BOOLEAN)**:
    *   `True` (預設): 自動刪除字串前後的空白 (strip)，並且**只合併有內容**的字串。
    *   `False`: 保留原始字串內容。
*   **blocks (STRING)**: 整份提詞的狀態，以 JSON 儲存。**由介面自行維護，節點上不會顯示，也不需要手動編輯。**

    ```json
    {"version": 1, "blocks": [{"name": "品質", "enabled": true, "chips": ["masterpiece"]}]}
    ```

*   **clip (CLIP, 選用)**: 接上之後，節點會直接輸出 `CONDITIONING`，可省略一個 `CLIPTextEncode` 節點。不接則完全不影響原本的行為。

### 輸出說明

*   **combined_string (STRING)**: 合併處理後的最終字串。
*   **conditioning (CONDITIONING)**: 只有在 `clip` 有接的時候才有值，可直接連到 KSampler。**沒接 `clip` 卻使用這個輸出會得到 `None`。**

> 正面與負面提詞各自放一個節點實例，兩個 `conditioning` 分別接到 KSampler 的 positive / negative。

### 📑 範本

範本存的是**一串區塊**，所以同一個格式同時涵蓋兩種粒度：

*   **單一區塊**（長度 1）：常用角色、固定的品質前綴。用區塊標題列上的 📑。
*   **整份提詞**（長度 N）：例如整套負面提詞。用節點底部的 📑。

把多區塊的範本套用到單一區塊時，範本裡所有標籤會併進那一個區塊。範本存在 `templates.json`（已 gitignore）。

### 安裝方式

請確保此資料夾位於你的 ComfyUI `custom_nodes` 目錄下：
`ComfyUI/custom_nodes/comfyui-prompt-editor/`

---
Made for ComfyUI.
