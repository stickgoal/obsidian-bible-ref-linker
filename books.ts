/**
 * 圣经引用解析（纯逻辑模块，无 obsidian 依赖，可独立测试）
 *
 * 支持：
 * - 中文全名 / 中文缩写（马太福音 / 太 / 撒上 / 约壹 / 约一）
 * - 英文全称 / 英文缩写（Matthew / Matt / Mt，大小写不敏感）
 * - 章:节、范围（25:36-38）、顿号/逗号列表（25:36、38、41 / 25:36,38,41）
 * - 分号跨章（太 25:36; 26:1，分号后可省章号）
 * - 中文"章/节/篇"格式（太 25章36节 / 太 第25章 / 诗 23篇）
 *
 * 链接目标统一为中文全名："马太福音 25#36"（仅章时无 #节）。
 * 范围引用取第一节；列表中每节生成独立链接。
 */

/** 别名（小写）→ 链接目标书卷名（中文全名） */
export const BOOK_MAP: Record<string, string> = {
	// —— 旧约 39 卷 ——
	创世记: "创世记", 创: "创世记", genesis: "创世记", gen: "创世记",
	出埃及记: "出埃及记", 出: "出埃及记", exodus: "出埃及记", exo: "出埃及记", ex: "出埃及记",
	利未记: "利未记", 利: "利未记", leviticus: "利未记", lev: "利未记", lv: "利未记",
	民数记: "民数记", 民: "民数记", numbers: "民数记", num: "民数记", nu: "民数记",
	申命记: "申命记", 申: "申命记", deuteronomy: "申命记", deut: "申命记", deu: "申命记", dt: "申命记",
	约书亚记: "约书亚记", 书: "约书亚记", joshua: "约书亚记", josh: "约书亚记", jos: "约书亚记",
	士师记: "士师记", 士: "士师记", judges: "士师记", judg: "士师记", jdg: "士师记", jg: "士师记",
	路得记: "路得记", 得: "路得记", ruth: "路得记", rut: "路得记",
	撒母耳记上: "撒母耳记上", 撒上: "撒母耳记上", "1 samuel": "撒母耳记上", "1 sam": "撒母耳记上", "1sa": "撒母耳记上",
	撒母耳记下: "撒母耳记下", 撒下: "撒母耳记下", "2 samuel": "撒母耳记下", "2 sam": "撒母耳记下", "2sa": "撒母耳记下",
	列王纪上: "列王纪上", 王上: "列王纪上", "1 kings": "列王纪上", "1 kin": "列王纪上", "1ki": "列王纪上",
	列王纪下: "列王纪下", 王下: "列王纪下", "2 kings": "列王纪下", "2 kin": "列王纪下", "2ki": "列王纪下",
	历代志上: "历代志上", 代上: "历代志上", "1 chronicles": "历代志上", "1 chr": "历代志上", "1ch": "历代志上",
	历代志下: "历代志下", 代下: "历代志下", "2 chronicles": "历代志下", "2 chr": "历代志下", "2ch": "历代志下",
	以斯拉记: "以斯拉记", 拉: "以斯拉记", ezra: "以斯拉记", ezr: "以斯拉记",
	尼希米记: "尼希米记", 尼: "尼希米记", nehemiah: "尼希米记", neh: "尼希米记",
	以斯帖记: "以斯帖记", 斯: "以斯帖记", esther: "以斯帖记", esth: "以斯帖记", est: "以斯帖记",
	约伯记: "约伯记", 伯: "约伯记", job: "约伯记",
	诗篇: "诗篇", 诗: "诗篇", psalms: "诗篇", psalm: "诗篇", psa: "诗篇", ps: "诗篇",
	箴言: "箴言", 箴: "箴言", proverbs: "箴言", prov: "箴言", pro: "箴言", prv: "箴言",
	传道书: "传道书", 传: "传道书", ecclesiastes: "传道书", eccl: "传道书", ecc: "传道书",
	雅歌: "雅歌", 歌: "雅歌", "song of solomon": "雅歌", songs: "雅歌", song: "雅歌", sng: "雅歌",
	以赛亚书: "以赛亚书", 赛: "以赛亚书", isaiah: "以赛亚书", isa: "以赛亚书",
	耶利米书: "耶利米书", 耶: "耶利米书", jeremiah: "耶利米书", jer: "耶利米书",
	耶利米哀歌: "耶利米哀歌", 哀: "耶利米哀歌", lamentations: "耶利米哀歌", lam: "耶利米哀歌",
	以西结书: "以西结书", 结: "以西结书", ezekiel: "以西结书", ezek: "以西结书", ezk: "以西结书",
	但以理书: "但以理书", 但: "但以理书", daniel: "但以理书", dan: "但以理书",
	何西阿书: "何西阿书", 何: "何西阿书", hosea: "何西阿书", hos: "何西阿书",
	约珥书: "约珥书", 珥: "约珥书", joel: "约珥书", jol: "约珥书",
	阿摩司书: "阿摩司书", 摩: "阿摩司书", amos: "阿摩司书", amo: "阿摩司书", am: "阿摩司书",
	俄巴底亚书: "俄巴底亚书", 俄: "俄巴底亚书", obadiah: "俄巴底亚书", obad: "俄巴底亚书", oba: "俄巴底亚书",
	约拿书: "约拿书", 拿: "约拿书", jonah: "约拿书", jon: "约拿书", jnh: "约拿书",
	弥迦书: "弥迦书", 弥: "弥迦书", micah: "弥迦书", mic: "弥迦书",
	那鸿书: "那鸿书", 鸿: "那鸿书", nahum: "那鸿书", nah: "那鸿书", nam: "那鸿书",
	哈巴谷书: "哈巴谷书", 哈: "哈巴谷书", habakkuk: "哈巴谷书", hab: "哈巴谷书",
	西番雅书: "西番雅书", 番: "西番雅书", zephaniah: "西番雅书", zeph: "西番雅书", zep: "西番雅书",
	哈该书: "哈该书", 该: "哈该书", haggai: "哈该书", hag: "哈该书",
	撒迦利亚书: "撒迦利亚书", 亚: "撒迦利亚书", zechariah: "撒迦利亚书", zech: "撒迦利亚书", zec: "撒迦利亚书",
	玛拉基书: "玛拉基书", 玛: "玛拉基书", malachi: "玛拉基书", mal: "玛拉基书",
	// —— 新约 27 卷 ——
	马太福音: "马太福音", 太: "马太福音", matthew: "马太福音", matt: "马太福音", mat: "马太福音", mt: "马太福音",
	马可福音: "马可福音", 可: "马可福音", mark: "马可福音", mrk: "马可福音", mk: "马可福音", mar: "马可福音",
	路加福音: "路加福音", 路: "路加福音", luke: "路加福音", luk: "路加福音", lk: "路加福音",
	约翰福音: "约翰福音", 约: "约翰福音", john: "约翰福音", jhn: "约翰福音", jn: "约翰福音", joh: "约翰福音",
	使徒行传: "使徒行传", 徒: "使徒行传", acts: "使徒行传", act: "使徒行传", ac: "使徒行传",
	罗马书: "罗马书", 罗: "罗马书", romans: "罗马书", rom: "罗马书", ro: "罗马书",
	哥林多前书: "哥林多前书", 林前: "哥林多前书", "1 corinthians": "哥林多前书", "1 cor": "哥林多前书", "1co": "哥林多前书",
	哥林多后书: "哥林多后书", 林后: "哥林多后书", "2 corinthians": "哥林多后书", "2 cor": "哥林多后书", "2co": "哥林多后书",
	加拉太书: "加拉太书", 加: "加拉太书", galatians: "加拉太书", gal: "加拉太书",
	以弗所书: "以弗所书", 弗: "以弗所书", ephesians: "以弗所书", eph: "以弗所书",
	腓立比书: "腓立比书", 腓: "腓立比书", philippians: "腓立比书", phil: "腓立比书", php: "腓立比书",
	歌罗西书: "歌罗西书", 西: "歌罗西书", colossians: "歌罗西书", col: "歌罗西书",
	帖撒罗尼迦前书: "帖撒罗尼迦前书", 帖前: "帖撒罗尼迦前书", "1 thessalonians": "帖撒罗尼迦前书", "1 thess": "帖撒罗尼迦前书", "1th": "帖撒罗尼迦前书",
	帖撒罗尼迦后书: "帖撒罗尼迦后书", 帖后: "帖撒罗尼迦后书", "2 thessalonians": "帖撒罗尼迦后书", "2 thess": "帖撒罗尼迦后书", "2th": "帖撒罗尼迦后书",
	提摩太前书: "提摩太前书", 提前: "提摩太前书", "1 timothy": "提摩太前书", "1 tim": "提摩太前书", "1ti": "提摩太前书",
	提摩太后书: "提摩太后书", 提后: "提摩太后书", "2 timothy": "提摩太后书", "2 tim": "提摩太后书", "2ti": "提摩太后书",
	提多书: "提多书", 多: "提多书", titus: "提多书", tit: "提多书",
	腓利门书: "腓利门书", 门: "腓利门书", philemon: "腓利门书", phlm: "腓利门书", phm: "腓利门书",
	希伯来书: "希伯来书", 来: "希伯来书", hebrews: "希伯来书", heb: "希伯来书",
	雅各书: "雅各书", 雅: "雅各书", james: "雅各书", jas: "雅各书", jm: "雅各书",
	彼得前书: "彼得前书", 彼前: "彼得前书", "1 peter": "彼得前书", "1 pet": "彼得前书", "1pe": "彼得前书",
	彼得后书: "彼得后书", 彼后: "彼得后书", "2 peter": "彼得后书", "2 pet": "彼得后书", "2pe": "彼得后书",
	约翰一书: "约翰一书", 约壹: "约翰一书", 约一: "约翰一书", "1 john": "约翰一书", "1 jn": "约翰一书", "1jn": "约翰一书",
	约翰二书: "约翰二书", 约贰: "约翰二书", 约二: "约翰二书", "2 john": "约翰二书", "2 jn": "约翰二书", "2jn": "约翰二书",
	约翰三书: "约翰三书", 约叁: "约翰三书", 约三: "约翰三书", "3 john": "约翰三书", "3 jn": "约翰三书", "3jn": "约翰三书",
	犹大书: "犹大书", 犹: "犹大书", jude: "犹大书", jud: "犹大书", jde: "犹大书",
	启示录: "启示录", 启: "启示录", revelation: "启示录", rev: "启示录",
};

