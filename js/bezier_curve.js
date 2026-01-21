export let param_set = {
    "1": {
        "path_stroke_color": "rgba(127, 127, 127, 1)",
        "path_fill_color": "rgba(0,0,0,1)",
        "control_ahead_color": "rgba(0, 0, 255, 0.6)",
        "control_back_color": "rgba(255, 0, 0, 0.6)",
        "preview_color": "rgba(0, 255, 0, 0.6)",
        "oncurve_stroke_color": "rgba(113, 201, 206, 1)",
        "oncurve_fill_color": "rgba(113, 201, 206, 0.6)",
        "control_stroke_color": "rgba(166, 227, 233, 1)",
        "control_fill_color": "rgba(166, 227, 233, 0.6)",
        "selected_fill_color": "rgba(249, 237, 105, 0.6)",
        "selected_stroke_color": "rgba(249, 237, 105, 1)",
        "body_bg_color": "rgba(240, 255, 255, 0.5)",

        "control_line_width": 1,
        "path_stroke_width": 1,
    },
    "2": {
        "path_stroke_color": "rgba(170, 150, 218, 1)",
        "path_fill_color": "rgba(0,0,0,1)",
        "control_ahead_color": "rgba(168, 216, 234, 0.6)",
        "control_back_color": "rgba(252, 186, 211, 0.6)",
        "preview_color": "rgba(170, 150, 218, 0.6)",
        "oncurve_stroke_color": "rgba(113, 201, 206, 1)",
        "oncurve_fill_color": "rgba(113, 201, 206, 0.6)",
        "control_stroke_color": "rgba(166, 227, 233, 1)",
        "control_fill_color": "rgba(166, 227, 233, 0.6)",
        "selected_fill_color": "rgba(249, 237, 105, 0.6)",
        "selected_stroke_color": "rgba(249, 237, 105, 1)",
        "body_bg_color": "rgba(240, 255, 255, 0.5)",

        "control_line_width": 1,
        "path_stroke_width": 1,
    }
}

export class CurveNode {
    // readonly main_node: SVGSVGElement;
    main_node;
    // type: string | null; // move/line/curve/null
    type; // move/line/curve/null
    x;
    y;
    // nextOnCurve: CurveNode | null;
    nextOnCurve;
    // lastOnCurve: CurveNode | null;
    lastOnCurve;
    // control1: CurveNode | null = null;
    control1 = null;
    // control2: CurveNode | null = null;
    control2 = null;
    smooth = false;
    end_node = false;
    start_node = false;
    // control_mode: Number = 2; // 0 不同步手柄 | 1 同步方向 | 2 同步方向和长度
    control_mode = 2; // 0 不同步手柄 | 1 同步方向 | 2 同步方向和长度
    // synmove_mode: Number = 1; // 0 不使手柄与主节点一起移动 | 1 相对
    synmove_mode = 1; // 0 不使手柄与主节点一起移动 | 1 相对
    // 如果是主节点，则传入时暂无控制点，必须附带前继点，不会附带后继点
    // 如果是控制点，传入时必须附带后继点，即其对应主节点
    // 主节点必然先于控制点创建

    // nextCurve: SVGSVGElement | null = null;
    nextCurve = null;
    // control1_conn: SVGSVGElement | null = null;
    control1_conn = null;
    // control2_conn: SVGSVGElement | null = null;
    control2_conn = null;
    node_id;

    constructor(
        main_node,
        type,
        x,
        y,
        nextOnCurve,
        lastOnCurve,
        node_id
    ) {
        this.main_node = main_node;
        this.type = type;
        this.x = x;
        this.y = y;
        this.lastOnCurve = lastOnCurve;
        this.nextOnCurve = nextOnCurve;
        this.node_id = node_id;
    }

    // 移动一个手柄时同步另一个
    set_both_control(
        one_control,
        control_mode // 如果为 2 则覆盖本地设置
    ) {

        let other_control = (this.control1?.main_node === one_control) ? this.control2 : this.control1;
        let one_control_n = CurveManager.getInstance().find_node_by_curve(one_control);
        if(other_control === null || one_control_n === null)
            return;

        const transform_1_x = one_control_n.main_node.dataset.transformx;
        const transform_1_y = one_control_n.main_node.dataset.transformy;
        const transform_2_x = this.main_node.dataset.transformx;
        const transform_2_y = this.main_node.dataset.transformy;

        if(control_mode === 2 || this.control_mode === 2) {
            other_control.x = 2 * this.x - one_control_n.x;
            other_control.y = 2 * this.y - one_control_n.y;
            other_control.main_node.style.transform =
                `translate(${(2 * transform_2_x - transform_1_x)}px, ${(2 * transform_2_y - transform_1_y)}px)`;
        } else if(this.control_mode === 1) {

        }
    }

