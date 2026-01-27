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
    }
    
    .comfy-chip {
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

    // Helper to sync value BACK to the widget
    function updateWidgetValue() {
        const newValue = chips.join(", ");
        widget.value = newValue;
        if (widget.callback) widget.callback(newValue);
        app.graph.setDirtyCanvas(true, true);
    }

    // Helper to render chips in our container
    function renderChips() {
        // Clear existing chips from DOM (keep input)
        // Array.from(container.children).forEach(child => {
        //     if (child !== input) container.removeChild(child);
        // });
        // The above re-appending input loses focus. Better:

        while (container.firstChild && container.firstChild !== input) {
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
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            const val = input.value.trim();
            if (val) {
                chips.push(val);
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

    // Container dragover/drop
    container.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        return false;
    });

    container.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent ComfyUI from handling this drop

        const rawData = e.dataTransfer.getData("text/plain");
        if (!rawData) return;

        try {
            const data = JSON.parse(rawData);
            if (!data.text) return;

            // Determine where to drop
            // We need to find which chip we dropped over (if any) to insert before it
            // Simple approach: append if not over a chip

            // Logic for reordering or moving

            const isSameWidget = (data.sourceWidgetName === widget.name && data.sourceNodeId === node.id);
            const droppedText = data.text;

            // If dragging within the same list, we remove the original first (to avoid DUPLICATE in transition, 
            // though standard DnD usually does move logic).
            // But wait, if we are the destination, we are responsible for inserting.
            // Responsibilty for REMOVING from source lies where? 
            // 1. Source widget removes it on 'drop' success? Hard to communicate across closures.
            // 2. We handle both if we have access? 
            //    Global event bus or accessing the node's other widgets?

            // Better approach:
            // The drop handler modifies the DESTINATION.
            // If the source is different, we need to access the Source Widget and remove it there.

            let sourceWidget = null;
            if (data.sourceNodeId === node.id) {
                sourceWidget = node.widgets.find(w => w.name === data.sourceWidgetName);
            } else {
                // Cross-node dragging (advanced, maybe out of scope but let's see if we can support it easily)
                const sourceNode = app.graph.getNodeById(data.sourceNodeId);
                if (sourceNode) {
                    sourceWidget = sourceNode.widgets.find(w => w.name === data.sourceWidgetName);
                }
            }

            // Remove from source
            if (sourceWidget) {
                // We need to parse the source widget's CURRENT value again to be safe 
                // or assume our 'data' index is correct? 
                // Parsing is safer.
                let sourceChips = sourceWidget.value.split(",").map(s => s.trim()).filter(s => s !== "");

                // If same widget, handling index carefully
                if (isSameWidget) {
                    sourceChips.splice(data.index, 1);
                } else {
                    // Start from the specified index, verify text matches
                    if (sourceChips[data.index] === droppedText) {
                        sourceChips.splice(data.index, 1);
                    } else {
                        // Fallback: find first occurrence
                        const idx = sourceChips.indexOf(droppedText);
                        if (idx !== -1) sourceChips.splice(idx, 1);
                    }
                }

                // Update source widget
                const newSourceVal = sourceChips.join(", ");
                sourceWidget.value = newSourceVal;
                if (sourceWidget.callback) sourceWidget.callback(newSourceVal);

                // If source is currently rendering chips (it should be), we need to trigger its refresh.
                // Since 'transformToChips' creates a closure, we don't have direct access to 'renderChips' 
                // of the other widget.
                // WE NEED A WAY TO TRIGGER RE-RENDER.
                // We can use a custom event on the shared styling DOM or simply:
                // Since we updated 'widget.value', if we were observing it, it would update.
                // Let's add an observer or simple polling to 'syncFromWidget' in 'draw' or interval?
                // Or better: dispatch an event on the sourceWidget object itself if JS adds it?

                // Hack: We can attach the refresh function to the widget object temporarily.
                if (sourceWidget.refreshChips) {
                    sourceWidget.refreshChips();
                }
            }

            // Insert into destination
            // Find insertion index based on mouse position
            // getBoundingClientRect of children
            let insertIndex = chips.length;

            // NOTE: 'chips' here is the LOCAL state of the destination widget. 
            // If it's the SAME widget, 'chips' is NOT yet updated with the removal we just did above 
            // (unless we refreshed rely on sourceWidget.refreshChips() which updates 'chips'?).

            // If isSameWidget, we processed 'sourceWidget' which IS 'widget'.
            // So if we called sourceWidget.refreshChips(), 'chips' IS updated (item removed).
            // So we are inserting into the array that already has the item removed.

            // To find position:
            const chipElements = Array.from(container.getElementsByClassName("comfy-chip"));
            // Note: chipElements length might be mismatch if we just removed data but DOM not updated yet.
            // If we called refreshChips(), DOM is updated.

            // Let's calculate insert index relative to the CURRENT DOM (which reflects the state AFTER removal if same widget).

            for (let i = 0; i < chipElements.length; i++) {
                const rect = chipElements[i].getBoundingClientRect();
                if (e.clientX < rect.left + rect.width / 2) {
                    insertIndex = i;
                    break;
                }
            }

            chips.splice(insertIndex, 0, droppedText);
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
