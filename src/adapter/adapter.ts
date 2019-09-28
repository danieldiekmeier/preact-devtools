import { ID } from "../view/store";
import { render, h } from "preact";
import { DevtoolsHook } from "./hook";
import { Renderer } from "./10/renderer";
import { Highlighter } from "../view/components/Highlighter";
import { measureNode, getNearestElement } from "./dom";
import { setIn } from "../shells/shared/utils";
import { getComponent, getDom, getDisplayName } from "./10/vnode";
import { createPicker } from "./picker";

export type Path = Array<string | number>;

export interface DevtoolsEvent {
	name: string;
	data: any;
}

export type UpdateType = "props" | "state" | "hooks" | "context";

export interface Adapter {
	highlight(id: ID | null): void;
	inspect(id: ID): void;
	startPickElement(): void;
	stopPickElement(): void;
	log(id: ID): void;
	update(id: ID, type: UpdateType, path: Path, value: any): void;
	select(id: ID): void;
}

export interface InspectData {
	id: ID;
	name: string;
	type: any;
	context: Record<string, any> | null;
	canEditHooks: boolean;
	hooks: any | null;
	canEditProps: boolean;
	props: Record<string, any> | null;
	canEditState: boolean;
	state: Record<string, any> | null;
}

export function createAdapter(hook: DevtoolsHook, renderer: Renderer): Adapter {
	/**
	 * Reference to the DOM element that we'll render the selection highlighter
	 * into. We'll cache it so that we don't unnecessarily re-create it when the
	 * hover state changes. We only destroy this elment once the user stops
	 * hovering a node in the tree.
	 */
	let highlightRef: HTMLDivElement | null = null;

	function destroyHighlight() {
		if (highlightRef) {
			document.body.removeChild(highlightRef!);
		}
		highlightRef = null;
	}

	function highlight(id: ID | null) {
		if (id !== null) {
			const vnode = renderer.getVNodeById(id);
			if (!vnode) return destroyHighlight();
			const dom = renderer.findDomForVNode(id);

			if (dom != null) {
				if (highlightRef == null) {
					highlightRef = document.createElement("div");
					highlightRef.id = "preact-devtools-highlighter";

					document.body.appendChild(highlightRef);
				}

				const node = getNearestElement(dom[0]!);

				if (node != null) {
					render(
						h(Highlighter, {
							label: getDisplayName(vnode),
							...measureNode(node),
						}),
						highlightRef,
					);
					return;
				}
			}
		}
		destroyHighlight();
	}

	const picker = createPicker(
		window,
		renderer,
		id => {
			highlight(id);
			hook.emit("select-node", id);
		},
		() => {
			hook.emit("stop-picker", null);
			destroyHighlight();
		},
	);

	return {
		inspect(id) {
			if (renderer.has(id)) {
				const data = renderer.inspect(id);
				if (data !== null) {
					hook.emit("inspect-result", data);
				}
			}
		},
		log(id) {
			if (renderer.has(id)) renderer.log(id);
		},
		select(id) {
			// Unused
		},
		highlight,
		update(id, type, path, value) {
			const vnode = renderer.getVNodeById(id);
			console.log("update", vnode, path, value);
			if (vnode !== null) {
				if (type === "props") {
					setIn((vnode.props as any) || {}, path.slice(), value);
				}

				const dom = getDom(vnode);
				if (typeof vnode.type === "function") {
					const c = getComponent(vnode);
					if (c) c.forceUpdate();
				} else if (dom) {
					// dom.setAttribute()
				}
			}
		},
		startPickElement: picker.start,
		stopPickElement: picker.stop,
	};
}