    // 移动主节点时同步手柄
    sync_control_with_main(
        dx,
        dy,
        logic_dx,
        logic_dy,
        synmove_mode // 为 1 则覆盖本地设置
    ) {
        if(this.synmove_mode === 0 && synmove_mode === 0)
            return;
        if(this.control1 !== null) {
            this.control1.main_node.style.transform =
                `translate(${(this.control1.main_node.dataset.transformx + dx)}px, ${(this.control1.main_node.dataset.transformy + dy)}px)`;
            this.control1.x += logic_dx;
            this.control1.y += logic_dy;
        }

        if(this.control2 !== null) {
            this.control2.main_node.style.transform =
                `translate(${(this.control2.main_node.dataset.transformx + dx)}px, ${(this.control2.main_node.dataset.transformy + dy)}px)`;

            this.control2.x += logic_dx;
            this.control2.y += logic_dy;
        }
    }

    // 同步移动所有选中节点
    sync_selected(
        dx,
        dy,
        logic_dx,
        logic_dy,
        node_list
    ) {
        for(const node of node_list) {
            const node_n = CurveManager.getInstance().find_node_by_curve(node);
            node_n.sync_control_with_main(dx, dy, logic_dx, logic_dy, 0);
            node_n.x += logic_dx;
            node_n.y += logic_dy;
            node.style.transform =
                `translate(${(node.dataset.transformx + dx)}px, ${(node.dataset.transformy + dy)}px)`;
        }
    }

