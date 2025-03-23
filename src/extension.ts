import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage("Python REPL Runner is now active!");
    
    let disposable = vscode.commands.registerCommand('python-repl-runner.runSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        const config = vscode.workspace.getConfiguration('python-repl-runner');
        const pythonPath = config.get<string>('interpreterPath', 'python');

        if (!pythonPath) {
            vscode.window.showErrorMessage('Python interpreter path is not configured.');
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        let codeLines: string[] = [];

        // Get current working directory from file path
        const fileUri = document.uri;
        let dirPath: string;

        if (fileUri.scheme === 'file') {
            dirPath = path.dirname(fileUri.fsPath);
        } else {
            // Handle untitled files and virtual workspaces
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
            dirPath = workspaceFolder?.uri.fsPath || os.homedir();
            if (!workspaceFolder) {
                vscode.window.showWarningMessage('Using home directory as working directory');
            }
        }

        if (selection.isEmpty) {
            const currentLine = document.lineAt(selection.active.line);
            codeLines = getCodeBlock(document, selection.active.line).split('\n');
            
            // Fallback to current line if block detection fails
            if (codeLines.join('').trim() === '') {
                codeLines = [currentLine.text];
            }
        } else {
            codeLines = document.getText(selection).split('\n');
        }

        if (codeLines.every(line => line.trim() === '')) {
            vscode.window.showErrorMessage('No code to execute.');
            return;
        }

        let terminal = vscode.window.terminals.find(t => t.name === "Python REPL");
        if (!terminal) {
            // Create terminal with proper working directory
            terminal = vscode.window.createTerminal({ 
                name: "Python REPL", 
                shellPath: pythonPath,
                shellArgs: ['-i'],
                cwd: dirPath
            });
            terminal.show();
        }

        // Send raw lines with preserved indentation
        for (const line of codeLines) {
            terminal.sendText(line.trimStart(), true);
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        // Send empty line to execute blocks
        if (codeLines.some(line => line.trim().endsWith(':'))) {
            terminal.sendText('', true);
        }
    });

    context.subscriptions.push(disposable);
}

function getCodeBlock(document: vscode.TextDocument, lineNumber: number): string {
    const initialLine = document.lineAt(lineNumber);
    const initialIndent = getIndentationLevel(initialLine.text);

    let start = lineNumber;
    let end = lineNumber;

    // For indented lines, find the top-level parent block
    if (initialIndent > 0) {
        // Find the top-level block starter
        while (start > 0) {
            const prevLine = document.lineAt(start - 1);
            const prevIndent = getIndentationLevel(prevLine.text);
            
            if (prevIndent === 0 && isBlockStart(prevLine.text)) {
                start--;
                break;
            }
            start--;
        }

        // Verify we found a valid block starter
        if (start >= 0) {
            const startLine = document.lineAt(start);
            if (!isBlockStart(startLine.text)) {
                // Fallback to current line's immediate block
                return document.lineAt(lineNumber).text;
            }
        }

        // Find full block ending
        const blockIndent = getIndentationLevel(document.lineAt(start).text);
        end = start;
        while (end < document.lineCount - 1) {
            const nextLine = document.lineAt(end + 1);
            const nextIndent = getIndentationLevel(nextLine.text);
            
            if (nextIndent <= blockIndent && !nextLine.text.startsWith(' ')) break;
            end++;
        }
    } else {
        // Handle top-level blocks
        if (isBlockStart(initialLine.text)) {
            const blockIndent = initialIndent;
            end = lineNumber;
            while (end < document.lineCount - 1) {
                const nextLine = document.lineAt(end + 1);
                const nextIndent = getIndentationLevel(nextLine.text);
                if (nextIndent <= blockIndent && !nextLine.text.startsWith(' ')) break;
                end++;
            }
        } else {
            // Single line at top level
            return initialLine.text;
        }
    }

    const range = new vscode.Range(start, 0, end, document.lineAt(end).text.length);
    return document.getText(range);
}

function isBlockStart(lineText: string): boolean {
    const trimmed = lineText.trim();
    return (
        trimmed.startsWith('def ') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('@') ||
        trimmed.startsWith('if ') ||
        trimmed.startsWith('for ') ||
        trimmed.startsWith('while ') ||
        trimmed.startsWith('with ') ||
        trimmed.startsWith('try:') ||
        (trimmed.endsWith(':') && !trimmed.startsWith('#')) // Exclude comments
    );
}

function getIndentationLevel(line: string): number {
    return line.match(/^ */)?.[0].length || 0;
}

export function deactivate() {
    vscode.window.terminals.forEach(terminal => {
        if (terminal.name === "Python REPL") {
            terminal.dispose();
        }
    });
}