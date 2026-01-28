import { app } from "../../scripts/app.js";

// Utility to inject styles
const styleElement = document.createElement("style");
styleElement.textContent = `
    .comfy-chip-container {
        min-height: 50px;
        min-width: 200px;
        background-color: var(--comfy-input-bg);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 5px;
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        align-items: center;
        margin-bottom: 5px;
        cursor: text;
        z-index: 9999;
        position: relative; /* For clear button positioning */
        padding-right: 25px; /* Make space for clear button */
    }
    
    .comfy-chip {
        margin: 0 4px;
        background-color: var(--comfy-menu-bg);
        color: var(--fg-color);
        padding: 2px 8px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 5px;
        cursor: grab;
        user-select: none;
        border: 1px solid var(--border-color);
        font-size: 12px;
    }
    
    .comfy-chip:active {
        cursor: grabbing;
    }

    .comfy-chip.dragging {
        opacity: 0.5;
    }

    .comfy-chip-remove {
        cursor: pointer;
        font-weight: bold;
        color: #ff6b6b;
        margin-left: 2px;
    }

    .comfy-chip-remove:hover {
        color: #ff0000;
    }

    .comfy-chip-input {
        flex-grow: 1;
        min-width: 60px;
        background: transparent;
        border: none;
        color: var(--fg-color);
        outline: none;
        font-size: 12px;
        padding: 2px;
        margin: 5px;
    }

    .comfy-chip-clear-all {
        position: absolute;
        top: 2px;
        right: 2px;
        cursor: pointer;
        color: #888;
        font-size: 14px;
        width: 16px;
        height: 16px;
        line-height: 14px;
        text-align: center;
        border-radius: 50%;
        background: rgba(0,0,0,0.1);
        display: none; /* Hidden by default */
        z-index: 10000;
    }

    .comfy-chip-clear-all:hover {
        color: #ff4444;
        background: rgba(0,0,0,0.2);
    }

    .comfy-chip-placeholder {
        width: 4px;
        background-color: var(--primary-color, #2a81f6);
        border-radius: 2px;
        margin: 0 2px;
        pointer-events: none;
        animation: pulse 1s infinite;
    }

    @keyframes pulse {
        0% { opacity: 0.5; }
        50% { opacity: 1; }
        100% { opacity: 0.5; }
    }
`;
document.head.appendChild(styleElement);

console.log("Loading DynamicStringTools extension...");

app.registerExtension({
    name: "Comfy.DynamicStringTools",
    async nodeCreated(node) {
        // console.log("Node created:", node.comfyClass, node.type, node.title);
        if (node.comfyClass === "DynamicStringCombiner" || node.type === "DynamicStringCombiner") {
            console.log("Found DynamicStringCombiner node!", node);
            // Wait for widgets to be initialized
            setTimeout(() => {
                enhanceNode(node);
            }, 100);
        }
    }
});

function enhanceNode(node) {
    if (!node.widgets) return;

    // Enhance string_1 to string_10 widgets
    for (let i = 1; i <= 10; i++) {
        const widgetName = `string_${i}`;
        const widget = node.widgets.find(w => w.name === widgetName);
        if (widget) {
            console.log("Enhancing widget:", widgetName);
            transformToChips(widget, node);
        }
    }
}

