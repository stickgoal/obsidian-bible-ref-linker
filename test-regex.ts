import { matchRefs, extractVerses, convertRefs, resolveRangeFromLink } from "./books.ts";

interface TestCase {
	input: string;
	expected: string[];
}

function targets(input: string): string[] {
	return matchRefs(input).flatMap((r) => r.segments.map((s) => s.target));
}

const cases: TestCase[] = [
	// —— 基本格式（中文缩写）——
	{ input: "太 25:36", expected: ["马太福音 25#36"] },
	{ input: "太25:36", expected: ["马太福音 25#36"] },
	{ input: "太 25：36", expected: ["马太福音 25#36"] },
	{ input: "太 25:36-38", expected: ["马太福音 25#36"] },
	{ input: "太 5:3-10", expected: ["马太福音 5#3"] },
	// —— 书卷全名 ——
	{ input: "马太福音 25:36", expected: ["马太福音 25#36"] },
	{ input: "创世记 1:1", expected: ["创世记 1#1"] },
	{ input: "撒母耳记上 1:1", expected: ["撒母耳记上 1#1"] },
	{ input: "诗篇 23:1", expected: ["诗篇 23#1"] },
	{ input: "启示录 21:4", expected: ["启示录 21#4"] },
	{ input: "约翰一书 2:1", expected: ["约翰一书 2#1"] },
	// —— 英文缩写（大小写不敏感）——
	{ input: "Matt 25:36", expected: ["马太福音 25#36"] },
	{ input: "Mt 5:3", expected: ["马太福音 5#3"] },
	{ input: "Jn 3:16", expected: ["约翰福音 3#16"] },
	{ input: "1Co 13:4", expected: ["哥林多前书 13#4"] },
	{ input: "1 Cor 13:4", expected: ["哥林多前书 13#4"] },
	{ input: "1Sa 1:1", expected: ["撒母耳记上 1#1"] },
	{ input: "Ps 23:1", expected: ["诗篇 23#1"] },
	{ input: "Rev 21:4", expected: ["启示录 21#4"] },
	// —— 英文全称 ——
	{ input: "Matthew 5:3", expected: ["马太福音 5#3"] },
	{ input: "1 Samuel 1:1", expected: ["撒母耳记上 1#1"] },
	{ input: "Song of Solomon 3:1", expected: ["雅歌 3#1"] },
	// —— 顿号/逗号列表：每节独立链接 ——
	{ input: "太 25:36、38、41", expected: ["马太福音 25#36", "马太福音 25#38", "马太福音 25#41"] },
	{ input: "太 25:36-38、41", expected: ["马太福音 25#36", "马太福音 25#41"] },
	{ input: "太 25:36,38,41", expected: ["马太福音 25#36", "马太福音 25#38", "马太福音 25#41"] },
	{ input: "太 25:36，41", expected: ["马太福音 25#36", "马太福音 25#41"] },
	{ input: "太 25:36, 38", expected: ["马太福音 25#36", "马太福音 25#38"] },
	// —— 分号跨章（可省章号）——
	{ input: "太 25:36; 26:1", expected: ["马太福音 25#36", "马太福音 26#1"] },
	{
		input: "太 25:36、38; 26:1、3",
		expected: ["马太福音 25#36", "马太福音 25#38", "马太福音 26#1", "马太福音 26#3"],
	},
	{ input: "太 25:36; 38", expected: ["马太福音 25#36", "马太福音 25#38"] },
	// —— 中文"章/节/篇"格式 ——
	{ input: "太 25章36节", expected: ["马太福音 25#36"] },
	{ input: "创 1章1节", expected: ["创世记 1#1"] },
	{ input: "太 第25章", expected: ["马太福音 25"] },
	{ input: "诗 23篇", expected: ["诗篇 23"] },
	{ input: "诗 23篇1节", expected: ["诗篇 23#1"] },
	{ input: "太 25章36-38节", expected: ["马太福音 25#36"] },
	// —— 混合与多引用 ——
	{ input: "太 25:36 和 约 3:16", expected: ["马太福音 25#36", "约翰福音 3#16"] },
	{ input: "读约 3:16", expected: ["约翰福音 3#16"] },
	{ input: "太 25:36, 约 3:16", expected: ["马太福音 25#36", "约翰福音 3#16"] },
	// —— 误报保护 ——
	{ input: "大约 25:36", expected: [] },
	{ input: "参考 25:36", expected: [] },
	{ input: "约 30 人", expected: [] },
	{ input: "太 25", expected: [] },
	{ input: "今天天气不错", expected: [] },
];

