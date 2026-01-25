# ComfyUI String Tools

這是一個 ComfyUI 的客製化節點擴充包，目前包含一個強大的字串處理節點。

## Dynamic String Combiner (動態字串合併器)

這個節點允許你輕鬆地將多個字串合併成一個字串，並提供靈活的設定選項。

### 功能特點

*   **多輸入支援**：支援最多 6 個字串輸入 (`string_1` 到 `string_6`)。
*   **直接編輯**：輸入框預設為多行文字編輯模式，方便直接輸入內容。
*   **動態連結**：你可以隨時將輸入框轉為接點 (Convert to input)，從其他節點接收字串。
*   **自訂分隔符**：透過 `delimiter` 設定合併時的分隔符號（預設為逗號 `,`）。
*   **智慧過濾**：透過 `remove_empty` 開關，自動移除空白字元並忽略空字串，保持輸出整潔。

### 輸入說明

*   **delimiter (STRING)**: 用來連接字串的分隔符號。例如 `,`、` ` (空格) 或 `\n` (換行)。
*   **remove_empty (BOOLEAN)**:
    *   `True` (預設): 自動刪除字串前後的空白 (strip)，並且**只合併有內容**的字串。
    *   `False`: 保留原始字串內容（包含空白），即使是空字串也會被合併。
*   **string_1 ~ string_6 (STRING)**: 要合併的文字內容。

### 輸出說明

*   **combined_string (STRING)**: 合併處理後的最終字串。

### 安裝方式

請確保此資料夾位於你的 ComfyUI `custom_nodes` 目錄下：
`ComfyUI/custom_nodes/string-tools/`

---
Made for ComfyUI.