const CJK_ALIASES = Object.keys(BOOK_MAP).filter((k) => /^[\u4e00-\u9fff]+$/.test(k));
const EN_ALIASES = Object.keys(BOOK_MAP).filter((k) => /^[a-z0-9\s]+$/.test(k));

/** 中文别名交替：长名优先（诗篇 > 诗），"约" 加 lookbehind 防"大约"误报 */
const CJK_PATTERN = CJK_ALIASES
	.sort((a, b) => b.length - a.length)
	.map((a) => (a === "约" ? "(?<!大)约" : a))
	.join("|");

/** 英文别名交替：长名优先；空格转水平空白（允许 1 Samuel / 1Samuel / 1Sam，不跨行） */
const EN_PATTERN = EN_ALIASES
	.sort((a, b) => b.length - a.length)
	.map((a) =>
		a
			.replace(/(\d)\s+([a-z])/g, "$1[^\\S\\n]*$2")
			.replace(/^(\d)(?=[a-z])/, "$1[^\\S\\n]*")
			.replace(/\s+/g, "[^\\S\\n]*"),
	)
	.join("|");

const ALIAS_PATTERN = `(?:${CJK_PATTERN}|(?<![a-z0-9])(?:${EN_PATTERN})\\b)`;

/** 水平空白（不含换行）：引用匹配不跨行，防"导出\n00:36"这类时间戳误报 */
const HB = "[^\\S\\n]";
/** 1-999 且禁前导零：出埃及记没有第 0 章，"00:36" 时间戳不识别 */
const NUM = "[1-9]\\d{0,2}";

