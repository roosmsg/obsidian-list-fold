import { Plugin, MarkdownView, Editor } from "obsidian";
import { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { foldEffect, unfoldEffect, foldable, foldedRanges } from "@codemirror/language";

function getEditorView(editor: Editor): EditorView | null {
	// @ts-expect-error — cm is not exposed in the Obsidian API typings
	return editor.cm as EditorView ?? null;
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
	const tree = syntaxTree(view.state);

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

function toggleListFolds(view: EditorView, topLevelOnly: boolean): void {
	const items = collectFoldableListItems(view);
	if (items.length === 0) return;

	const targets = topLevelOnly
		? items.filter((item) => {
				const minIndent = Math.min(...items.map((i) => i.indent));
				return item.indent === minIndent;
			})
		: items;

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

export default class ListFoldPlugin extends Plugin {
	onload() {
		this.addCommand({
			id: "toggle-fold-top-level-lists",
			name: "Toggle fold top-level lists",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const ev = getEditorView(editor);
				if (ev) toggleListFolds(ev, true);
			},
		});

		this.addCommand({
			id: "toggle-fold-all-lists",
			name: "Toggle fold all list levels",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const ev = getEditorView(editor);
				if (ev) toggleListFolds(ev, false);
			},
		});
	}
}