    // 更新和节点相关的所有 SVG
    update_svg_curve(container, scale) {
        let stroke_width = CurveManager.getInstance()
            .find_curve_by_dom(this.main_node).stroke_width;

        if(this.control1 !== null) {
            let x1 = this.x, y1 = this.y;
            let x2 = this.control1.x, y2 = this.control1.y;

            x1 *= scale;
            y1 *= scale;
            x2 *= scale;
            y2 *= scale;

            if(this.control1_conn === null) {
                this.control1_conn = create_line_svg(
                    [x1, y1],
                    [x2, y2],
                    0.5,
                    param_set["1"]["control_ahead_color"],
                    container
                );
            } else {
                this.control1_conn.firstElementChild.setAttribute("x1", x1.toString());
                this.control1_conn.firstElementChild.setAttribute("y1", y1.toString());
                this.control1_conn.firstElementChild.setAttribute("x2", x2.toString());
                this.control1_conn.firstElementChild.setAttribute("y2", y2.toString());
            }
        }

        if(this.control2 !== null) {
            let x1 = this.x, y1 = this.y;
            let x2 = this.control2.x, y2 = this.control2.y;

            x1 *= scale;
            y1 *= scale;
            x2 *= scale;
            y2 *= scale;

            if(this.control2_conn === null) {
                this.control2_conn = create_line_svg(
                    [x1, y1],
                    [x2, y2],
                    0.5,
                    param_set["1"]["control_back_color"],
                    container
                );
            } else {
                this.control2_conn.firstElementChild.setAttribute("x1", x1.toString());
                this.control2_conn.firstElementChild.setAttribute("y1", y1.toString());
                this.control2_conn.firstElementChild.setAttribute("x2", x2.toString());
                this.control2_conn.firstElementChild.setAttribute("y2", y2.toString());
            }
        }

        if(this.nextOnCurve !== null) {
            let p0_x = this.x, p0_y = this.y;
            let p1_x = (this.control1?.x ?? p0_x), p1_y = (this.control1?.y ?? p0_y);
            let p3_x = this.nextOnCurve.x, p3_y = this.nextOnCurve.y;
            let p2_x = (this.nextOnCurve.control2?.x ?? p3_x),
                p2_y = (this.nextOnCurve.control2?.y ?? p3_y);

            p0_x *= scale;
            p0_y *= scale;
            p1_x *= scale;
            p1_y *= scale;
            p2_x *= scale;
            p2_y *= scale;
            p3_x *= scale;
            p3_y *= scale;

            if(this.nextCurve === null) {
                this.nextCurve = create_bezier_svg(
                    [p0_x, p0_y],
                    [p1_x, p1_y],
                    [p2_x, p2_y],
                    [p3_x, p3_y],
                    stroke_width,
                    param_set["1"]["path_stroke_color"],
                    false,
                    "none",
                    container
                );
            } else {
                const path = this.nextCurve.querySelector("path");
                if(path) {
                    const d =
                        `M ${p0_x},${p0_y} C ${p1_x},${p1_y} ${p2_x},${p2_y} ${p3_x},${p3_y}`;
                    path.setAttribute("d", d);
                }
            }
        }

        let temp_start = CurveManager.getInstance().find_curve_by_dom(this.main_node);
        if(this.nextOnCurve === null && temp_start?.closed && temp_start.startNode !== this) {
            let p0_x = this.x, p0_y = this.y;
            let p1_x = (this.control1?.x ?? p0_x), p1_y = (this.control1?.y ?? p0_y);
            let p3_x = temp_start.startNode.x, p3_y = temp_start.startNode.y;
            let p2_x = (temp_start.startNode.control2?.x ?? p3_x),
                p2_y = (temp_start.startNode.control2?.y ?? p3_y);

            p0_x *= scale;
            p0_y *= scale;
            p1_x *= scale;
            p1_y *= scale;
            p2_x *= scale;
            p2_y *= scale;
            p3_x *= scale;
            p3_y *= scale;

            if(this.nextCurve === null) {
                this.nextCurve = create_bezier_svg(
                    [p0_x, p0_y],
                    [p1_x, p1_y],
                    [p2_x, p2_y],
                    [p3_x, p3_y],
                    stroke_width,
                    param_set["1"]["path_stroke_color"],
                    false,
                    "none",
                    container
                );
            } else {
                const path = this.nextCurve.querySelector("path");
                if(path) {
                    const d =
                        `M ${p0_x},${p0_y} C ${p1_x},${p1_y} ${p2_x},${p2_y} ${p3_x},${p3_y}`;
                    path.setAttribute("d", d);
                }
            }
        }

        if(this.lastOnCurve !== null) {
            let p0_x = this.lastOnCurve.x, p0_y = this.lastOnCurve.y;
            let p1_x = (this.lastOnCurve.control1?.x ?? p0_x),
                p1_y = (this.lastOnCurve.control1?.y ?? p0_y);
            let p3_x = this.x, p3_y = this.y;
            let p2_x = (this.control2?.x ?? p3_x),
                p2_y = (this.control2?.y ?? p3_y);

            p0_x *= scale;
            p0_y *= scale;
            p1_x *= scale;
            p1_y *= scale;
            p2_x *= scale;
            p2_y *= scale;
            p3_x *= scale;
            p3_y *= scale;

            if(this.lastOnCurve.nextCurve === null) {
                this.lastOnCurve.nextCurve = create_bezier_svg(
                    [p0_x, p0_y],
                    [p1_x, p1_y],
                    [p2_x, p2_y],
                    [p3_x, p3_y],
                    stroke_width,
                    param_set["1"]["path_stroke_color"],
                    false,
                    "none",
                    container
                );
            } else {
                const path = this.lastOnCurve.nextCurve.querySelector("path");
                if(path) {
                    const d =
                        `M ${p0_x},${p0_y} C ${p1_x},${p1_y} ${p2_x},${p2_y} ${p3_x},${p3_y}`;
                    path.setAttribute("d", d);
                }
            }
        }

        if(this.lastOnCurve === null && temp_start?.closed &&
            temp_start.endNode !== null && temp_start.endNode !== this) {
            temp_start.endNode.update_svg_curve(container, scale);
        }

        const curve_manager = CurveManager.getInstance();
        curve_manager.find_curve_by_dom(this.main_node)?.update_path(container);
    }
}


export class Curve {
    // startNode: CurveNode | null = null;
    startNode = null;
    // endNode: CurveNode | null = null;
    endNode = null;
    id;
    class_id;
    // path_d: string = "";
    path_d = "";
    // curve: SVGSVGElement | null = null;
    curve = null;
    // closed: boolean = true;
    closed = true;
    // stroke_width: number = 1;
    stroke_width = 1;