const RANGE_TAIL = `(?:${HB}*[-–—~〜至]${HB}*(${NUM}))?`;

/** 冒号路径：书卷 章:节[-节]（列表后续项由解析器手工扩展） */
export const COLON_REF_REGEX = new RegExp(
	`(${ALIAS_PATTERN})${HB}*(${NUM})${HB}*[:：]${HB}*(${NUM})${RANGE_TAIL}`,
	"gi",
);

/** 中文"章/节"路径：书卷 第N章 或 第N章M节[-K节] */
export const CJ_REF_REGEX = new RegExp(
	`(${ALIAS_PATTERN})${HB}*第?${HB}*(${NUM})${HB}*章(?:${HB}*(${NUM})(?:${HB}*[-–—~〜至]${HB}*(${NUM}))?${HB}*节?)?`,
	"gi",
);

/** 诗篇"篇"计数：诗/诗篇 第N篇 或 第N篇M节 */
export const PS_REF_REGEX = new RegExp(
	`(诗篇|诗)${HB}*第?${HB}*(${NUM})${HB}*篇(?:${HB}*(${NUM})(?:${HB}*[-–—~〜至]${HB}*(${NUM}))?${HB}*节?)?`,
	"gi",
);

/** 同章续节项：顿号/逗号 + 节[-节]（group1=分隔符，group2=节，group3=范围尾） */
const SEP_ITEM_RE = new RegExp(
	`([、,，]${HB}*)(${NUM})(?:${HB}*[-–—~〜至]${HB}*(${NUM}))?`,
	"y",
);

