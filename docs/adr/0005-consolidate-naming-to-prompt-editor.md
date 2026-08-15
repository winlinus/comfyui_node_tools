# ADR-0005：命名收斂為 Prompt Editor

**狀態**：已接受並實作（2026-08-15）

## 背景

同一個東西在專案裡有五個名字：

| 位置 | 名字 |
|---|---|
| repo / package | `comfyui_node_tools` |
| custom_nodes 資料夾 | `string-tools` |
| README 標題 | ComfyUI String Tools |
| node class | `DynamicStringCombiner` |
| 顯示名稱 | Prompt Editor |
| category / API 路由 | `string_tools` / `/string_tools/*` |

使用者已經先做了選擇 —— 把顯示名稱改成 "Prompt Editor"，commit 訊息寫「更名為提詞編輯」。剩下的名字只是還沒跟上。[ADR-0001](0001-product-is-a-prompt-editor.md) 確認了這個身分。

**這個決定有時效。** 改 `NODE_CLASS_MAPPINGS` 的 key 會讓所有存有這個節點的 workflow 失效。目前沒有任何一張圖使用它，所以成本是零；一旦接進 `SD-IL_basic.json`，成本就永遠不是零。

## 決定

全面收斂為 Prompt Editor：

| 位置 | 舊 | 新 |
|---|---|---|
| node class | `DynamicStringCombiner` | `PromptEditor` |
| 顯示名稱 | Prompt Editor | Prompt Editor（不變） |
| category | `string_tools` | `prompt_editor` |
| API 路由 | `/string_tools/*` | `/prompt_editor/*` |
| repo | `comfyui_node_tools` | `comfyui-prompt-editor` |
| custom_nodes 資料夾 | `string-tools` | `comfyui-prompt-editor` |
| README 標題 | ComfyUI String Tools | ComfyUI Prompt Editor |

**排在所有其他工作之前。** 這是清單裡唯一有時效的決定 —— 其他項目晚做只是晚做，這一項晚做會變貴。而且它機械、無聊、風險低，適合先清掉。

## 後果

- 既有 workflow 中的節點引用失效。目前為零，可忽略。
- `custom_nodes/string-tools` 資料夾要跟著改名。
- GitHub repo 改名後舊 URL 會自動轉址，但 `git remote` 建議手動更新（本機有兩份 clone：`~/Projects/` 與 `custom_nodes/`）。
- README 中「tags.json 需位於 `custom_nodes/string-tools/js/tags.json`」的路徑說明要跟著改。
- Python 端 log 前綴 `[StringTools]` 一併改。