let failed = 0;
for (const { input, expected } of cases) {
	const actual = targets(input);
	if (JSON.stringify(actual) === JSON.stringify(expected)) {
		console.log(`PASS  ${input}  →  ${actual.join(", ") || "(无匹配)"}`);
	} else {
		failed++;
		console.log(
			`FAIL  ${input}\n      actual:   ${JSON.stringify(actual)}\n      expected: ${JSON.stringify(expected)}`,
		);
	}
}

// —— extractVerses：hover 段落预览的多节抓取 ——

const sampleChapter = [
	"# 35",
	"第35节内容",
	"# 36",
	"第36节内容",
	"## 36 小标题",
	"36节补充内容",
	"# 37",
	"第37节内容",
	"# 38",
	"第38节内容",
	"# 39",
	"第39节内容",
].join("\n");

interface VerseCase {
	label: string;
	md: string;
	start: number;
	end: number;
	expected: string;
}

const verseCases: VerseCase[] = [
	{
		label: "36-38 连续三节",
		md: sampleChapter,
		start: 36,
		end: 38,
		expected:
			"# 36\n第36节内容\n## 36 小标题\n36节补充内容\n\n---\n\n# 37\n第37节内容\n\n---\n\n# 38\n第38节内容",
	},
	{ label: "起始节不存在 → 空串", md: sampleChapter, start: 40, end: 42, expected: "" },
	{ label: "缺节截断（40 起）", md: sampleChapter, start: 38, end: 45, expected: "# 38\n第38节内容\n\n---\n\n# 39\n第39节内容" },
	{ label: "单节（36-36）", md: sampleChapter, start: 36, end: 36, expected: "# 36\n第36节内容\n## 36 小标题\n36节补充内容" },
];

for (const { label, md, start, end, expected } of verseCases) {
	const actual = extractVerses(md, start, end);
	if (actual === expected) {
		console.log(`PASS  extractVerses: ${label}`);
	} else {
		failed++;
		console.log(`FAIL  extractVerses: ${label}\n      actual:   ${JSON.stringify(actual)}\n      expected: ${JSON.stringify(expected)}`);
	}
}

// —— convertRefs：永久转换为 [[目标|原文本]] ——

interface ConvertCase {
	label: string;
	input: string;
	expected: string | null;
}