    constructor(params) {
        this.id = params.id;
        this.class_id = params.class_id;
    }

    // private domMap: Map<SVGSVGElement, CurveNode> = new Map();
    domMap = new Map();

    // 自动向当前曲线中插入节点
    add_node(
        main_node,
        type,
        x,
        y,
        nextOnCurve,
        lastOnCurve,
        node_id
    ) {
        if(type === null) { // 如果传入控制点，则必须传入 nextOnCurve 作为对应主节点
            if(nextOnCurve === null)
                return null;
            const node = new CurveNode(main_node, type, x, y, nextOnCurve, null, node_id);
            if(node.nextOnCurve.control1 === null)
                node.nextOnCurve.control1 = node;
            else
                node.nextOnCurve.control2 = node;
            this.domMap.set(node.main_node, node);
            return node;
        } else {
            let last = lastOnCurve;
            let end_flag = false;
            if (!last && this.startNode) { // 如果传入主节点，当前曲线不为空，且未传入前继节点，则自动插入尾部或自动插入为开始和终止节点
                end_flag = true;
                last = this.endNode;
            }

            if(lastOnCurve?.nextOnCurve === null)
                end_flag = true;

            const node = new CurveNode(main_node, type, x, y, null, last, node_id);

            if (last) { // 正常插入或插入尾部
                node.nextOnCurve = last.nextOnCurve;
                last.nextOnCurve = node;
                if (node.nextOnCurve) {
                    node.nextOnCurve.lastOnCurve = node;
                }
            } else { // 插入头部，同时也是插入尾部
                this.startNode = node;
            }

            this.domMap.set(node.main_node, node);
            if(end_flag)
                this.endNode = node;
            return node;
        }
    }

    // 在当前曲线中根据对应页面元素找到节点对象
    find_node_by_dom(main_node) {
        return this.domMap.get(main_node) ?? null;
    }

    // 根据页面元素移除对象
    remove_node_by_dom(main_node) {
        const nodeToRemove = this.domMap.get(main_node);
        if (!nodeToRemove || nodeToRemove.type === null)
            return false;

        const prev = nodeToRemove.lastOnCurve;
        const next = nodeToRemove.nextOnCurve;

        if (prev)
            prev.nextOnCurve = next;
        if (next)
            next.lastOnCurve = prev;

        if (nodeToRemove === this.startNode) {
            this.startNode = next;
        }

        if (nodeToRemove.main_node) {
            this.domMap.delete(nodeToRemove.main_node);
        }

        return true;
    }

    // 根据整条曲线中包含的每一段绘制出包括填充的整条曲线
    update_path(container) {
        this.path_d = "";
        let this_node = this.startNode;
        while(this_node != null && this_node.nextCurve != null) {
            let one_path_d = this_node.nextCurve.querySelector("path").getAttribute("d");
            if(this_node !== this.startNode)
                one_path_d = removeLeadingM(one_path_d);
            // this_node.nextCurve.style.contentVisibility = "hidden";
            this.path_d += one_path_d;
            this.path_d += " ";
            this_node = this_node.nextOnCurve;
        }

        if(this.curve === null) {
            this.curve = create_path_svg(
                this.path_d,
                0,
                "red",
                true,
                param_set["1"]["path_fill_color"],
                container
            );
        } else {
            const path = this.curve.querySelector("path");
            if(path) {
                path.setAttribute("d", this.path_d);
            }
        }
    }

    save() {
        if(this.startNode === null)
            return;
        let res = [];
        res.push({
            cl: "M",
            num: [{ num_x: this.startNode.x, num_y: this.startNode.y }]
        });
        let this_node = this.startNode.nextOnCurve;
        while(this_node !== null) {

        }
    }
}

export class CurveManager {
    // private static _instance: CurveManager | null = null;
    static _instance = null;
    // private curves: Curve[] = [];
    curves = [];
    idCounter = 0;

    constructor() {}

    // private domMap: Map<SVGSVGElement, Curve> = new Map();
    domMap = new Map();

    // 根据页面元素节点找到节点属于的曲线对象
    find_curve_by_dom(main_node) {
        return this.domMap.get(main_node) ?? null;
    }

    static getInstance() {
        if (!CurveManager._instance) {
            CurveManager._instance = new CurveManager();
        }
        return CurveManager._instance;
    }

