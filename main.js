"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ListFoldPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_language = require("@codemirror/language");
var import_language2 = require("@codemirror/language");
function getEditorView(editor) {
  return editor.cm ?? null;
}
function collectFoldableListItems(view) {
  const items = [];
  const doc = view.state.doc;
  const tree = (0, import_language.syntaxTree)(view.state);
  for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
    const line = doc.line(lineNum);
    const lineText = line.text;
    if (!lineText.trim()) continue;
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
      }
    });
    if (!isList || isHeading) continue;
    const range = (0, import_language2.foldable)(view.state, line.from, line.to);
    if (!range) continue;
    const match = lineText.match(/^(\s*)/);
    const indent = match ? match[1].replace(/\t/g, "    ").length : 0;
    items.push({
      line: lineNum,
      from: range.from,
      to: range.to,
      indent
    });
  }
  return items;
}
function getFoldedSet(view) {
  const folded = /* @__PURE__ */ new Set();
  const iter = (0, import_language2.foldedRanges)(view.state).iter();
  while (iter.value) {
    folded.add(iter.from);
    iter.next();
  }
  return folded;
}
function toggleListFolds(view, topLevelOnly) {
  const items = collectFoldableListItems(view);
  if (items.length === 0) return;
  const targets = topLevelOnly ? items.filter((item) => {
    const minIndent = Math.min(...items.map((i) => i.indent));
    return item.indent === minIndent;
  }) : items;
  if (targets.length === 0) return;
  const folded = getFoldedSet(view);
  const foldedCount = targets.filter((t) => folded.has(t.from)).length;
  const shouldUnfold = foldedCount > targets.length / 2;
  const effects = targets.map((t) => {
    if (shouldUnfold) {
      return folded.has(t.from) ? import_language2.unfoldEffect.of({ from: t.from, to: t.to }) : null;
    } else {
      return !folded.has(t.from) ? import_language2.foldEffect.of({ from: t.from, to: t.to }) : null;
    }
  }).filter((e) => e !== null);
  if (effects.length > 0) {
    view.dispatch({ effects });
  }
}
var ListFoldPlugin = class extends import_obsidian.Plugin {
  onload() {
    this.addCommand({
      id: "toggle-fold-top-level-lists",
      name: "Toggle fold top-level lists",
      editorCallback: (editor, view) => {
        const ev = getEditorView(editor);
        if (ev) toggleListFolds(ev, true);
      }
    });
    this.addCommand({
      id: "toggle-fold-all-lists",
      name: "Toggle fold all list levels",
      editorCallback: (editor, view) => {
        const ev = getEditorView(editor);
        if (ev) toggleListFolds(ev, false);
      }
    });
  }
};
