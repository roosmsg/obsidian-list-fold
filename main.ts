import { Plugin, MarkdownView, Editor, Command } from "obsidian";
import { EditorView } from "@codemirror/view";
import { syntaxTree, ensureSyntaxTree } from "@codemirror/language";
import { foldEffect, unfoldEffect, foldable, foldedRanges } from "@codemirror/language";

function getEditorView(editor: Editor): EditorView | null {
	// @ts-expect-error — cm is not exposed in the Obsidian API typings
	return editor.cm as EditorView ?? null;
}

// Obsidian's per-mode fold state (0-based line numbers). Not in the public
// typings, but both the editing and reading sub-views implement it and
// Obsidian uses it itself to carry folds across mode switches.
interface FoldInfo {
	folds: { from: number; to: number }[];
	lines: number;
}

interface FoldableSubView {
	getFoldInfo(): FoldInfo | null;
	applyFoldInfo(info: FoldInfo): void;
}

interface FoldableListItem {
	line: number;
	from: number;
	to: number;
	indent: number;
}

function collectFoldableListItems(view: EditorView): FoldableListItem[] {
	const items: FoldableListItem[] = [];
	const doc = view.state.doc;
	// The parser is lazy; in reading view (hidden editor) or for long notes it
	// may not have covered the whole document yet.
	const tree = ensureSyntaxTree(view.state, doc.length, 5000) ?? syntaxTree(view.state);

	for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
		const line = doc.line(lineNum);
		const lineText = line.text;

		// Skip empty lines
		if (!lineText.trim()) continue;

		// Check if this line is inside a list node (not a heading)
		let isList = false;
		let isHeading = false;
		tree.iterate({
			from: line.from,
			to: line.from + 1,
			enter(node) {
				const name = node.type.name;
				if (name.startsWith("list") || name === "ListItem" || name.startsWith("HyperMD-list-line")) {
					isList = true;
				}
				if (name.startsWith("ATXHeading") || name.startsWith("heading") || name === "HeaderMark") {
					isHeading = true;
				}
			},
		});

		if (!isList || isHeading) continue;

		// Check if this line is foldable
		const range = foldable(view.state, line.from, line.to);
		if (!range) continue;

		// Measure indent level
		const match = lineText.match(/^(\s*)/);
		const indent = match ? match[1].replace(/\t/g, "    ").length : 0;

		items.push({
			line: lineNum,
			from: range.from,
			to: range.to,
			indent,
		});
	}

	return items;
}

function getFoldedSet(view: EditorView): Set<number> {
	const folded = new Set<number>();
	const iter = foldedRanges(view.state).iter();
	while (iter.value) {
		folded.add(iter.from);
		iter.next();
	}
	return folded;
}

function selectTargets(items: FoldableListItem[], topLevelOnly: boolean): FoldableListItem[] {
	if (!topLevelOnly) return items;
	const minIndent = Math.min(...items.map((i) => i.indent));
	return items.filter((item) => item.indent === minIndent);
}

function toggleListFolds(view: EditorView, topLevelOnly: boolean): void {
	const items = collectFoldableListItems(view);
	if (items.length === 0) return;

	const targets = selectTargets(items, topLevelOnly);
	if (targets.length === 0) return;

	const folded = getFoldedSet(view);

	// Decide direction: if majority is folded, unfold all; otherwise fold all
	const foldedCount = targets.filter((t) => folded.has(t.from)).length;
	const shouldUnfold = foldedCount > targets.length / 2;

	const effects = targets
		.map((t) => {
			if (shouldUnfold) {
				return folded.has(t.from) ? unfoldEffect.of({ from: t.from, to: t.to }) : null;
			} else {
				return !folded.has(t.from) ? foldEffect.of({ from: t.from, to: t.to }) : null;
			}
		})
		.filter((e): e is NonNullable<typeof e> => e !== null);

	if (effects.length > 0) {
		view.dispatch({ effects });
	}
}

// Reading view renders its own fold state; CodeMirror fold effects only touch
// the hidden editor there. Use the sub-view's fold info instead, computing the
// candidate ranges from the (hidden) editor's syntax tree.
function toggleListFoldsInPreview(view: EditorView, subView: FoldableSubView, topLevelOnly: boolean): void {
	const items = collectFoldableListItems(view);
	if (items.length === 0) return;

	const targets = selectTargets(items, topLevelOnly);
	if (targets.length === 0) return;

	const doc = view.state.doc;
	const lineOf = (pos: number) => doc.lineAt(pos).number - 1;
	const targetFolds = targets.map((t) => ({ from: lineOf(t.from), to: lineOf(t.to) }));
	const targetStarts = new Set(targetFolds.map((f) => f.from));

	const current = subView.getFoldInfo() ?? { folds: [], lines: doc.lines };
	const foldedStarts = new Set(current.folds.map((f) => f.from));

	const foldedCount = targetFolds.filter((f) => foldedStarts.has(f.from)).length;
	const shouldUnfold = foldedCount > targetFolds.length / 2;

	// Keep every fold we are not targeting (headings, other list levels).
	const folds = shouldUnfold
		? current.folds.filter((f) => !targetStarts.has(f.from))
		: [...current.folds, ...targetFolds.filter((f) => !foldedStarts.has(f.from))];

	subView.applyFoldInfo({ folds, lines: doc.lines });
}

function runToggle(editor: Editor, mdView: MarkdownView, topLevelOnly: boolean): void {
	const ev = getEditorView(editor);
	if (!ev) return;
	if (mdView.getMode() === "preview") {
		const subView = mdView.currentMode as unknown as FoldableSubView;
		if (typeof subView.getFoldInfo === "function" && typeof subView.applyFoldInfo === "function") {
			toggleListFoldsInPreview(ev, subView, topLevelOnly);
			return;
		}
	}
	toggleListFolds(ev, topLevelOnly);
}

export default class ListFoldPlugin extends Plugin {
	onload() {
		this.addCommand({
			id: "toggle-fold-top-level-lists",
			name: "Toggle fold top-level lists",
			// Obsidian disables editorCallback commands (hidden from the palette,
			// hotkey ignored) while the note is in reading view unless this
			// undocumented flag is set.
			allowPreview: true,
			editorCallback: (editor: Editor, view: MarkdownView) => runToggle(editor, view, true),
		} as Command);

		this.addCommand({
			id: "toggle-fold-all-lists",
			name: "Toggle fold all list levels",
			allowPreview: true,
			editorCallback: (editor: Editor, view: MarkdownView) => runToggle(editor, view, false),
		} as Command);
	}
}
