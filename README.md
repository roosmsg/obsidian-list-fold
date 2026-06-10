# List Fold

An Obsidian plugin that toggles fold/unfold on **list items only**, without touching headings.

Obsidian's built-in "Fold all" command folds both headings and lists. This plugin gives you list-specific folding, which is useful when you work with deeply nested outlines and want headings to stay expanded.

## Commands

| Command | Description |
|---------|-------------|
| **Toggle fold top-level lists** | Folds or unfolds only root-level list items in the current note |
| **Toggle fold all list levels** | Folds or unfolds every nested list item recursively |

Both commands detect the current fold state: if most target items are folded, they unfold; otherwise they fold.

## Usage

1. Open the command palette (`Ctrl/Cmd + P`)
2. Search for "List Fold"
3. Run either command

Assign hotkeys in **Settings > Hotkeys** for quick access.

## Compatibility

- Works alongside the Outliner plugin
- Requires Obsidian desktop (uses CodeMirror 6 editor APIs)

## Installation

### From Community Plugins

1. Open **Settings > Community plugins**
2. Search for "List Fold"
3. Click **Install**, then **Enable**

### Manual

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/rezgi/obsidian-list-fold/releases/latest)
2. Create a folder `list-fold` in your vault's `.obsidian/plugins/` directory
3. Copy both files into that folder
4. Enable the plugin in **Settings > Community plugins**

## License

MIT
