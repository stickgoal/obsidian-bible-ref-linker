import { Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { matchRefs, convertRefs, extractVerses, resolveRangeFromLink } from "./books.ts";
import type { ParsedRef } from "./books.ts";
import { VersePopover } from "./verse-popover.ts";
import { bibleRefEditorExtension } from "./cm-editor.ts";

interface BibleRefSettings {
	/** 打开/切换文件时自动把引用永久改写为内链 */
	autoConvertOnOpen: boolean;
	/** 文件修改 3 秒后自动转换（防抖） */
	autoConvertOnEdit: boolean;
}

const DEFAULT_SETTINGS: BibleRefSettings = {
	autoConvertOnOpen: true,
	autoConvertOnEdit: false,
};

/**
 * Bible Ref Linker
 * 1. 渲染/编辑时把圣经引用实时显示为内链（post processor + CM6 装饰器）
 * 2. 永久转换：把引用改写为 [[马太福音 25#36|太 25:36]]（别名保留显示文本）写入文件
 *    - 命令：转换当前文件 / 转换整个库
 *    - 自动：打开文件时（默认开）、编辑后 3 秒（默认关，设置中开启）
 * 3. 范围引用（太 25:36-38）hover 弹出连续几节的段落预览
 */
export default class BibleRefLinkerPlugin extends Plugin {
	private popover!: VersePopover;
	cfg!: BibleRefSettings;
	private openConvertTimer = 0;
	private editConvertTimers = new Map<string, number>();
	private warnedMissing = new Set<string>();

	async onload(): Promise<void> {
		await this.loadSettings();
		this.popover = new VersePopover(this.app, this);

		this.registerMarkdownPostProcessor((el) => {
			this.processElement(el);
		});
		// Live Preview 光标行实时渲染（打开页面、编写时均自动触发）
		this.registerEditorExtension(
			bibleRefEditorExtension(this.app, (linkEl) => this.openVersePopoverFromDataset(linkEl)),
		);

		// —— 永久转换后的原生 wikilink：从链接显示文本解析范围，hover 弹多节预览 ——
		// 在 document 捕获阶段拦截（事件最早到达）：多节链接 stopPropagation 彻底
		// 阻断传播，防止 Obsidian 原生 Page Preview 同时弹出（双层预览）；
		// 单节/非圣经链接放行，走原生页面预览。
		this.registerDomEvent(
			document,
			"mouseover",
			(evt: MouseEvent) => {
				const link = (evt.target as HTMLElement | null)?.closest?.(
					"a.internal-link",
				) as HTMLElement | null;
				if (!link || !link.isConnected) return;
				const href = link.getAttribute("data-href") ?? link.getAttribute("href") ?? "";
				const range = resolveRangeFromLink(href, link.textContent ?? "");
				if (!range) return;
				evt.stopPropagation();
				void this.openVersePopoverFor(range, link);
			},
			{ capture: true },
		);

		// —— 永久转换命令 ——
		this.addCommand({
			id: "convert-current-file",
			name: "转换当前文件的圣经引用为内链",
			callback: async () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) {
					new Notice("没有活动文件");
					return;
				}
				await this.convertFile(file);
			},
		});
		this.addCommand({
			id: "convert-vault",
			name: "转换整个库的圣经引用为内链",
			callback: async () => {
				new ConfirmModal(this.app, () => this.convertVault()).open();
			},
		});

		// —— 打开文件时自动转换（防抖）——
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				if (!this.cfg.autoConvertOnOpen) return;
				window.clearTimeout(this.openConvertTimer);
				this.openConvertTimer = window.setTimeout(() => {
					void this.convertActiveFileSilently();
				}, 800);
			}),
		);

		// —— 编辑后自动转换（3 秒防抖）——
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (!this.cfg.autoConvertOnEdit) return;
				if (!(file instanceof TFile) || file.extension !== "md") return;
				const prev = this.editConvertTimers.get(file.path);
				if (prev) window.clearTimeout(prev);
				this.editConvertTimers.set(
					file.path,
					window.setTimeout(() => {
						this.editConvertTimers.delete(file.path);
						void this.convertFile(file, true);
					}, 3000),
				);
			}),
		);

		this.addSettingTab(new BibleRefSettingTab(this.app, this));
	}

	onunload(): void {
		this.popover.close();
		window.clearTimeout(this.openConvertTimer);
		for (const t of this.editConvertTimers.values()) window.clearTimeout(t);
		this.editConvertTimers.clear();
	}

	// —— 渲染：遍历文本节点，把圣经引用替换为内部链接 ——

	private processElement(root: HTMLElement): void {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		const nodes: Text[] = [];
		let current: Node | null;
		while ((current = walker.nextNode()) !== null) {
			const textNode = current as Text;
			const text = textNode.nodeValue ?? "";
			if (!text.trim()) continue;
			// 跳过代码块、行内代码、数学公式与链接（含外链，防嵌套 a 产生无效 HTML）
			if (
				textNode.parentElement?.closest(
					"code, pre, a, .internal-embed, .math",
				)
			) {
				continue;
			}
			if (matchRefs(text).length > 0) nodes.push(textNode);
		}
		for (const node of nodes) {
			this.replaceInTextNode(node);
		}
	}

	private replaceInTextNode(node: Text): void {
		const text = node.nodeValue ?? "";
		const refs: ParsedRef[] = matchRefs(text);
		if (refs.length === 0) return;

		const segments = refs
			.flatMap((r) => r.segments)
			.sort((a, b) => a.start - b.start);

		const frag = document.createDocumentFragment();
		let cursor = 0;
		for (const seg of segments) {
			if (seg.start > cursor) {
				frag.append(text.slice(cursor, seg.start));
			}
			const link = document.createElement("a");
			link.classList.add("internal-link", "bible-ref");
			link.textContent = text.slice(seg.start, seg.end);
			link.setAttribute("data-href", seg.target);
			link.setAttribute("href", seg.target);
			// 范围引用（36-38）：记录范围，hover 弹出连续几节的段落预览
			if (seg.verseEnd && seg.book && seg.chapter && seg.verseStart) {
				link.dataset.book = seg.book;
				link.dataset.chapter = seg.chapter;
				link.dataset.verseStart = seg.verseStart;
				link.dataset.verseEnd = seg.verseEnd;
				this.attachRangeHover(link);
			}
			frag.append(link);
			cursor = seg.end;
		}
		if (cursor < text.length) {
			frag.append(text.slice(cursor));
		}
		node.replaceWith(frag);
	}

	private attachRangeHover(link: HTMLElement): void {
		link.addEventListener("mouseover", (e) => {
			e.stopPropagation();
			this.openVersePopoverFromDataset(link);
		});
	}

	/** 从链接 dataset（post processor / CM6 widget 写入）取范围并弹预览 */
	private openVersePopoverFromDataset(link: HTMLElement): void {
		const book = link.dataset.book;
		const chapter = link.dataset.chapter;
		const start = Number(link.dataset.verseStart);
		const end = Number(link.dataset.verseEnd);
		if (!book || !chapter || !start || !end) return;
		void this.openVersePopoverFor({ book, chapter, start, end }, link);
	}

	/** hover 弹出 book chapter start-end 连续几节的预览浮层 */
	private async openVersePopoverFor(
		range: { book: string; chapter: string; start: number; end: number },
		linkEl: HTMLElement,
	): Promise<void> {
		const { book, chapter, start, end } = range;
		if (end < start) return;
		const key = `${book}|${chapter}|${start}-${end}`;
		if (this.popover.isFor(key)) return;

		const file = this.resolveChapterFile(book, chapter);
		if (!file) {
			const warnKey = `${book} ${chapter}`;
			if (!this.warnedMissing.has(warnKey)) {
				this.warnedMissing.add(warnKey);
				new Notice(`Bible Ref Linker：未找到「${warnKey}.md」笔记，无法预览连续经文`, 4000);
			}
			return;
		}
		const md = await this.app.vault.cachedRead(file);
		const content = extractVerses(md, start, end);
		if (!content) return;
		this.popover.open(linkEl, content, file.path, key);
	}

	/**
	 * 解析章笔记文件：先走 Obsidian 链接解析（支持库内任意子文件夹/最短路径），
	 * 再按笔记名精确匹配兜底。
	 */
	private resolveChapterFile(book: string, chapter: string): TFile | null {
		const linktext = `${book} ${chapter}`;
		const dest = this.app.metadataCache.getFirstLinkpathDest(linktext, "");
		if (dest) return dest;
		const lower = linktext.toLowerCase();
		return (
			this.app.vault.getMarkdownFiles().find((f) => f.basename.toLowerCase() === lower) ??
			null
		);
	}

	// —— 永久转换 ——

	private async convertActiveFileSilently(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (file && file.extension === "md") await this.convertFile(file, true);
	}

	private async convertFile(file: TFile, silent = false): Promise<void> {
		const text = await this.app.vault.read(file);
		const result = convertRefs(text);
		if (!result) return;
		let count = 0;
		await this.app.vault.process(file, (data) => {
			const r = convertRefs(data);
			if (!r) return data;
			count = r.count;
			return r.text;
		});
		if (!silent && count > 0) {
			new Notice(`已转换 ${count} 处圣经引用：${file.basename}`);
		}
	}

	private async convertVault(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles();
		let fileCount = 0;
		let refCount = 0;
		for (const file of files) {
			const text = await this.app.vault.read(file);
			const r = convertRefs(text);
			if (!r) continue;
			await this.app.vault.process(file, () => r.text);
			fileCount++;
			refCount += r.count;
		}
		new Notice(`转换完成：${fileCount} 个文件，共 ${refCount} 处引用`);
	}

	// —— 设置 ——

	private async loadSettings(): Promise<void> {
		this.cfg = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.cfg);
	}
}