/** 分号续项：; 章:节[-节] 或 ; 节[-节]（省章延续当前章）
 * group: 1=分隔符, 2=章(冒号路径), 3=节(冒号路径), 4=节尾(冒号路径), 5=节(纯节路径), 6=节尾(纯节路径) */
const SEMI_ITEM_RE = new RegExp(
	`([;；]${HB}*)(?:(${NUM})${HB}*[:：]${HB}*(${NUM})(?:${HB}*[-–—~〜至]${HB}*(${NUM}))?|(${NUM})(?:${HB}*[-–—~〜至]${HB}*(${NUM}))?)`,
	"y",
);

export interface RefSegment {
	/** 文本起点（绝对位置） */
	start: number;
	/** 文本终点（绝对位置，不含前导分隔符） */
	end: number;
	/** Obsidian 内链目标："马太福音 25#36"；仅章引用为 "马太福音 25" */
	target: string;
	/** 书卷全名（供 hover 段落预览定位章文件） */
	book?: string;
	/** 章（供 hover 段落预览） */
	chapter?: string;
	/** 起始节（供 hover 段落预览） */
	verseStart?: string;
	/** 结束节；有值表示这是"范围"段，hover 可预览连续几节 */
	verseEnd?: string;
}

export interface ParsedRef {
	segments: RefSegment[];
}

function verseTarget(book: string, chapter: string, verse: string): string {
	return `${book} ${chapter}#${verse}`;
}

/** 解析冒号路径 + 手工扩展顿号/逗号/分号列表 */
function parseColonMatch(text: string, match: RegExpExecArray): ParsedRef | null {
	const book = BOOK_MAP[match[1].toLowerCase()];
	const chapter = match[2];
	const verse = match[3];
	const verseEnd = match[4];
	if (!book || !chapter || !verse) return null;

	const segments: RefSegment[] = [];
	const rawStart = match.index;
	let pos = rawStart + match[0].length;
	// 首段链接覆盖 "书卷 章:首项(含范围)"，范围引用取第一节
	const firstSeg: RefSegment = {
		start: rawStart,
		end: pos,
		target: verseTarget(book, chapter, verse),
		book,
		chapter,
		verseStart: verse,
	};
	if (verseEnd) firstSeg.verseEnd = verseEnd; // 范围引用：hover 可预览连续几节
	segments.push(firstSeg);
	let curChapter = chapter;

	for (;;) {
		SEP_ITEM_RE.lastIndex = pos;
		const sep = SEP_ITEM_RE.exec(text);
		if (sep && sep[2]) {
			segments.push({
				start: pos + (sep[1]?.length ?? 0), // 链接文本不含顿号/逗号
				end: pos + sep[0].length,
				target: verseTarget(book, curChapter, sep[2]),
				book,
				chapter: curChapter,
				verseStart: sep[2],
			});
			pos += sep[0].length;
			continue;
		}
		SEMI_ITEM_RE.lastIndex = pos;
		const semi = SEMI_ITEM_RE.exec(text);
		if (semi) {
			const ch = semi[2] ?? curChapter;
			const v = (semi[2] ? semi[3] : semi[5]) ?? "";
			if (v) {
				segments.push({
					start: pos + (semi[1]?.length ?? 0),
					end: pos + semi[0].length,
					target: verseTarget(book, ch, v),
					book,
					chapter: ch,
					verseStart: v,
				});
				curChapter = ch;
				pos += semi[0].length;
				continue;
			}
		}
		break;
	}
	return { segments };
}

