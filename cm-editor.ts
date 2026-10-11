import { App, editorLivePreviewField } from "obsidian";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import { matchRefs, protectedRanges, wikilinkRanges } from "./books.ts";
import type { RefSegment } from "./books.ts";

/**
 * Live Preview 编辑器扩展（CM6 ViewPlugin）：
 * 对光标所在行（源码模式区域）中的圣经引用实时渲染为链接 widget。
 *
 * - 打开页面：编辑器初始化时立即装饰（update 首次调用）
 * - 编写时：每次击键/光标移动 CM6 自动触发 update 重扫，等效 keyup 且更高效
 * - 非光标行由 Obsidian 自身的渲染管线处理（post processor 已覆盖），
 *   因此这里只装饰活动行，避免与 Obsidian 的块级替换装饰重叠
 * - 光标落在引用上时保持原文，便于继续编辑；移开即渲染（如打完一个空格）
 */

interface RefRangeData {
	book: string;
	chapter: string;
	verseStart: string;
	verseEnd?: string;
}

class BibleLinkWidget extends WidgetType {
	constructor(
		private readonly app: App,
		readonly target: string,
		readonly display: string,
		private readonly range: RefRangeData,
		private readonly onHover: (linkEl: HTMLElement) => void,
	) {
		super();
	}

	eq(other: BibleLinkWidget): boolean {
		return other.target === this.target && other.display === this.display;
	}

	toDOM(): HTMLElement {
		const a = document.createElement("a");
		a.classList.add("internal-link", "bible-ref", "cm-bible-ref");
		a.textContent = this.display;
		a.setAttribute("data-href", this.target);
		a.setAttribute("href", this.target);
		// 写入范围数据，hover 多节预览逻辑与阅读视图完全复用
		a.dataset.book = this.range.book;
		a.dataset.chapter = this.range.chapter;
		a.dataset.verseStart = this.range.verseStart;
		if (this.range.verseEnd) a.dataset.verseEnd = this.range.verseEnd;
		a.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
			void this.app.workspace.openLinkText(this.target, sourcePath);
		});
		a.addEventListener("mouseover", (e) => {
			if (!this.range.verseEnd) return;
			e.stopPropagation();
			this.onHover(a);
		});
		return a;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

function segRange(seg: RefSegment): RefRangeData {
	return {
		book: seg.book!,
		chapter: seg.chapter!,
		verseStart: seg.verseStart!,
		verseEnd: seg.verseEnd,
	};
}

function buildDecorations(
	view: EditorView,
	app: App,
	onHover: (linkEl: HTMLElement) => void,
): DecorationSet {
	// 仅 Live Preview；源码模式保持纯文本
	if (view.state.field(editorLivePreviewField, false) !== true) return Decoration.none;

	const doc = view.state.doc;
	const selection = view.state.selection;
	const activeLines = new Set(selection.ranges.map((r) => doc.lineAt(r.head).number));
	// 保护区间（frontmatter/代码块/行内代码/公式/md 链接文本）按全文档坐标过滤
	const prot = protectedRanges(doc.toString());

	const widgets: Range<Decoration>[] = [];
	for (const { from, to } of view.visibleRanges) {
		const text = view.state.sliceDoc(from, to);
		const wiki = wikilinkRanges(text);
		for (const ref of matchRefs(text)) {
			for (const seg of ref.segments) {
				if (!seg.book || !seg.chapter || !seg.verseStart) continue;
				const start = from + seg.start;
				const end = from + seg.end;
				// 保护区间（代码块/行内代码/公式等）：不装饰
				if (prot.some(([x, y]) => start < y && end > x)) continue;
				// 非光标行：交给 Obsidian 渲染管线（post processor 已处理）
				if (!activeLines.has(doc.lineAt(start).number)) continue;
				// 光标落在引用范围内：保持原文以便编辑
				if (selection.ranges.some((r) => r.to >= start && r.from <= end)) continue;
				// 已是 wikilink 别名区域（已转换）：由 Obsidian 渲染，不再装饰
				if (wiki.some(([a, b]) => seg.start < b && seg.end > a)) continue;
				widgets.push(
					Decoration.replace({
						widget: new BibleLinkWidget(
							app,
							seg.target,
							text.slice(seg.start, seg.end),
							segRange(seg),
							onHover,
						),
					}).range(start, end),
				);
			}
		}
	}
	return Decoration.set(widgets, true);
}

export function bibleRefEditorExtension(
	app: App,
	onHover: (linkEl: HTMLElement) => void,
) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(readonly view: EditorView) {
				this.decorations = buildDecorations(view, app, onHover);
			}
			update(_update: ViewUpdate) {
				this.decorations = buildDecorations(this.view, app, onHover);
			}
		},
		{ decorations: (v) => v.decorations },
	);
}