class BibleRefSettingTab extends PluginSettingTab {
	constructor(app: import("obsidian").App, private plugin: BibleRefLinkerPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("打开文件时自动转换")
			.setDesc("打开/切换文件时，自动把圣经引用永久改写为 [[马太福音 25#36|太 25:36]] 内链（显示文本不变，写入文件）")
			.addToggle((t) =>
				t.setValue(this.plugin.cfg.autoConvertOnOpen).onChange(async (v) => {
					this.plugin.cfg.autoConvertOnOpen = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("编辑后自动转换")
			.setDesc("文件修改 3 秒后自动转换（防抖）。编辑过程中可能出现光标跳动，谨慎开启；建议用命令手动转换")
			.addToggle((t) =>
				t.setValue(this.plugin.cfg.autoConvertOnEdit).onChange(async (v) => {
					this.plugin.cfg.autoConvertOnEdit = v;
					await this.plugin.saveSettings();
				}),
			);
	}
}

class ConfirmModal extends Modal {
	constructor(app: import("obsidian").App, private onConfirm: () => Promise<void>) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.createEl("p", {
			text: "将遍历库中所有 Markdown 文件，把圣经引用改写为 [[目标|原文本]] 内链。此操作会修改文件内容（可 Ctrl+Z / 版本历史恢复）。确定继续？",
		});
		const btns = this.contentEl.createDiv({ cls: "modal-button-container" });
		const yes = btns.createEl("button", { text: "全部转换", cls: "mod-cta" });
		yes.addEventListener("click", () => {
			this.close();
			void this.onConfirm();
		});
		const no = btns.createEl("button", { text: "取消" });
		no.addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