/** 解析中文"章/节/篇"路径（含仅章引用） */
function parseCjMatch(match: RegExpExecArray): ParsedRef | null {
	const book = BOOK_MAP[match[1].toLowerCase()];
	const chapter = match[2];
	if (!book || !chapter) return null;
	const end = match.index + match[0].length;
	if (match[3]) {
		const seg: RefSegment = {
			start: match.index,
			end,
			target: verseTarget(book, chapter, match[3]),
			book,
			chapter,
			verseStart: match[3],
		};
		if (match[4]) seg.verseEnd = match[4];
		return { segments: [seg] };
	}
	// 仅章引用：[[马太福音 25]]
	return {
		segments: [{ start: match.index, end, target: `${book} ${chapter}`, book, chapter }],
	};
}

/** 解析文本中的全部圣经引用，按位置排序且互不重叠 */
export function matchRefs(text: string): ParsedRef[] {
	const refs: ParsedRef[] = [];
	let m: RegExpExecArray | null;

	COLON_REF_REGEX.lastIndex = 0;
	while ((m = COLON_REF_REGEX.exec(text)) !== null) {
		const r = parseColonMatch(text, m);
		if (r) refs.push(r);
	}
	CJ_REF_REGEX.lastIndex = 0;
	while ((m = CJ_REF_REGEX.exec(text)) !== null) {
		const r = parseCjMatch(m);
		if (r) refs.push(r);
	}
	PS_REF_REGEX.lastIndex = 0;
	while ((m = PS_REF_REGEX.exec(text)) !== null) {
		const r = parseCjMatch(m);
		if (r) refs.push(r);
	}

	refs.sort((a, b) => a.segments[0].start - b.segments[0].start);
	const out: ParsedRef[] = [];
	let lastEnd = -1;
	for (const r of refs) {
		if (r.segments[0].start >= lastEnd) {
			out.push(r);
			lastEnd = r.segments[r.segments.length - 1].end;
		}
	}
	return out;
}

const WIKILINK_RE = /\[\[[^\]\n]*\]\]/g;

/** 扫描已存在的 wikilink 区间，避免对 [[目标|别名]] 内的文本重复转换/装饰 */
export function wikilinkRanges(text: string): Array<[number, number]> {
	const ranges: Array<[number, number]> = [];
	WIKILINK_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = WIKILINK_RE.exec(text)) !== null) {
		ranges.push([m.index, m.index + m[0].length]);
	}
	return ranges;
}

export interface ConvertResult {
	text: string;
	count: number;
}

/** GFM 表格分隔行（| --- | :---: | 等） */
const TABLE_DELIM_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** 判断第 idx 行是否属于 Markdown 表格：本行以 | 开头，或为分隔行，或紧邻分隔行 */
export function isTableLine(lines: string[], idx: number): boolean {
	const line = lines[idx] ?? "";
	if (line.trimStart().startsWith("|")) return true;
	if (TABLE_DELIM_RE.test(line)) return true;
	if (idx > 0 && TABLE_DELIM_RE.test(lines[idx - 1] ?? "")) return true;
	if (idx + 1 < lines.length && TABLE_DELIM_RE.test(lines[idx + 1] ?? "")) return true;
	return false;
}

/**
 * 收集不应做永久转换/装饰的源码区间（绝对坐标）：
 * - YAML frontmatter（wikilink 会破坏属性解析）
 * - 围栏代码块（``` / ~~~）
 * - 行内代码（`...`）
 * - 数学公式（$$...$$ 块与行内 $...$）
 * - Markdown 链接的文本部分（[text](url)，转换会产生嵌套坏链）
 * 误判方向为"多保护"（漏转换），不会破坏文件内容。
 */
