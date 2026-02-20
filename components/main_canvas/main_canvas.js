import * as BezierCurve from "../../js/bezier_curve.js";
import * as FileUtils from "../../js/file_utils.js"

class MainCanvas extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });

        // 组件内部 DOM 引用
        this.lock_guideline_button = null;
        this.lock_guideline_icon = null;
        this.lock_guideline_icon_unlocked = null;
        this.ruler_horizontal = null;
        this.ruler_vertical = null;
        this.main_canvas = null;
        this.main_canvas_large = null;

        // 画布逻辑像素大小
        this.canvas_size_width = 1000;
        this.canvas_size_height = 1000;

        // 标尺的实际像素宽度
        this.ruler_size = 20;

        // 是否正在拖动画布
        this.dragging = false;
        // 本次拖动的起点
        this.drag_start = { x: 0, y: 0 };

        // 是否正在绘制节点延伸出的手柄
        this.painting_handle = false;
        // 拖动手柄的起点，即节点的位置
        this.painting_handle_start = { x: 0, y: 0 };

        // 临时存储正在拖动新创建手柄的引用
        this.new_curve_handle = null;

        this.dragging_node_b = false;
        this.dragging_node_b_ready = false;
        // 临时存储正在拖动已创建节点或手柄点的引用
        this.dragging_node = null;
        this.dragging_node_start = { x: 0, y: 0 };

        // 存储当前路径的上一个主要节点，作为加入新节点的索引之一
        this.last_on_curve_node = null;

        this.scale_min = 0.02;
        this.scale_max = 50;
        this.scale = 0.4;

        this.offset = { x: 0, y: 0 };
        this.offset_start = { x: 0, y: 0 };

        this.guideline_lock = false;

        this.curve_manager = BezierCurve.CurveManager.getInstance();
        this.current_curve = null;

        this.node_selecting = new Set();

        this.new_selected_temp = null;

        this.preview_curve = null;
        this.preview_curve_1 = null;

        this.node_id_i = 0;
        this.path_id_i = 0;

        this.mouse_pos_output = null;

        this.last_mouse_pos_x = 0;
        this.last_mouse_pos_y = 0;
    }

    async connectedCallback() {
        const response = await fetch(new URL("components/main_canvas/main_canvas.html", window.location.href));
        const html = await response.text();

        const temp = document.createElement("div");
        temp.innerHTML = html;

        const template = temp.querySelector('template[data-component="main_canvas"]');
        const content = template.content.cloneNode(true);

        this.shadowRoot.appendChild(content);

        this.lock_guideline_button = this.shadowRoot.getElementById("lock_guideline_button");
        this.lock_guideline_icon = this.shadowRoot.getElementById("lock_guideline_icon");
        this.lock_guideline_icon_unlocked = this.shadowRoot.getElementById("lock_guideline_icon_unlocked");
        this.ruler_horizontal = this.shadowRoot.getElementById("ruler_horizontal");
        this.ruler_vertical = this.shadowRoot.getElementById("ruler_vertical");
        this.main_canvas = this.shadowRoot.getElementById("main_canvas");
        this.main_canvas_large = this.shadowRoot.getElementById("main_canvas_large");

        const base = window.location.href;
        this.lock_guideline_icon.src = new URL(this.lock_guideline_icon.dataset.src, base).href;
        this.lock_guideline_icon_unlocked.src = new URL(this.lock_guideline_icon_unlocked.dataset.src, base).href;
        
        this.lock_guideline_button.addEventListener("mousedown", (e) => {
            this.guideline_lock = !this.guideline_lock;
            if(this.guideline_lock) {
                this.lock_guideline_icon.style.display = "inline";
                this.lock_guideline_icon_unlocked.style.display = "none";
            } else {
                this.lock_guideline_icon.style.display = "none";
                this.lock_guideline_icon_unlocked.style.display = "inline";
            }
        });

        this.update_ruler_loop();

        let wheel_pending = false;
        let last_event = null;

        if(navigator.storage && navigator.storage.persist) {
            const persisted = await navigator.storage.persisted();
            if(!persisted) {
                const granted = await navigator.storage.persist();
                console.log(granted);
            }
        }

        window.addEventListener("wheel", (e) => {
            if(e.ctrlKey || e.altKey)
                e.preventDefault();
            if(wheel_pending)
                return;
            wheel_pending = true;

            const rect = this.main_canvas.getBoundingClientRect();

            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;

            if (e.ctrlKey) {
                e.preventDefault();
                if(this.is_mouse_in_element(e, this.main_canvas_large))
                {
                    this.change_canvas_size(e.deltaY, x, y, false);
                }
            } else if (e.altKey) {
                e.preventDefault();
                if(this.is_mouse_in_element(e, this.main_canvas_large))
                {
                    this.change_canvas_size(e.deltaY, x, y, true);
                }
            }

            requestAnimationFrame(() => {
                wheel_pending = false;
            });

            this.update_preview(e);
        }, { passive: false });

        this.main_canvas_large.addEventListener("mousedown", (e) => {
            if(e.button === 0) {
                this.preview_curve && (this.preview_curve.style.display = "none");
                this.preview_curve_1 && (this.preview_curve_1.style.display = "none");
                const target = e.target;
                if(target.dataset.type !== "vertex") {
                    // 在空白位置按下左键，创建节点
                    const rect = this.main_canvas.getBoundingClientRect();
                    const rect_large = this.main_canvas_large.getBoundingClientRect();
                    const x = e.clientX;
                    const y = e.clientY;

                    if(this.current_curve === null) {
                        this.current_curve = this.curve_manager.add_curve("a");
                    }
                    let new_curve_node = this.create_node(x, y, this.main_canvas, this.main_canvas_large, BezierCurve.param_set["1"]["oncurve_fill_color"], BezierCurve.param_set["1"]["oncurve_stroke_color"], "square", "test_id", "vertex", 4, 1, 0);
                    
                    this.curve_manager.add_node_by_curve(new_curve_node, "curve", (x - rect.left) / this.scale, (y - rect.top) / this.scale, null, this.last_on_curve_node, this.current_curve, String(this.node_id_i))?.update_svg_curve(this.main_canvas, this.main_canvas_large, this.scale);
                    this.node_id_i += 1;

                    this.last_on_curve_node = new_curve_node;
                    this.clear_select();
                    this.add_select(this.last_on_curve_node);

                    this.painting_handle = true;
                    this.painting_handle_start = { x, y };
                }
            } else if(e.button === 1) {
                if(this.is_mouse_in_element(e, this.main_canvas_large)) {
                    e.preventDefault();
                    document.body.style.cursor = "grab";
                    this.dragging = true;
                    this.drag_start = { x: e.clientX, y: e.clientY };
                    this.offset_start = { x: this.offset.x, y: this.offset.y };
                }
            } else if(e.button === 2) {
                this.reset_curve_drawing();
                console.log(this.save_file());
            }
        }, { passive: false });

        window.addEventListener("mousemove", (e) => {
            const rect = this.main_canvas.getBoundingClientRect();
            const rect_large = this.main_canvas_large.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;
            this.last_mouse_pos_x = e.clientX;
            this.last_mouse_pos_y = e.clientY;

            if(this.mouse_pos_output !== null && this.mouse_pos_output !== undefined) {
                this.mouse_pos_output.textContent = "Mouse Pos " + String(((x - rect.left) / this.scale).toFixed(2)) + " " + String((1000 - (y - rect.top) / this.scale).toFixed(2));
            } else {
                this.mouse_pos_output = document.querySelector("#mouse_pos");
            }

            if((e.buttons & 4) !== 0 && this.dragging === true && this.is_mouse_in_element(e, this.main_canvas_large)) {

                // 按下中键时移动，更新画布拖动数据
                const dx = e.clientX - this.drag_start.x;
                const dy = e.clientY - this.drag_start.y;

                this.offset = { x: this.offset_start.x + dx, y: this.offset_start.y + dy };

            } else if((e.buttons & 1) !== 0 && this.painting_handle === true) {
                // 按下左键时移动，正在拖动手柄
                if(this.new_curve_handle === null && (Math.abs(x - this.painting_handle_start.x) > 1 || Math.abs(y - this.painting_handle_start.y) > 1)) {
                    // 还没有创建过手柄点，且值得创建
                    this.new_curve_handle = this.create_node(x, y, this.main_canvas, this.main_canvas_large, BezierCurve.param_set["1"]["control_fill_color"], BezierCurve.param_set["1"]["control_stroke_color"], "circle", "test_id", "vertex", 4, 1, 0);
                    
                    this.curve_manager.add_node_by_curve(this.new_curve_handle, null, (x - rect.left) / this.scale, (y - rect.top) / this.scale, this.last_on_curve_node, null, this.current_curve, String(this.node_id_i));
                    this.node_id_i += 1;

                    // 添加对称手柄
                    let other_x = 2 * this.curve_manager.find_node_by_curve(this.last_on_curve_node).x - x, other_y = 2 * this.curve_manager.find_node_by_curve(this.last_on_curve_node).y - y;
                    this.curve_manager.add_node_by_curve(this.create_node(other_x, other_y, this.main_canvas, this.main_canvas_large, BezierCurve.param_set["1"]["control_fill_color"], BezierCurve.param_set["1"]["control_stroke_color"], "circle", "test_id", "vertex", 4, 1, 0), null, (other_x - rect.left) / this.scale, (other_y - rect.top) / this.scale, this.last_on_curve_node, null, this.current_curve, String(this.node_id_i));
                    this.node_id_i += 1;
                    this.curve_manager.find_node_by_curve(this.last_on_curve_node).set_both_control(this.new_curve_handle, 2);
                    this.curve_manager.find_node_by_curve(this.last_on_curve_node).update_svg_curve(this.main_canvas, this.main_canvas_large, this.scale);

                    this.add_select(this.last_on_curve_node);
                } else if(this.new_curve_handle !== null) {
                    // 已经创建了手柄点，更新其坐标
                    this.new_curve_handle.style.transform = `translate(${x - Number(this.new_curve_handle.dataset.size)}px, ${y - Number(this.new_curve_handle.dataset.size)}px)`;
                    this.new_curve_handle.dataset.transformx = String(x - Number(this.new_curve_handle.dataset.size));
                    this.new_curve_handle.dataset.transformy = String(y - Number(this.new_curve_handle.dataset.size));

                    this.curve_manager.find_node_by_curve(this.new_curve_handle).x = (x - rect.left) / this.scale;
                    this.curve_manager.find_node_by_curve(this.new_curve_handle).y = (y - rect.top) / this.scale;

                    // 更新对称手柄

                    this.curve_manager.find_node_by_curve(this.last_on_curve_node).set_both_control(this.new_curve_handle, 2);
                    this.curve_manager.find_node_by_curve(this.last_on_curve_node).update_svg_curve(this.main_canvas, this.main_canvas_large, this.scale);
                }
            } else if((e.buttons & 1) !== 0 && this.dragging_node_b_ready === true) {
                // 按下左键时移动，正在拖动已创建的节点
                // 包括主节点和控制手柄
                if(Math.abs(x - this.dragging_node_start.x) > 1 || Math.abs(y - this.dragging_node_start.y) > 1) {
                    this.dragging_node_b = true;
                }
                const dragging_node_n = this.curve_manager.find_node_by_curve(this.dragging_node);
                if(this.dragging_node_b) {
                    if(dragging_node_n.type !== null) {
                        // 是主节点
                        const dx = x - rect_large.left - Number(this.dragging_node.dataset.size) - parseFloat(this.dragging_node.dataset.transformx);
                        const dy = y - rect_large.top - Number(this.dragging_node.dataset.size) - parseFloat(this.dragging_node.dataset.transformy);
                        const new_x = (x - rect.left) / this.scale, new_y = (y - rect.top) / this.scale;

                        //移动场上所有选中的点
                        dragging_node_n?.sync_selected(dx, dy, new_x - dragging_node_n.x, new_y - dragging_node_n.y, this.node_selecting);

                        for(const node of this.node_selecting) {
                            this.curve_manager.find_node_by_curve(node)?.update_svg_curve(this.main_canvas, this.main_canvas_large, this.scale);
                        }
                    } else {
                        // 是控制点
                        this.dragging_node.style.transform = `translate(${x - Number(this.dragging_node.dataset.size)}px, ${y - Number(this.dragging_node.dataset.size)}px)`;
                        this.dragging_node.dataset.transformx = String(x - Number(this.dragging_node.dataset.size));
                        this.dragging_node.dataset.transformy = String(y - Number(this.dragging_node.dataset.size));

                        this.dragging_node_start = { x, y };

                        dragging_node_n.x = (x - rect.left) / this.scale;
                        dragging_node_n.y = (y - rect.top) / this.scale;
                        dragging_node_n.nextOnCurve.set_both_control(this.dragging_node, 0);
                        dragging_node_n.nextOnCurve.update_svg_curve(this.main_canvas, this.main_canvas_large, this.scale);
                    }
                }
            }

            this.update_preview(e);
        }, { passive: false });

        window.addEventListener("mouseup", (e) => {
            if(e.button === 1 && this.dragging === true) {
                // 抬起中键停止拖动画布
                this.dragging = false;
                document.body.style.cursor = "default";
            } else if(e.button === 0) {
                this.preview_curve && (this.preview_curve.style.display = "inline");
                this.preview_curve_1 && (this.preview_curve_1.style.display = "inline");
                this.update_preview(e);

                if(this.painting_handle === true) {
                    // 抬起左键停止拖动手柄
                    this.painting_handle = false;
                    this.new_curve_handle = null;
                }

                if(this.dragging_node_b_ready === true) {
                    // 抬起左键停止拖动正在拖动的点
                    this.dragging_node_b_ready = this.dragging_node_b = false;
                }
            }
        }, { passive: false });

        window.addEventListener("contextmenu", e => {
            e.preventDefault();
        });

        window.addEventListener("keydown", (e) => {
            if(e.code === "Delete") {
                this.delete_selecting();
            }
        });
    }

    // 标尺刻度辅助函数
    getStepAndPrecision(scale) {
        const roughStep = 50 / scale;
        const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
        let step = steps[0];
        for (const s of steps) {
            if (s >= roughStep) {
                step = s;
                break;
            }
        }

        let precision = 0;
        if (step < 1) {
            precision = Math.ceil(-Math.log10(step));
        }
        return { step, precision };
    }

    // 分别更新重绘水平和垂直标尺
    update_ruler() {
        this.update_ruler_horizontal();
        this.update_ruler_vertical();
    }

    update_ruler_loop() {
        this.update_ruler();
        this.update_canvas();
        this.update_node();
        requestAnimationFrame(() => this.update_ruler_loop());
    }

    update_ruler_horizontal() {
        const font_size = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--root-font-size').trim());
        const w = this.ruler_horizontal.getBoundingClientRect().width;
        const h = this.ruler_horizontal.getBoundingClientRect().height;

        this.ruler_horizontal.replaceChildren(); // 清空原有的矢量刻度线


        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", String(w));
        svg.setAttribute("height", String(h));
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";
        svg.style.display = "block";

        const { step, precision } = this.getStepAndPrecision(this.scale);
        const origin = this.offset.x;

        for(let i = 0; ; i += 1) {
            let j = i / 10;
            const x = origin + j * this.scale * step;

            if(x > w + this.scale * step) {
                break;
            }

            if(x < 0 - this.scale * step) {
                continue;
            }

            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", String(x));
            line.setAttribute("y1", String(h));
            line.setAttribute("x2", String(x));
            if(i % 10 == 0) {
                line.setAttribute("y2", "0");

                const text = document.createElementNS(svgNS, "text");
                text.textContent = `${(j * step).toFixed(precision)}`;
                text.setAttribute("x", String(x + 5));
                text.setAttribute("y", String(h / 3));
                text.setAttribute("font-size", "10px");
                text.setAttribute("fill", "#888");
                text.setAttribute("text-anchor", "right");
                text.setAttribute("dominant-baseline", "middle");
                
                svg.appendChild(text);
            } else if(i % 2 == 0) {
                line.setAttribute("y2", String(h / 2));
            } else {
                line.setAttribute("y2", String(h / 4 * 3));
            }
            line.setAttribute("stroke", "#888");
            line.setAttribute("stroke-width", "1");

            svg.appendChild(line);
        }

        for(let i = 0; ; i -= 1) {
        
            let j = i / 10;
            const x = origin + j * this.scale * step;

            if(x < 0 - this.scale * step) {
                break;
            }

            if(x > w + this.scale * step) {
                continue;
            }

            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", String(x));
            line.setAttribute("y1", String(h));
            line.setAttribute("x2", String(x));
            if(i % 10 == 0) {
                line.setAttribute("y2", "0");

                const text = document.createElementNS(svgNS, "text");
                text.textContent = `${(j * step).toFixed(precision)}`;
                text.setAttribute("x", String(x + 5));
                text.setAttribute("y", String(h / 3));
                text.setAttribute("font-size", "10px");
                text.setAttribute("fill", "#888");
                text.setAttribute("text-anchor", "right");
                text.setAttribute("dominant-baseline", "middle");
                
                svg.appendChild(text);
            } else if(i % 2 == 0) {
                line.setAttribute("y2", String(h / 2));
            } else {
                line.setAttribute("y2", String(h / 4 * 3));
            }
            line.setAttribute("stroke", "#888");
            line.setAttribute("stroke-width", "1");

            svg.appendChild(line);
        }

        this.ruler_horizontal.appendChild(svg);
    }

    update_ruler_vertical() {
        const w = this.ruler_vertical.getBoundingClientRect().width;
        const h = this.ruler_vertical.getBoundingClientRect().height;

        this.ruler_vertical.replaceChildren();

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", String(w));
        svg.setAttribute("height", String(h));
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";
        svg.style.display = "block";

        const { step, precision } = this.getStepAndPrecision(this.scale);
        const origin = this.offset.y;


        for(let i = 0; ; i += 1) {
            let j = i / 10;
            const x = origin + j * this.scale * step;

            if(x > h + this.scale * step) {
                break;
            }

            if(x < 0 - this.scale * step) {
                continue;
            }

            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("y1", String(x));
            line.setAttribute("x1", String(w));
            line.setAttribute("y2", String(x));
            if(i % 10 == 0) {
                line.setAttribute("x2", "0");

                const cx = w / 3;
                const cy = x - 5;

                const text = document.createElementNS(svgNS, "text");
                text.textContent = `${(this.canvas_size_height - j * step).toFixed(precision)}`;
                text.setAttribute("x", String(cx));
                text.setAttribute("y", String(cy));
                text.setAttribute("font-size", "10px");
                text.setAttribute("fill", "#888");
                text.setAttribute("text-anchor", "right");
                text.setAttribute("dominant-baseline", "middle");
                text.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);
                
                svg.appendChild(text);
            } else if(i % 2 == 0) {
                line.setAttribute("x2", String(w / 2));
            } else {
                line.setAttribute("x2", String(w / 4 * 3));
            }
            line.setAttribute("stroke", "#888");
            line.setAttribute("stroke-width", "1");

            svg.appendChild(line);
        }

        for(let i = 0; ; i -= 1) {
            let j = i / 10;
            const x = origin + j * this.scale * step;

            if(x < 0 - this.scale * step) {
                break;
            }

            if(x > h + this.scale * step) {
                continue;
            }

            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("y1", String(x));
            line.setAttribute("x1", String(w));
            line.setAttribute("y2", String(x));
            if(i % 10 == 0) {
                line.setAttribute("x2", "0");

                const cx = w / 3;
                const cy = x - 5;

                const text = document.createElementNS(svgNS, "text");
                text.textContent = `${(this.canvas_size_height - j * step).toFixed(precision)}`;
                text.setAttribute("x", String(cx));
                text.setAttribute("y", String(cy));
                text.setAttribute("font-size", "10px");
                text.setAttribute("fill", "#888");
                text.setAttribute("text-anchor", "right");
                text.setAttribute("dominant-baseline", "middle");
                text.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);
                
                svg.appendChild(text);
            } else if(i % 2 == 0) {
                line.setAttribute("x2", String(w / 2));
            } else {
                line.setAttribute("x2", String(w / 4 * 3));
            }
            line.setAttribute("stroke", "#888");
            line.setAttribute("stroke-width", "1");

            svg.appendChild(line);
        }

        this.ruler_vertical.appendChild(svg);
    }

    update_canvas() {
        const left = this.ruler_vertical.getBoundingClientRect().width + this.offset.x;
        const top = this.ruler_horizontal.getBoundingClientRect().height + this.offset.y;

        this.main_canvas.style.transform = `translate(${left}px, ${top}px)`;
        this.main_canvas.style.width = `${this.canvas_size_width * this.scale}px`;
        this.main_canvas.style.height = `${this.canvas_size_height * this.scale}px`;

        this.update_preview({ clientX: this.last_mouse_pos_x, clientY: this.last_mouse_pos_y });
    }

    update_node() {
        let curves = this.curve_manager.get_curves();
        const rect = this.main_canvas.getBoundingClientRect();
        const rect_large = this.main_canvas_large.getBoundingClientRect();
        for(const curve of curves) {
            let start_node = curve.startNode;
            while(start_node !== null) {

                start_node.main_node.style.transform =
                    `translate(${start_node.x * this.scale + rect.left - rect_large.left - Number(start_node.main_node.dataset.size)}px, 
                            ${start_node.y * this.scale + rect.top - rect_large.top - Number(start_node.main_node.dataset.size)}px)`;
                start_node.main_node.dataset.transformx = String(start_node.x * this.scale + rect.left - rect_large.left - Number(start_node.main_node.dataset.size));
                start_node.main_node.dataset.transformy = String(start_node.y * this.scale + rect.top - rect_large.top - Number(start_node.main_node.dataset.size));

                if (start_node.control1 != null) {
                    start_node.control1.main_node.style.transform =
                        `translate(${start_node.control1.x * this.scale + rect.left - rect_large.left - Number(start_node.control1.main_node.dataset.size)}px, 
                                ${start_node.control1.y * this.scale + rect.top - rect_large.top - Number(start_node.control1.main_node.dataset.size)}px)`;
                    start_node.control1.main_node.dataset.transformx = String(start_node.control1.x * this.scale + rect.left - rect_large.left - Number(start_node.control1.main_node.dataset.size));
                    start_node.control1.main_node.dataset.transformy = String(start_node.control1.y * this.scale + rect.top - rect_large.top - Number(start_node.control1.main_node.dataset.size));
                }

                if (start_node.control2 != null) {
                    start_node.control2.main_node.style.transform =
                        `translate(${start_node.control2.x * this.scale + rect.left - rect_large.left - Number(start_node.control2.main_node.dataset.size)}px, 
                                ${start_node.control2.y * this.scale + rect.top - rect_large.top - Number(start_node.control2.main_node.dataset.size)}px)`;
                    start_node.control2.main_node.dataset.transformx = String(start_node.control2.x * this.scale + rect.left - rect_large.left - Number(start_node.control2.main_node.dataset.size));
                    start_node.control2.main_node.dataset.transformy = String(start_node.control2.y * this.scale + rect.top - rect_large.top - Number(start_node.control2.main_node.dataset.size));
                }

                start_node.update_svg_curve(this.main_canvas, this.main_canvas_large, this.scale);
                start_node = start_node.nextOnCurve;
            }
        }
    }

    update_preview(e) {
        const rect = this.main_canvas.getBoundingClientRect();
        const rect_large = this.main_canvas_large.getBoundingClientRect();
        const x = e.clientX - rect_large.left;
        const y = e.clientY - rect_large.top;
        if((e.buttons & 1) === 0 && this.last_on_curve_node !== null) {
            let p0_x = x, p0_y = y;
            let p1_x = p0_x, p1_y = p0_y;
            let p3_x = this.curve_manager.find_node_by_curve(this.last_on_curve_node).x, p3_y = this.curve_manager.find_node_by_curve(this.last_on_curve_node).y;
            let p2_x = this.curve_manager.find_node_by_curve(this.last_on_curve_node).control1?.x ?? p3_x, p2_y = this.curve_manager.find_node_by_curve(this.last_on_curve_node).control1?.y ?? p3_y;

            p2_x *= this.scale, p2_y *= this.scale;
            p3_x *= this.scale, p3_y *= this.scale;


            p2_x += rect.left - rect_large.left;
            p3_x += rect.left - rect_large.left;
            p2_y += rect.top - rect_large.top;
            p3_y += rect.top - rect_large.top;

            let _p3_x = this.curve_manager.find_curve_by_dom(this.last_on_curve_node).startNode.x, _p3_y = this.curve_manager.find_curve_by_dom(this.last_on_curve_node).startNode.y;
            let _p2_x = this.curve_manager.find_curve_by_dom(this.last_on_curve_node).startNode.control2?.x ?? _p3_x, _p2_y = this.curve_manager.find_curve_by_dom(this.last_on_curve_node).startNode.control2?.y ?? _p3_y;

            _p2_x *= this.scale, _p2_y *= this.scale;
            _p3_x *= this.scale, _p3_y *= this.scale;

            _p2_x += rect.left - rect_large.left;
            _p3_x += rect.left - rect_large.left;
            _p2_y += rect.top - rect_large.top;
            _p3_y += rect.top - rect_large.top;


            if(this.preview_curve === null) {
                this.preview_curve = BezierCurve.create_bezier_svg([p0_x, p0_y], [p1_x, p1_y], [p2_x, p2_y], [p3_x, p3_y], 0.5, BezierCurve.param_set["1"]["preview_color"], false, "none", this.main_canvas, this.main_canvas_large);
                this.preview_curve.style.display = "none";
                if(this.curve_manager.find_curve_by_dom(this.last_on_curve_node).closed) {
                    this.preview_curve_1 = BezierCurve.create_bezier_svg([p0_x, p0_y], [p1_x, p1_y], [_p2_x, _p2_y], [_p3_x, _p3_y], 0.5, BezierCurve.param_set["1"]["preview_color"], false, "none", this.main_canvas, this.main_canvas_large);
                    this.preview_curve_1.style.display = "none";
                }
            } else {
                const d = `M ${p0_x},${p0_y} C ${p1_x},${p1_y} ${p2_x},${p2_y} ${p3_x},${p3_y}`;
                const d1 = `M ${p0_x},${p0_y} C ${p1_x},${p1_y} ${_p2_x},${_p2_y} ${_p3_x},${_p3_y}`;
                this.preview_curve.firstElementChild.setAttribute("d", d);
                if(this.preview_curve_1 !== null) {
                    this.preview_curve_1.firstElementChild.setAttribute("d", d1);
                }
            }
        }
    }

    // 存在问题：浏览器限制 transform 范围，因此画布的实际坐标值超过一定范围后将无法正常缩放
    // 可以改写成分块渲染
    change_canvas_size(dy, x, y, fixed) {
        if(fixed) {
            x = this.canvas_size_width / 2 * this.scale, y = this.canvas_size_height / 2 * this.scale;
        }

        let wheel_delta = dy < 0 ? 1.1 : 0.9;
        
        let new_scale = Math.min(Math.max(this.scale * wheel_delta, this.scale_min), this.scale_max);
        if(new_scale == this.scale) {
            return;
        }

        const x_new = x / this.scale * new_scale;
        const y_new = y / this.scale * new_scale;

        this.scale = new_scale;

        this.offset = { x: (this.offset.x + x - x_new), y: (this.offset.y + y - y_new)};
    }

    is_mouse_in_element(e, element) {
        const rect = element.getBoundingClientRect();
        return (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
        );
    }

    clear_select() {
        for(const node of this.node_selecting) {
            node.firstElementChild.setAttribute("fill", BezierCurve.param_set["1"]["oncurve_fill_color"]);
            node.firstElementChild.setAttribute("stroke", BezierCurve.param_set["1"]["oncurve_stroke_color"]);
            const temp_node = this.curve_manager.find_node_by_curve(node);
            temp_node?.control1?.main_node.firstElementChild.setAttribute("fill", BezierCurve.param_set["1"]["control_fill_color"]);
            temp_node?.control1?.main_node.firstElementChild.setAttribute("stroke", BezierCurve.param_set["1"]["control_stroke_color"]);
            temp_node?.control2?.main_node.firstElementChild.setAttribute("fill", BezierCurve.param_set["1"]["control_fill_color"]);
            temp_node?.control2?.main_node.firstElementChild.setAttribute("stroke", BezierCurve.param_set["1"]["control_stroke_color"]);
        }

        this.node_selecting.clear();
    }

    add_select(new_node) {
        this.node_selecting.add(new_node);
        new_node.firstElementChild.setAttribute("stroke", BezierCurve.param_set["1"]["selected_stroke_color"]);
        new_node.firstElementChild.setAttribute("fill", BezierCurve.param_set["1"]["selected_fill_color"]);
        const temp_node = this.curve_manager.find_node_by_curve(new_node);
        temp_node?.control1?.main_node.firstElementChild.setAttribute("fill", BezierCurve.param_set["1"]["selected_fill_color"]);
        temp_node?.control1?.main_node.firstElementChild.setAttribute("stroke", BezierCurve.param_set["1"]["selected_stroke_color"]);
        temp_node?.control2?.main_node.firstElementChild.setAttribute("fill", BezierCurve.param_set["1"]["selected_fill_color"]);
        temp_node?.control2?.main_node.firstElementChild.setAttribute("stroke", BezierCurve.param_set["1"]["selected_stroke_color"]);
    }

    remove_select(old_node) {
        this.node_selecting.delete(old_node);
        old_node.firstElementChild.setAttribute("stroke", BezierCurve.param_set["1"]["oncurve_stroke_color"]);
        old_node.firstElementChild.setAttribute("fill", BezierCurve.param_set["1"]["oncurve_fill_color"]);
        const temp_node = this.curve_manager.find_node_by_curve(old_node);
        temp_node?.control1?.main_node.firstElementChild.setAttribute("fill", BezierCurve.param_set["1"]["control_fill_color"]);
        temp_node?.control1?.main_node.firstElementChild.setAttribute("stroke", BezierCurve.param_set["1"]["control_stroke_color"]);
        temp_node?.control2?.main_node.firstElementChild.setAttribute("fill", BezierCurve.param_set["1"]["control_fill_color"]);
        temp_node?.control2?.main_node.firstElementChild.setAttribute("stroke", BezierCurve.param_set["1"]["control_stroke_color"]);
    }

    delete_selecting() {
        if(!this.painting_handle && this.current_curve === null && !this.dragging_node_b) {
            for(const node of this.node_selecting) {
                this.curve_manager.find_curve_by_dom(node).remove_node_by_dom(node, this.main_canvas, this.main_canvas_large, this.scale);
            }

            this.node_selecting = new Set();
        }
        
    }

    reset_curve_drawing() {
        this.current_curve = null;
        this.last_on_curve_node = null;
        this.preview_curve?.remove();
        this.preview_curve = null;
        this.preview_curve_1?.remove();
        this.preview_curve_1 = null;
        this.path_id_i += 1;
        this.new_curve_handle = null;
    }

    // 创建表示 node 的 svg
    create_node(
        x,
        y,
        container,
        container_large,
        color_fill,
        color_stroke,
        kind,
        id,
        type,
        size,
        strokeWidth,
        rotation = 0
    ) {
        const rect = container_large.getBoundingClientRect();
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", (size * 2).toString());
        svg.setAttribute("height", (size * 2).toString());
        svg.style.position = "absolute";

        svg.style.left = "0px";
        svg.style.top = "0px";

        svg.style.overflow = "visible";
        svg.style.zIndex = "100";

        svg.dataset.size = size.toString();

        if (kind === "circle") {
            const circle = document.createElementNS(svgNS, "circle");
            circle.setAttribute("cx", size.toString());
            circle.setAttribute("cy", size.toString());
            circle.setAttribute("r", size.toString());
            circle.setAttribute("stroke", color_stroke);
            circle.setAttribute("stroke-width", strokeWidth.toString());
            circle.setAttribute("fill", color_fill);

            circle.dataset.id = id;
            circle.dataset.type = type;

            // 鼠标悬停时放大
            circle.addEventListener("mouseenter", () => {
                const newSize = size * 1.2;
                circle.setAttribute("r", newSize.toString());
            });

            circle.addEventListener("mouseleave", () => {
                circle.setAttribute("r", size.toString());
            });

            svg.appendChild(circle);
        } else {
            const rect = document.createElementNS(svgNS, "rect");
            rect.setAttribute("x", "0");
            rect.setAttribute("y", "0");
            rect.setAttribute("width", (size * 2).toString());
            rect.setAttribute("height", (size * 2).toString());
            rect.setAttribute("rx", (size * 0.25).toString()); // 圆角
            rect.setAttribute("stroke", color_stroke);
            rect.setAttribute("stroke-width", strokeWidth.toString());
            rect.setAttribute("fill", color_fill);

            rect.dataset.id = id;
            rect.dataset.type = type;

            if (rotation !== 0) {
                rect.setAttribute("transform", `rotate(${rotation} ${size} ${size})`);
            }

            // 鼠标悬停时放大
            rect.addEventListener("mouseenter", () => {
                const newSize = size * 1.2;
                rect.setAttribute("width", (newSize * 2).toString());
                rect.setAttribute("height", (newSize * 2).toString());
                rect.setAttribute("rx", (newSize * 0.25).toString()); // 圆角
                rect.setAttribute("x", `${(size - newSize)}`);
                rect.setAttribute("y", `${(size - newSize)}`);
            });

            rect.addEventListener("mouseleave", () => {
                rect.setAttribute("width", (size * 2).toString());
                rect.setAttribute("height", (size * 2).toString());
                rect.setAttribute("rx", (size * 0.25).toString()); // 圆角
                rect.setAttribute("x", "0");
                rect.setAttribute("y", "0");
            });

            svg.appendChild(rect);
        }

        svg.addEventListener("mousedown", (e) => {
            if(e.button === 0) {
                const x = e.clientX;
                const y = e.clientY;
                this.dragging_node_start = { x, y };
                this.dragging_node_b_ready = true;
                this.dragging_node = svg;

                if(!e.ctrlKey && svg.firstElementChild.tagName === "rect") {
                    if(!this.node_selecting.has(svg)) {
                        this.clear_select();
                    }

                    this.add_select(svg);
                    this.new_selected_temp = svg;
                } else if(e.ctrlKey && svg.firstElementChild.tagName === "rect") {
                    if(!this.node_selecting.has(svg)) {
                        this.add_select(svg);
                        this.new_selected_temp = svg;
                    }
                }
            }
        });

        svg.addEventListener("mouseup", e => {
            if(e.button === 0) {
                if(svg.firstElementChild.tagName === "rect" && !this.dragging_node_b && !e.ctrlKey) {
                    this.clear_select();
                    this.add_select(svg);
                } else if(e.ctrlKey && svg.firstElementChild.tagName === "rect" && !this.dragging_node_b) {
                    if(this.node_selecting.has(svg) && svg != this.new_selected_temp) {
                        this.remove_select(svg);
                    }
                }

                this.new_selected_temp = null;
            }
        })

        svg.addEventListener("wheel", e => {
            if(!e.ctrlKey && !e.altKey && svg.firstElementChild.tagName === "rect") {
                e.preventDefault();
                if(e.deltaY < 0) {
                    if(!this.node_selecting.has(svg)) {
                        this.add_select(svg);
                        this.new_selected_temp = svg;
                    } else {
                        const start_node = this.curve_manager.find_node_by_curve(svg);
                        let this_node = start_node?.nextOnCurve;
                        while(this_node != null) {
                            if(!this.node_selecting.has(this_node.main_node)) {
                                this.add_select(this_node.main_node);
                                this.new_selected_temp = this_node.main_node;
                                break;
                            }

                            this_node = this_node.nextOnCurve;
                        }
                    }
                } else {
                    // 反向滚动滚轮，从取消选中暂时改成反向选中
                    // if(node_selecting.has(svg)) {
                    //     remove_select(svg);
                    // } else {
                    //     const start_node = curve_manager.find_node_by_curve({ main_node: svg });
                    //     let this_node = start_node?.nextOnCurve;
                    //     while(this_node != null) {
                    //         if(node_selecting.has(this_node.main_node)) {
                    //             remove_select(this_node.main_node);
                    //             break;
                    //         }

                    //         this_node = this_node.nextOnCurve;
                    //     }
                    // }

                    if(!this.node_selecting.has(svg)) {
                        this.add_select(svg);
                        this.new_selected_temp = svg;
                    } else {
                        const start_node = this.curve_manager.find_node_by_curve(svg);
                        let this_node = start_node?.lastOnCurve;
                        while(this_node != null) {
                            if(!this.node_selecting.has(this_node.main_node)) {
                                this.add_select(this_node.main_node);
                                this.new_selected_temp = this_node.main_node;
                                break;
                            }

                            this_node = this_node.lastOnCurve;
                        }
                    }
                }
            }
        });

        container_large.appendChild(svg);
        return svg;
    }

    save_file() {
        let file = {
            "canvas_size_width": this.canvas_size_width,
            "canvas_size_height": this.canvas_size_height,
            "family_name": "default",
            "basic_spacing": 1000,
            "editor_scale": this.scale,
            "editor_offset_x": this.offset.x,
            "editor_offset_y": this.offset.y,
            "editor_guideline_h": [
                500
            ],
            "editor_guideline_v": [
                500
            ],
            "editor_guideline_lock": false,
            "editor_edit_mode": "pen",
            "editor_cutting_board": [
                "a"
            ],
            "editor_fill_color": BezierCurve.param_set["1"]["path_fill_color"],
            "editor_stroke_color": BezierCurve.param_set["1"]["path_stroke_color"],
            "ch": {

            },
            "components": {

            }
        };

        let component_id = "1";
        let ch = "a";
        file.ch[ch] = {
            "variant": {

            },
            "spacing": 1,
            "hooks_id": [

            ],
            "components": {

            },
            "editor_hide": false, "editor_lock": false
        };
        file.ch[ch].components[component_id] = {
            "component_id": "1",
            "transform": "none"
        };
        file.components[component_id] = {
            "paths": {

            },
            "editor_hide": false, "editor_lock": false,
            "editor_selected": false,
            "components": [

            ]
        };
        let path_id_cnt = 0;
        for(let curve of this.curve_manager.get_curves()) {
            let path_id = String(path_id_cnt);
            path_id_cnt += 1;
            file.components[component_id].paths[path_id] = {
                "fill": curve.closed,
                "stroke_width": curve.stroke_width,
                "render_mode": "auto",
                "vertices": {

                },
                "editor_hide": false, "editor_lock": false,
                "editor_selected": false
            };
            let this_node = curve.startNode;
            while(this_node != null) {
                file.components[component_id].paths[path_id].vertices[this_node.node_id] = {
                    "x": this_node.x,
                    "y": this.canvas_size_height - this_node.y,
                    "start": this_node === curve.startNode,
                    "end": this_node === curve.endNode,
                    "smooth": this_node.smooth,
                    "editor_selected": false, ////
                    "relate_last": this_node.node_id, "relate_next": this_node.node_id,
                    "control_1": {
                        "active": this_node.control1 !== null,
                        "x": this_node.control1?.x ?? this_node.x,
                        "y": this.canvas_size_height - (this_node.control1?.y ?? this_node.y),
                    },
                    "control_2": {
                        "active": this_node.control2 !== null,
                        "x": this_node.control2?.x ?? this_node.x,
                        "y": this.canvas_size_height - (this_node.control2?.y ?? this_node.y),
                    }
                };

                this_node = this_node.nextOnCurve;
            }
        }

        return JSON.stringify(file, null, 4);
    }

}

customElements.define("main-canvas", MainCanvas);
