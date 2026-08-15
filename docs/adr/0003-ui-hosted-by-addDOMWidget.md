# ADR-0003：UI 改由 `addDOMWidget` 承載，不再掛在 `document.body`

**狀態**：已接受並實作（2026-08-15）

## 背景

回報的症狀有兩個：

1. 輸入區的顯示層級錯誤，會蓋住畫面上所有其他節點。
2. 節點縮小（collapse）後，輸入區仍然顯示。

兩者是同一個根因。chips 容器被掛在 `document.body` 上：

```js
js/dynamic_chips.js:1546    container.style.position = "absolute";
js/dynamic_chips.js:1548    document.body.appendChild(container); // Use body to ensure it's on top of everything
```

那句註解「掛在 body 確保它在最上層」就是 bug 的成因本身：在最上層等於蓋住所有東西。容器不在 ComfyUI 畫布的圖層系統裡，於是：

- `z-index` 只能用猜的。目前檔案裡有十個互相打架的值：`1, 10, 99, 1000, 1005, 10000, 10001, 20000`。
- 節點 collapse 時 ComfyUI 停止繪製該節點，但 body 上的 DOM 不受影響。

程式碼裡已經有兩代補救的痕跡，都失敗了：

```js
js/dynamic_chips.js:328  // This ensures that when nodes are collapsed, the input boxes are definitely hidden.
js/dynamic_chips.js:329  // Event-based handling can be flaky if drawing logic stops running (which it does when collapsed).
js/dynamic_chips.js:1561 // Note: We removed the centralized onCollapse hook in favor of the global watchdog loop
```

先試事件掛鉤，失敗；改成輪詢 watchdog，仍會漏。因為問題在更上游。

`js/dynamic_chips.js:395` 的註解寫著「floats over the node **or use the standard `widget.element` if it exists**」—— 正確的路當時就看見了，只是沒走。

## 決定

改用 ComfyUI 官方的 `addDOMWidget` 承載 chips UI。它自動處理層級、裁切、collapse、以及畫布縮放平移的同步。

可用性已驗證：`addDOMWidget` 存在於本機 frontend `1.48.7`（`comfyui_frontend_package/static/assets/core-BIz9CJ30.js`），且 `custom_nodes/ComfyUI-MiniMax-H3/web/` 下有三個檔案在使用它。

不採用「先貼 OK 繃」（壓 z-index、加強 watchdog）：那是在一個註定要刪的東西上再疊一層補丁，而且目前沒有正式使用，這個 bug 不擋任何事。

## 後果

- 輪詢 watchdog（`dynamic_chips.js:328` 一帶）整段刪除。
- 十個手調的 `z-index` 全部刪除，層級交給 ComfyUI。
- 這次遷移與 [ADR-0002](0002-prompt-state-as-single-json-widget.md) 的渲染層改寫碰同一批程式碼，**一起做**。
- README 的「智慧防遮擋」與「節點縮小會自動隱藏」目前是願望不是現況，實作完成後要一併改寫。