function transformToChips(widget, node) {
    // Hide the original widget input but keep it for data storage
    // ComfyUI widgets usually draw themselves on canvas, but standard DOM widgets exist too.
    // For "STRING" type with "multiline": True, ComfyUI often uses a DOM textarea overlay when editing,
    // or just draws text. 
    // We want to replace the standard interaction.

    // NOTE: ComfyUI's custom widget handling is tricky. We can't easily "replace" the canvas drawing 
    // completely without reimplementing the draw method, but we can augment it by creating a DOM element 
    // that overlays or sits in the properties panel if that's where it is.
    // However, usually nodes are on canvas.

    // BETTER APPROACH for Canvas nodes:
    // Create a DOM element that floats over the node or use the standard `widget.element` if it exists.
    // But basic STRING widgets don't always expose a persistent DOM element on the canvas until clicked.

    // Actually, allowing full DOM interaction on canvas usually involves creating a custom widget type.
    // But here we are patching an existing widget.

    // Let's try to override the widget's behavior to spawn our custom DOM overlay instead of the default one.

    // 1. Create a container for our chips input
    const container = document.createElement("div");
    container.className = "comfy-chip-container";

    const input = document.createElement("input");
    input.className = "comfy-chip-input";
    input.placeholder = "Add tag...";

    container.appendChild(input);

    // This data structure will hold our chips state locally strictly for this widget instance
    let chips = [];

    // Clear All Button
    const clearBtn = document.createElement("div");
    clearBtn.className = "comfy-chip-clear-all";
    clearBtn.innerHTML = "×";
    clearBtn.title = "Clear all";
    clearBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm("Clear all chips?")) {
            chips = [];
            updateWidgetValue();
            renderChips();
        }
    };
    container.appendChild(clearBtn);

    // Helper to sync value BACK to the widget
    function updateWidgetValue() {
        const newValue = chips.join(", ");
        widget.value = newValue;
        if (widget.callback) widget.callback(newValue);
        app.graph.setDirtyCanvas(true, true);
    }

    // Helper to render chips in our container
    function renderChips() {
        // Manage Clear Button Visibility
        if (chips.length > 0) {
            clearBtn.style.display = "block";
        } else {
            clearBtn.style.display = "none";
        }

        while (container.firstChild && container.firstChild !== input && container.firstChild !== clearBtn) {
            container.removeChild(container.firstChild);
        }

        chips.forEach((chipText, index) => {
            const chip = document.createElement("div");
            chip.className = "comfy-chip";
            chip.draggable = true;
            chip.dataset.index = index;
            chip.dataset.widgetName = widget.name; // identify source widget

            const textSpan = document.createElement("span");
            textSpan.textContent = chipText;
            chip.appendChild(textSpan);

            const removeBtn = document.createElement("span");
            removeBtn.className = "comfy-chip-remove";
            removeBtn.innerHTML = "×";
            removeBtn.onclick = (e) => {
                e.stopPropagation(); // prevent triggering container click
                chips.splice(index, 1);
                updateWidgetValue();
                renderChips();
            };
            chip.appendChild(removeBtn);

            // Chip Weight Adjustment (Wheel)
            chip.addEventListener("wheel", (e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.1 : -0.1;

                let content = chipText;
                let weight = 1.0;

                // Parse existing weight (text:1.1)
                const match = content.match(/^\((.+):([0-9]*\.?[0-9]+)\)$/);
                if (match) {
                    content = match[1];
                    weight = parseFloat(match[2]);
                }

                weight += delta;
                // Round to 1 decimal place
                weight = Math.round(weight * 10) / 10;

                // Construct new text
                if (weight === 1.0) {
                    chips[index] = content;
                } else {
                    chips[index] = `(${content}:${weight})`;
                }

                updateWidgetValue();
                renderChips();
            });

            // Double click to edit
            chip.addEventListener("dblclick", (e) => {
                e.preventDefault();
                e.stopPropagation();

                const editInput = document.createElement("input");
                editInput.value = chips[index]; // Use current value
                Object.assign(editInput.style, {
                    width: Math.max(20, textSpan.offsetWidth) + "px", // Match width roughly
                    minWidth: "30px",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "inherit",
                    font: "inherit",
                    padding: "0"
                });

                try {
                    chip.replaceChild(editInput, textSpan);
                    editInput.focus();
                    editInput.select();

                    let committed = false;
                    const commit = () => {
                        if (committed) return;
                        committed = true;

                        const newVal = editInput.value.trim();
                        if (newVal) {
                            chips[index] = newVal;
                        } else {
                            chips.splice(index, 1);
                        }
                        updateWidgetValue();
                        renderChips();
                    };

                    editInput.addEventListener("blur", commit);
                    editInput.addEventListener("keydown", (ev) => {
                        if (ev.key === "Enter") {
                            ev.preventDefault();
                            editInput.blur();
                        }
                    });
                } catch (err) {
                    console.error("Error edit chip", err);
                }
            });

            // Drag Events
            chip.addEventListener("dragstart", (e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", JSON.stringify({
                    text: chipText,
                    sourceWidgetName: widget.name,
                    sourceNodeId: node.id,
                    index: index
                }));
                chip.classList.add("dragging");

                // Add a global class or data attribute to blocking drag/drop on canvas if needed
                // ComfyUI canvas handles drag/drop too, we need to stop propagation.
                e.stopPropagation();
            });

            chip.addEventListener("dragend", (e) => {
                chip.classList.remove("dragging");
            });

            container.insertBefore(chip, input);
        });

        // Ensure clearBtn is always last or absolutely positioned, actually it's absolute so order in DOM doesn't matter much for display,
        // but for safety let's keep it appended? NO, absolute takes it out of flow. 
        // But if we clear content using loop above, we must ensure we don't remove clearBtn if it was before input?
        // My loop: while (container.firstChild && container.firstChild !== input && container.firstChild !== clearBtn)
        // This assumes clearBtn is AFTER chips? 
        // We initially appended clearBtn AFTER input? No, we appended input first.
        // Let's re-append clearBtn to be sure it stays or check my insertion logic.
        // renderChips uses insertBefore(chip, input). So chips are before input. 
        // clearBtn was appended to container. So it should be last.
    }

    // Initialize state from widget value
    function syncFromWidget() {
        if (typeof widget.value === "string" && widget.value.trim() !== "") {
            chips = widget.value.split(",").map(s => s.trim()).filter(s => s !== "");
        } else {
            chips = [];
        }
        renderChips();
    }

    // Initial sync
    syncFromWidget();

    // Input Events
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const val = input.value.trim();
            if (val) {
                const newChips = val.split(",").map(s => s.trim()).filter(s => s !== "");
                chips.push(...newChips);
                input.value = "";
                updateWidgetValue();
                renderChips();
            }
        } else if (e.key === "Backspace" && input.value === "" && chips.length > 0) {
            // Remove last chip on backspace if input empty
            chips.pop();
            updateWidgetValue();
            renderChips();
        }
    });

    input.addEventListener("blur", () => {
        const val = input.value.trim();
        if (val) {
            const newChips = val.split(",").map(s => s.trim()).filter(s => s !== "");
            chips.push(...newChips);
            input.value = "";
            updateWidgetValue();
            renderChips();
        }
    });

    // Container dragover/drop
    let placeholder = document.createElement("div");
    placeholder.className = "comfy-chip-placeholder";

    container.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        // Calculate insertion index and show placeholder
        const chipElements = Array.from(container.getElementsByClassName("comfy-chip"));
        // Filter out the dragged element itself if it's from this container to avoid weird jumping? 
        // Actually, standard practice is to just calculate position.

        let insertBeforeElement = null;
        for (const chipEl of chipElements) {
            if (chipEl.classList.contains("dragging")) continue; // Skip self
            const rect = chipEl.getBoundingClientRect();

            // If mouse is below this chip's row, this chip is technically "before" the mouse cursor in flow
            // Note: Use a small threshold if needed, but strict comparison usually works for non-overlapping rows
            if (e.clientY > rect.bottom) continue;

            // If mouse is above this chip's row, this chip is "after" the mouse cursor
            if (e.clientY < rect.top) {
                insertBeforeElement = chipEl;
                break;
            }

            // If overlapping vertically (same row), check horizontal position
            const midPoint = rect.left + rect.width / 2;
            if (e.clientX < midPoint) {
                insertBeforeElement = chipEl;
                break;
            }
        }

        if (insertBeforeElement) {
            container.insertBefore(placeholder, insertBeforeElement);
        } else {
            container.insertBefore(placeholder, input);
        }
    });

    container.addEventListener("dragleave", (e) => {
        // Only remove if we left the container, not just entered a child
        if (!container.contains(e.relatedTarget)) {
            if (placeholder.parentNode === container) {
                container.removeChild(placeholder);
            }
        }
    });

    container.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent ComfyUI from handling this drop

        // Find placeholder index
        let dropIndex = -1;
        if (placeholder.parentNode === container) {
            // Calculate index skipping non-chips (like placeholder itself if we iterated? no, DOM order)
            // We need index in 'chips' array.
            // visual children: chip, chip, placeholder, chip, input...
            // index matches count of chips before placeholder.
            const siblings = Array.from(container.children);
            let count = 0;
            for (const child of siblings) {
                if (child === placeholder) {
                    dropIndex = count;
                    break;
                }
                if (child.classList.contains("comfy-chip") && !child.classList.contains("dragging")) {
                    count++;
                }
            }
            container.removeChild(placeholder);
        }

        const rawData = e.dataTransfer.getData("text/plain");
        if (!rawData) return;

        try {
            const data = JSON.parse(rawData);
            if (!data.text) return;

            const droppedText = data.text;
            const isSameWidget = (data.sourceWidgetName === widget.name && data.sourceNodeId === node.id);
            const sourceIndex = data.index;

            // Handle removal from source
            let sourceWidget = null;
            if (data.sourceNodeId === node.id) {
                sourceWidget = node.widgets.find(w => w.name === data.sourceWidgetName);
            } else {
                const sourceNode = app.graph.getNodeById(data.sourceNodeId);
                if (sourceNode) {
                    sourceWidget = sourceNode.widgets.find(w => w.name === data.sourceWidgetName);
                }
            }

            if (sourceWidget) {
                // Parse source chips
                // NOTE: If Same Widget, 'widget.value' might not have been updated if we didn't wait? 
                // Usually it's fine.
                let sourceChips = sourceWidget.value.split(",").map(s => s.trim()).filter(s => s !== "");

                // Remove item
                // Use sourceIndex if valid matches text, else find text
                if (sourceChips[sourceIndex] === droppedText) {
                    sourceChips.splice(sourceIndex, 1);
                } else {
                    const idx = sourceChips.indexOf(droppedText);
                    if (idx !== -1) sourceChips.splice(idx, 1);
                }

                // Update source
                const newSourceVal = sourceChips.join(", ");
                sourceWidget.value = newSourceVal;
                if (sourceWidget.callback) sourceWidget.callback(newSourceVal);

                // Refresh source UI
                if (sourceWidget.refreshChips) sourceWidget.refreshChips();
            }

            // Insert into destination
            // If dropIndex was not found (rare), append
            if (dropIndex === -1) dropIndex = chips.length;

            // Prepare destination chips
            // CAUTION: If isSameWidget, 'chips' array (this.chips) is ALREADY updated effectively by 'sourceWidget.refreshChips()' above?
            // YES. 'sourceWidget' === 'widget'. 'refreshChips' calls 'syncFromWidget' which rebuilds 'chips' from 'widget.value'.
            // So 'chips' now lacks the item. 
            // 'dropIndex' was calculated based on DOM *excluding* the dragging item (css class 'dragging').
            // The DOM still HAS the dragging item until 'renderChips' is called again?
            // Wait, sourceWidget.refreshChips() calls renderChips() which rebuilds DOM... 
            // So the dragging item disappears mid-drop if we refesh immediately? 
            // This might break the 'drop' event execution if the DOM node disppears?
            // JavaScript event continuation usually works, but DOM calculations might be stale.

            // To be safe:
            // The 'placeholder' calculation happened in dragOver (continuous).
            // The 'dropIndex' calculation happened at START of drop, BEFORE we touched sourceWidget.
            // So 'dropIndex' is correct relative to the visual state "before drop".
            // BUT, if isSameWidget, the "visual state" included the item being dragged (hidden or 0.5 opacity).
            // Our Drop Index calculation:
            // "count of chips before placeholder, excluding dragging item".
            // So if we moved item from Index 0 to Index 3.
            // Visual: [Dragging(0)], [1], [2], |Placeholder|, [3]
            // Count before P: [1], [2] -> 2.
            // So we insert at 2.
            // New Array: [1], [2], [Moved(0)], [3].
            // Seems correct.

            // If we moved item from Index 3 to Index 0.
            // Visual: |Placeholder|, [0], [1], [2], [Dragging(3)]
            // Count before P: 0.
            // New Array: [Moved(3)], [0], [1], [2].
            // Correct.

            // The only issue is if 'refreshChips()' updates 'chips' array.
            // We need to fetch the LATEST chips array (which has item removed) 
            // IF we did refresh.
            // OR we can operate on a local copy.

            // Since we called refreshChips(), 'chips' is updated to exclude the item.
            // So we can just splice insert.

            // We need to re-fetch chips incase refreshChips replaced the reference or updated it
            if (isSameWidget) {
                // chips is already updated by refreshChips()
            } else {
                // standard append
            }

            chips.splice(dropIndex, 0, droppedText);
            updateWidgetValue();
            renderChips();

        } catch (err) {
            console.error(err);
        }
    });

    // Attach refresh method to widget so others can trigger it
    widget.refreshChips = () => {
        syncFromWidget();
    };

    // Override the widget's default DOM drawing to show our container?
    // ComfyUI canvas widgets don't naturally stick DOM elements to the canvas node coordinates.
    // We have to manage the DOM element position manually in the draw loop OR 
    // inject it into the widget parameters if it supports a 'dom' element.
    //
    // However, looking at ComfyUI standard widgets:
    // They usually only create input elements when you CLICK them.
    //
    // For this request, a persistent "Chips" view is desired. 
    // This is best achieved by converting the widget to a custom DOM widget (like 'combo' but custom).
    //
    // BUT, we are modifying an EXISTING node type's behavior dynamically.
    //
    // Strategy:
    // We will HIDE the canvas drawing of the text.
    // We will append the 'container' to the ComfyUI document body.
    // We will update 'container' position in the node's `onDraw` or `onResize`.

    // 1. Initial Style
    container.style.position = "absolute";
    // container.style.display = "none"; // Initially hidden until computed
    document.body.appendChild(container);

    const originalOnRemove = node.onRemoved;
    node.onRemoved = function () {
        if (originalOnRemove) originalOnRemove.apply(this, arguments);
        container.remove();
    };

    // We need to manage visibility/position
    const updatePosition = () => {
        if (!node.graph || !app.canvas) {
            container.style.display = "none";
            return;
        }

        // Check if node is visible/on screen?
        // Basic visible check:
        // app.canvas.ds (scale)
        // app.canvas.offset (translate)

        // Find widget position relative to node
        // Widget 'y' is computed. We might need to guess or calculator.
        // ComfyUI widgets usually have 'last_y' property after draw?

        // Actually, let's look at `node.inputs` or `node.widgets`.
        // `widget.last_y` is often populated by `computeSize`.

        // Let's hook into the node's `onDraw` to get precise coordinates.
    };

    // Instead of complex onDraw hook (which runs every frame), 
    // let's follow the pattern of some custom nodes that use DOM overlays.
    // We need to override the widget's `draw` method.

    widget.draw = function (ctx, node, widgetWidth, y, widgetHeight) {
        // We don't draw the text.
        // We just update the DOM element position.

        // Transform canvas coordinates to screen coordinates
        // Canvas Transform: 
        // screenX = (nodeX + widgetX) * scale + offsetX
        const transform = ctx.getTransform();
        const scale = app.canvas.ds.scale;
        const offset = app.canvas.ds.offset;

        // Node position
        const nodeX = node.pos[0];
        const nodeY = node.pos[1];

        // Widget relative position
        // y is passed in.

        // Calculate screen position
        // This is tricky because `ctx` already has transforms applied for the Node?
        // Usually ComfyUI calls widget.draw with context translated to node content area.

        // Actually, ctx is translated to (node.pos[0], node.pos[1]) usually? 
        // No, LiteGraph usually handles this.

        // Let's use `app.canvas.convertOffsetToCanvas(x,y)` inverted?

        // Simpler: Use `node.getBoundingClientRect()` equivalent? No.

        // Let's try to calculate from `transform`.
        // transform.e -> translation X (screen)?? depends on browser.
        // Better to use `app.canvas.convertPosToDOM([x, y])` if available? 
        // No, but we can calculate:
        // screenX = (node.pos[0] + offset[0]) * scale
        // screenY = (node.pos[1] + y + offset[1]) * scale

        // Actually: 
        // output_x = (x * state.scale) + state.offset_x 

        // Correct logic for LiteGraph canvas:
        const x = node.pos[0]; // Node left
        const w = node.size[0]; // Node width
        // y is the relative Y of the widget start inside the node

        // We want the DOM element to cover the widget area.
        // Widget area width is roughly `w - 20`? `widgetWidth` is passed.

        // DOM coords:
        // canvas origin in window is usually 0,0 (unless embedded).

        const canvasOrigin = app.canvas.canvas.getBoundingClientRect(); // relative to viewport

        const zoom = app.canvas.ds.scale;
        const panX = app.canvas.ds.offset[0];
        const panY = app.canvas.ds.offset[1];

        // Pos on canvas
        const absoluteX = x;
        const absoluteY = y + node.pos[1];

        // Pos on screen
        const screenX = (absoluteX + panX) * zoom + canvasOrigin.left;
        const screenY = (absoluteY + panY) * zoom + canvasOrigin.top;

        // We set the Unscaled width, and let transform scale it
        container.style.width = `${widgetWidth}px`;

        container.style.left = `${screenX}px`;
        container.style.top = `${screenY}px`;

        // Visibility check
        const isHidden = (node.flags && node.flags.collapsed);
        container.style.display = isHidden ? "none" : "flex";

        container.style.transformOrigin = "0 0";
        container.style.transform = `scale(${zoom})`;

        // IMPORTANT: If we grow in height, we need to tell the node to grow.
        // We can measure the container's height and update `widget.computedHeight`?

        const clientHeight = container.offsetHeight;
        // We need to divide by zoom if we scaled it?
        // No, if we scaled with transform, offsetHeight is the unscaled height? 
        // Wait, 'scale' transform doesn't change layout flow size usually.

        // Logic:
        // 1. We require a certain height.
        // 2. We tell the node widget needs X height.
        // 3. Node redraws and gives us X height.

        // This is a loop.
        // `widget.computeSize` is called by LiteGraph.

    }

    // Override computeSize to reserve space based on our content
    widget.computeSize = function (width) {
        // We need to know how high our content IS.
        // But we can't easily query the hidden/detached DOM for "how high would you be at width W?".
        // Estimate:
        // Basic height = 50.
        // If we have many chips, maybe more.

        // Let's rely on the container's current scrollHeight/offsetHeight if it's attached.
        // Default to a min height.

        let h = 50;
        if (container && container.offsetHeight) {
            h = container.offsetHeight;
        }
        return [width, h];
    }

    // We need to continually resize the node if the container grows?
    // Use ResizeObserver on the container.
    const observer = new ResizeObserver(() => {
        if (!node.size) return;

        // node.computeSize() returns the MINIMUM size required by widgets.
        const minSize = node.computeSize();

        // Use current width, but ensure it's at least minWidth from computeSize
        const currentWidth = node.size[0];
        const newWidth = Math.max(currentWidth, minSize[0]);

        // Update height to fit content (minSize[1] will typically include the height we requested in computeSize)
        // If the current height is different from needed, OR current width is less than min width, resize.

        // Note: We should check if we really need to resize to avoid loop.
        if (Math.abs(node.size[1] - minSize[1]) > 5 || currentWidth < minSize[0]) {
            node.setSize([newWidth, minSize[1]]);
            node.setDirtyCanvas(true, true);
        }
    });

    observer.observe(container);

}
