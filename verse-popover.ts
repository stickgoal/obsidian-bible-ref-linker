import { App, Component, MarkdownRenderer } from "obsidian";

/**
 * 范围引用的 hover 段落预览：
 * 鼠标移入"太 25:36-38"这类范围链接时，弹出浮层渲染 36–38 连续几节的内容。
 * 仅使用公开 API（MarkdownRenderer.render），不依赖内部 HoverPopover。
 */
export class VersePopover {
	private el: HTMLElement | null = null;
	private key = "";
	private showTimer = 0;
	private hideTimer = 0;
	private cleanup: (() => void) | null = null;
	// 捕获阶段监听滚动：浮层外的滚动（编辑器/页面）关闭浮层；
	// 浮层内部的滚动（e.target 在浮层内）忽略，否则一滚就关、无法滚动查看长内容
	private readonly onScroll = (e: Event) => {
		if (this.el && e.target instanceof Node && this.el.contains(e.target)) return;
		this.close();
	};

	constructor(
		private readonly app: App,
		private readonly component: Component,
	) {}

	/** key 形如 "book|chapter|start-end"，用于防重复打开 */
	isFor(key: string): boolean {
		return this.key === key && (this.el !== null || this.showTimer !== 0);
	}

	/** 延迟 250ms 显示（避免扫过时闪现），期间可被 cancel */
	open(linkEl: HTMLElement, markdown: string, sourcePath: string, key: string): void {
		if (this.isFor(key)) return;
		this.close();
		this.key = key;
		this.showTimer = window.setTimeout(() => {
			this.showTimer = 0;
			void this.render(linkEl, markdown, sourcePath, key);
		}, 250);
	}

	close(): void {
		window.clearTimeout(this.showTimer);
		this.clearHideTimer();
		this.cleanup?.();
		this.cleanup = null;
		this.el?.remove();
		this.el = null;
		this.key = "";
		document.removeEventListener("scroll", this.onScroll, true);
	}

	private async render(
		linkEl: HTMLElement,
		markdown: string,
		sourcePath: string,
		key: string,
	): Promise<void> {
		if (!linkEl.isConnected) {
			this.key = "";
			return;
		}
		const el = document.createElement("div");
		el.classList.add("bible-ref-popover", "markdown-rendered");
		el.style.visibility = "hidden";
		document.body.append(el);
		try {
			await MarkdownRenderer.render(this.app, markdown, el, sourcePath, this.component);
		} catch {
			el.remove();
			this.key = "";
			return;
		}
		if (this.key !== key || !linkEl.isConnected) {
			el.remove();
			return;
		}
		this.el = el;
		this.position(el, linkEl);
		el.style.visibility = "";
		this.attachLifecycle(el, linkEl, sourcePath);
		// 兜底：显示后鼠标既不在链接也不在浮层上则自动关闭
		window.setTimeout(() => {
			if (this.el === el && !linkEl.matches(":hover") && !el.matches(":hover")) {
				this.close();
			}
		}, 400);
	}

	/** 定位：链接正下方居中；放不下时翻转到上方，再夹紧到视口内 */
	private position(el: HTMLElement, linkEl: HTMLElement): void {
		const rect = linkEl.getBoundingClientRect();
		const w = el.offsetWidth;
		const h = el.offsetHeight;
		let left = rect.left + rect.width / 2 - w / 2;
		left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
		let top = rect.bottom + 6;
		if (top + h > window.innerHeight - 8) {
			top = Math.max(8, rect.top - h - 6);
		}
		el.style.left = `${Math.round(left)}px`;
		el.style.top = `${Math.round(top)}px`;
	}

	private attachLifecycle(el: HTMLElement, linkEl: HTMLElement, sourcePath: string): void {
		const keep = () => this.clearHideTimer();
		const hideSoon = () => {
			this.clearHideTimer();
			this.hideTimer = window.setTimeout(() => this.close(), 200);
		};
		linkEl.addEventListener("mouseleave", hideSoon);
		linkEl.addEventListener("mouseenter", keep);
		el.addEventListener("mouseenter", keep);
		el.addEventListener("mouseleave", hideSoon);
		document.addEventListener("scroll", this.onScroll, true);

		// 浮层内的内链可点击跳转
		el.addEventListener("click", (e) => {
			const a = (e.target as HTMLElement).closest("a.internal-link");
			if (!a) return;
			e.preventDefault();
			e.stopPropagation();
			const target = a.getAttribute("data-href") ?? a.getAttribute("href") ?? "";
			void this.app.workspace.openLinkText(target, sourcePath);
			this.close();
		});

		this.cleanup = () => {
			linkEl.removeEventListener("mouseleave", hideSoon);
			linkEl.removeEventListener("mouseenter", keep);
			el.removeEventListener("mouseenter", keep);
			el.removeEventListener("mouseleave", hideSoon);
		};
	}

	private clearHideTimer(): void {
		window.clearTimeout(this.hideTimer);
	}
}