    // 添加一条空曲线
    add_curve(class_id) {
        const curve = new Curve({
            id: (this.idCounter++).toString(),
            class_id
        });
        this.curves.push(curve);
        return curve;
    }

    // 移除一条曲线
    remove_curve(id) {
        const index = this.curves.findIndex(m => m.id === id);
        if (index !== -1) {
            this.curves.splice(index, 1);
            return true;
        }
        return false;
    }

    // 获取曲线列表
    get_curves() {
        return this.curves;
    }

    // 根据 id 获取曲线
    get_curve_by_id(id) {
        return this.curves.find(m => m.id === id);
    }

    // 页面中添加节点的方法，参照 Curve.add_node
    add_node_by_curve(
        main_node,
        type,
        x,
        y,
        nextOnCurve,
        lastOnCurve,
        this_curve,
        node_id
    ) {

        this.domMap.set(main_node, this_curve);
        return this_curve.add_node(
            main_node,
            type,
            x,
            y,
            nextOnCurve !== null ? this_curve.find_node_by_dom(nextOnCurve) : null,
            lastOnCurve !== null ? this_curve.find_node_by_dom(lastOnCurve) : null,
            node_id
        );
    }

    // 根据页面元素在所有节点对象中找到对应的对象，这需要先找到对应包含的曲线
    find_node_by_curve(main_node) {
        return this.find_curve_by_dom(main_node)?.find_node_by_dom(main_node) ?? null;
    }
}

export function create_line_svg(
    start,
    end,
    strokeWidth,
    strokeColor,
    container,
    zIndex = "50"
) {
    const [x1, y1] = start;
    const [x2, y2] = end;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");

    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.pointerEvents = "none";
    svg.setAttribute("width", `${window.screen.width}px`);
    svg.setAttribute("height", `${window.screen.height}px`);
    svg.style.zIndex = zIndex;
    svg.style.overflow = "visible";

    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", x1.toString());
    line.setAttribute("y1", y1.toString());
    line.setAttribute("x2", x2.toString());
    line.setAttribute("y2", y2.toString());
    line.setAttribute("stroke-width", strokeWidth.toString());
    line.setAttribute("stroke", strokeColor);

    svg.appendChild(line);
    container.appendChild(svg);

    return svg;
}

// 给定四个点创建一段 path
export function create_bezier_svg(
    p0,
    p1,
    p2,
    p3,
    strokeWidth,
    strokeColor,
    fill,
    fillColor,
    container,
    zIndex = "50"
) {
    const [x0, y0] = p0;
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    const [x3, y3] = p3;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");

    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.pointerEvents = "none";
    svg.setAttribute("width", `${window.screen.width}px`);
    svg.setAttribute("height", `${window.screen.height}px`);
    svg.style.zIndex = zIndex;
    svg.style.overflow = "visible";

    const path = document.createElementNS(svgNS, "path");
    const d = `M ${x0},${y0} C ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
    path.setAttribute("d", d);
    path.setAttribute("stroke", strokeColor);
    path.setAttribute("stroke-width", strokeWidth.toString());

    if (fill) {
        path.setAttribute("fill", fillColor);
    } else {
        path.setAttribute("fill", "none");
    }

    svg.appendChild(path);
    container.appendChild(svg);

    return svg;
}

// 给定 d 属性字符串创建 path
export function create_path_svg(
    d,
    strokeWidth,
    strokeColor,
    fill,
    fillColor,
    container,
    zIndex = "40"
) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");

    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.pointerEvents = "none";
    svg.style.zIndex = zIndex;
    svg.style.overflow = "visible";

    svg.setAttribute("width", `${window.screen.width}px`);
    svg.setAttribute("height", `${window.screen.height}px`);

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", d);

    if (fill) {
        path.setAttribute("fill", fillColor);
    } else {
        path.setAttribute("fill", "none");
    }

    path.setAttribute("stroke", strokeColor);
    path.setAttribute("stroke-width", strokeWidth.toString());
    svg.appendChild(path);
    container.appendChild(svg);
    return svg;
}

// 去掉路径字符串开头的 M x y
export function removeLeadingM(d) {
    const regex = /^\s*[Mm]\s*(-?\d+(\.\d+)?([eE][-+]?\d+)?)[ ,]+(-?\d+(\.\d+)?([eE][-+]?\d+)?)/;
    return d.replace(regex, '');
}
