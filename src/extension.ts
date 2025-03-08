import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('python-repl-runner.runSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        // Get user-configured Python interpreter path
        const config = vscode.workspace.getConfiguration('python-repl-runner');
        const pythonPath = config.get<string>('interpreterPath', 'python');

        // Get selection or determine the function/class/block
        const document = editor.document;
        const selection = editor.selection;
        let text = selection.isEmpty ? getCodeBlock(document, selection.active.line) : document.getText(selection);

        // Get the active terminal or create a new one
        let terminal = vscode.window.terminals.find(t => t.name === "Python REPL");
        if (!terminal) {
            terminal = vscode.window.createTerminal({ name: "Python REPL", shellPath: pythonPath });
            terminal.show();
        }

        // Send command to terminal
        terminal.sendText(text);
    });

    context.subscriptions.push(disposable);
}

function getCodeBlock(document: vscode.TextDocument, line: number): string {
    let start = line;
    
    // Move up to find the function, class, loop, or conditional definition
    while (start > 0) {
        const lineText = document.lineAt(start).text.trim();
        if (lineText.startsWith("def ") || lineText.startsWith("class ") || 
            lineText.startsWith("if ") || lineText.startsWith("elif ") || 
            lineText.startsWith("else:") || lineText.startsWith("for ") || 
            lineText.startsWith("while ")) {
            break;
        }
        start--;
    }

    let blockIndentLevel = getIndentationLevel(document.lineAt(start).text);
    let end = start;
    
    // Move down to find the end of the block
    while (end < document.lineCount - 1) {
        const nextLineText = document.lineAt(end + 1).text;
        if (nextLineText.trim() === "" || getIndentationLevel(nextLineText) <= blockIndentLevel) {
            break;
        }
        end++;
    }

    const range = new vscode.Range(start, 0, end, document.lineAt(end).text.length);
    return document.getText(range);
}

function getIndentationLevel(line: string): number {
    return line.length - line.trimStart().length;
}

export function deactivate() {}