export function protectedRanges(text: string): Array<[number, number]> {
	const ranges: Array<[number, number]> = [];

	// YAML frontmatter：文档头部 --- ... --- / ... 整体保护
	const fm = /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?=\r?\n|$)/.exec(text);
	if (fm) ranges.push([0, fm[0].length]);

	const lines = text.split(/\r?\n/);
	const lineStarts: number[] = [0];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === "\n") lineStarts.push(i + 1);
	}

	let fenceStart = -1;
	let fenceCh = "";
	let mathBlock = false;

	for (let i = 0; i < lines.length; i++) {
		const start = lineStarts[i] ?? text.length;
		const line = lines[i];
		const end = start + line.length;

		// 围栏代码块状态机
		if (fenceStart < 0) {
			const open = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
			if (open) {
				fenceStart = start;
				fenceCh = open[1][0];
				continue;
			}
		} else {
			if (new RegExp(`^\\s{0,3}\\${fenceCh}{3,}\\s*$`).test(line)) {
				ranges.push([fenceStart, end]);
				fenceStart = -1;
			}
			continue; // 围栏内不做行内扫描
		}

		// 数学公式块（跨行 $$）：块内整行保护
		const masked = line.replace(/`+[^`]*`+/g, (m) => " ".repeat(m.length)); // 行内代码遮罩
		const ddCount = (masked.match(/\$\$/g) ?? []).length;
		if (mathBlock) {
			ranges.push([start, end]);
			if (ddCount % 2 === 1) mathBlock = false;
			continue;
		}

		// 行内代码
		const inlineCode = /`+[^`\n]*`+/g;
		let m: RegExpExecArray | null;
		while ((m = inlineCode.exec(line)) !== null) {
			ranges.push([start + m.index, start + m.index + m[0].length]);
		}

		// md 链接文本 [text](url)：只保护 text 部分
		const mdLink = /\[([^\]\n]*)\]\([^)\n]*\)/g;
		while ((m = mdLink.exec(masked)) !== null) {
			ranges.push([start + m.index + 1, start + m.index + 1 + m[1].length]);
		}

		// 数学公式：行内 $$...$$ 整体保护；奇数个 $$ 进入跨行块
		if (ddCount > 0 && ddCount % 2 === 0) {
			const first = masked.indexOf("$$");
			const last = masked.lastIndexOf("$$");
			ranges.push([start + first, start + last + 2]);
		} else if (ddCount % 2 === 1) {
			mathBlock = true;
			ranges.push([start + masked.indexOf("$$"), end]);
			continue;
		} else {
			// 行内 $...$（与货币 $ 误判时方向为多保护，安全）
			const inlineMath = /\$[^$\n]+?\$/g;
			while ((m = inlineMath.exec(masked)) !== null) {
				ranges.push([start + m.index, start + m.index + m[0].length]);
			}
		}
	}
	// 未闭合围栏：保护到文件末尾
	if (fenceStart >= 0) ranges.push([fenceStart, text.length]);
	return ranges;
}

/**
 * 把文本中的圣经引用永久改写为 [[目标|原文本]] 内链：
 *   太 25:36 → [[马太福音 25#36|太 25:36]]（显示文本不变）
 * 表格行内改用 \| 转义别名分隔符（[[目标\|原文本]]），避免与表格列分隔符冲突；
 * 跳过保护区间（frontmatter/代码块/行内代码/公式/md 链接文本）与已存在的
 * wikilink 区间（防重复转换）；无可转换内容返回 null。
 */