const convertCases: ConvertCase[] = [
	{ label: "单引用", input: "见太 25:36", expected: "见[[马太福音 25#36|太 25:36]]" },
	{ label: "范围引用（别名保留原文）", input: "太 25:36-38", expected: "[[马太福音 25#36|太 25:36-38]]" },
	{ label: "列表引用", input: "太 25:36、38", expected: "[[马太福音 25#36|太 25:36]]、[[马太福音 25#38|38]]" },
	{ label: "仅章引用", input: "太 第25章", expected: "[[马太福音 25|太 第25章]]" },
	{ label: "英文缩写输入链到中文全名", input: "Jn 3:16", expected: "[[约翰福音 3#16|Jn 3:16]]" },
	{ label: "已转换的不重复转换", input: "[[马太福音 25#36|太 25:36]]", expected: null },
	{ label: "无引用", input: "普通文本", expected: null },
	{
		label: "混合多引用",
		input: "太 25:36 和 约 3:16",
		expected: "[[马太福音 25#36|太 25:36]] 和 [[约翰福音 3#16|约 3:16]]",
	},
	{
		label: "表格内引用用 \\| 转义",
		input: "| 章节 | 说明 |\n| --- | --- |\n| 太 25:36 | 测试 |",
		expected: "| 章节 | 说明 |\n| --- | --- |\n| [[马太福音 25#36\\|太 25:36]] | 测试 |",
	},
	{
		label: "混合场景（表格外 |，表格内 \\|）",
		input: "见 太 25:36\n\n| 章节 | 说明 |\n| --- | --- |\n| 约 3:16 | 表格 |",
		expected:
			"见 [[马太福音 25#36|太 25:36]]\n\n| 章节 | 说明 |\n| --- | --- |\n| [[约翰福音 3#16\\|约 3:16]] | 表格 |",
	},
	{
		label: "表格上方文字行不误伤",
		input: "太 25:36 见下表\n| a | b |\n| --- | --- |",
		expected: "[[马太福音 25#36|太 25:36]] 见下表\n| a | b |\n| --- | --- |",
	},
	{
		label: "分隔行紧邻的单元格转换",
		input: "| a | b |\n| --- | --- |\n| 诗 23:1 | c |",
		expected: "| a | b |\n| --- | --- |\n| [[诗篇 23#1\\|诗 23:1]] | c |",
	},
	{
		label: "表格内已转义链接不重复转换",
		input: "| 章节 | 说明 |\n| --- | --- |\n| [[马太福音 25#36\\|太 25:36]] | 测试 |",
		expected: null,
	},
	{
		label: "围栏代码块内引用跳过",
		input: "```\n太 25:36\n```",
		expected: null,
	},
	{
		label: "波浪线围栏同样跳过",
		input: "~~~\n太 25:36\n~~~",
		expected: null,
	},
	{
		label: "围栏外正常转换块内不动",
		input: "太 25:36\n```\n太 25:36\n```",
		expected: "[[马太福音 25#36|太 25:36]]\n```\n太 25:36\n```",
	},
	{
		label: "行内代码内引用跳过",
		input: "运行 `太 25:36` 检查",
		expected: null,
	},
	{
		label: "行内代码外正常转换",
		input: "`太 25:36` 和 太 25:36",
		expected: "`太 25:36` 和 [[马太福音 25#36|太 25:36]]",
	},
	{
		label: "md 链接文本跳过",
		input: "[太 25:36](https://bible.example/mt25)",
		expected: null,
	},
	{
		label: "frontmatter 内跳过正文正常",
		input: "---\ntitle: 太 25:36\n---\n\n太 25:36",
		expected: "---\ntitle: 太 25:36\n---\n\n[[马太福音 25#36|太 25:36]]",
	},
	{
		label: "行内公式内跳过",
		input: "$太 25:36$ 前后",
		expected: null,
	},
	{
		label: "时间戳跨行不误报（导出+换行+00:36–01:08）",
		input: "Bible Sets 及导入导出\n00:36–01:08： Define module sets",
		expected: null,
	},
	{
		label: "时间戳同行不误报（章号前导零）",
		input: "导入导出 00:36–01:08： Define",
		expected: null,
	},
	{
		label: "已损坏嵌套链接不再包裹",
		input: "[[出埃及记 00#36|出\n00:36–01]]",
		expected: null,
	},
	{
		label: "出埃及记正常引用仍转换",
		input: "见 出 3:16",
		expected: "见 [[出埃及记 3#16|出 3:16]]",
	},
];

for (const { label, input, expected } of convertCases) {
	const actual = convertRefs(input)?.text ?? null;
	if (actual === expected) {
		console.log(`PASS  convertRefs: ${label}`);
	} else {
		failed++;
		console.log(
			`FAIL  convertRefs: ${label}\n      actual:   ${JSON.stringify(actual)}\n      expected: ${JSON.stringify(expected)}`,
		);
	}
}

// —— resolveRangeFromLink：原生 wikilink hover 的范围解析 ——

interface LinkRangeCase {
	label: string;
	href: string;
	display: string;
	expected: string | null;
}

const linkRangeCases: LinkRangeCase[] = [
	{
		label: "转换后的范围链接",
		href: "马太福音 25#36",
		display: "太 25:36-38",
		expected: "马太福音|25|36-38",
	},
	{
		label: "英文显示文本",
		href: "约翰福音 3#16",
		display: "Jn 3:16-18",
		expected: "约翰福音|3|16-18",
	},
	{ label: "单节引用 → 原生预览", href: "马太福音 25#36", display: "太 25:36", expected: null },
	{ label: "非圣经链接", href: "我的笔记#标题", display: "我的笔记", expected: null },
	{
		label: "书卷不匹配",
		href: "罗马书 5#1",
		display: "太 25:36-38",
		expected: null,
	},
];

for (const { label, href, display, expected } of linkRangeCases) {
	const r = resolveRangeFromLink(href, display);
	const actual = r ? `${r.book}|${r.chapter}|${r.start}-${r.end}` : null;
	if (actual === expected) {
		console.log(`PASS  resolveRange: ${label}`);
	} else {
		failed++;
		console.log(
			`FAIL  resolveRange: ${label}\n      actual:   ${JSON.stringify(actual)}\n      expected: ${JSON.stringify(expected)}`,
		);
	}
}

if (failed > 0) {
	console.error(`\n${failed} test(s) failed`);
	process.exit(1);
}
console.log(
	`\nAll ${cases.length + verseCases.length + convertCases.length + linkRangeCases.length} tests passed.`,
);