export function convertRefs(text: string): ConvertResult | null {
	const refs = matchRefs(text);
	if (refs.length === 0) return null;
	const segments = refs
		.flatMap((r) => r.segments)
		.filter((s) => s.book && s.chapter)
		.sort((a, b) => a.start - b.start);
	const wiki = wikilinkRanges(text);
	const prot = protectedRanges(text);
	const excluded = (a: number, b: number): boolean =>
		prot.some(([x, y]) => a < y && b > x) || wiki.some(([x, y]) => a < y && b > x);
	// 表格行检测：别名分隔符 | 会与表格列分隔符冲突，需转义为 \|
	const lines = text.split(/\r?\n/);
	const lineStarts: number[] = [0];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === "\n") lineStarts.push(i + 1);
	}
	const inTable = (pos: number): boolean => {
		let lo = 0;
		let hi = lineStarts.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (lineStarts[mid] <= pos) lo = mid;
			else hi = mid - 1;
		}
		return isTableLine(lines, lo);
	};
	const usable = segments.filter((s) => {
		// 兜底防嵌套爆炸：命中文本已含 wikilink 语法（如别名内残留引用）则跳过
		const original = text.slice(s.start, s.end);
		if (original.includes("[[") || original.includes("]]")) return false;
		return !excluded(s.start, s.end);
	});
	if (usable.length === 0) return null;
	let out = text;
	// 倒序替换，避免位置偏移
	for (const seg of [...usable].sort((a, b) => b.start - a.start)) {
		const original = text.slice(seg.start, seg.end);
		// 表格行内用 \| 转义，Obsidian 渲染表格内的 wikilink 别名时按转义处理
		const sep = inTable(seg.start) ? "\\|" : "|";
		out = out.slice(0, seg.start) + `[[${seg.target}${sep}${original}]]` + out.slice(seg.end);
	}
	return { text: out, count: usable.length };
}

const BOOK_NAMES = new Set(Object.values(BOOK_MAP));

export interface LinkRange {
	book: string;
	chapter: string;
	start: number;
	end: number;
}

/**
 * 从内链 href + 显示文本解析多节预览范围。
 * 永久转换后的链接 [[马太福音 25#36|太 25:36-38]] 渲染为原生 a.internal-link，
 * 范围信息只存在于显示文本中，故 hover 时按显示文本重新解析。
 * 单节引用（无范围）返回 null，走 Obsidian 原生页面预览。
 */
export function resolveRangeFromLink(href: string, display: string): LinkRange | null {
	const m = /^(\S+) (\d{1,3})#(\d{1,3})$/.exec(href.trim());
	if (!m) return null;
	const book = m[1];
	if (!BOOK_NAMES.has(book)) return null;
	const chapter = m[2];
	const start = Number(m[3]);
	let end = start;
	for (const ref of matchRefs(display)) {
		const seg = ref.segments[0];
		if (seg.book === book && seg.verseEnd) {
			const e = Number(seg.verseEnd);
			if (Number.isFinite(e)) end = e;
			break;
		}
	}
	if (!Number.isFinite(start) || end <= start) return null;
	return { book, chapter, start, end };
}

const VERSE_TITLE_RE = /^#{1,6}\s+(\d{1,3})\s*$/;

/**
 * 从章文件 markdown 中抓取 startVerse..endVerse（含）连续几节的内容。
 * 节标题形如 "# 36" / "## 36"（行首 1-6 个 # + 空格 + 纯节号）。
 * 每节取该标题行到下一个节标题/任意标题之间；缺节时截断到最后一个连续节。
 * 返回用 "---" 分隔的 markdown；找不到起始节时返回空串。
 */
export function extractVerses(md: string, startVerse: number, endVerse: number): string {
	const lines = md.split(/\r?\n/);
	const verseLine = new Map<number, number>();
	for (let i = 0; i < lines.length; i++) {
		const m = VERSE_TITLE_RE.exec(lines[i]);
		if (m && !verseLine.has(Number(m[1]))) verseLine.set(Number(m[1]), i);
	}
	const chunks: string[] = [];
	for (let v = startVerse; v <= endVerse; v++) {
		const s = verseLine.get(v);
		if (s === undefined) break; // 缺节即截断
		let e = lines.length;
		const next = verseLine.get(v + 1);
		if (next !== undefined) {
			e = next;
		} else {
			for (let j = s + 1; j < lines.length; j++) {
				if (/^#{1,6}\s/.test(lines[j])) {
					e = j;
					break;
				}
			}
		}
		chunks.push(lines.slice(s, e).join("\n").trim());
	}
	return chunks.join("\n\n---\n\n");
}
