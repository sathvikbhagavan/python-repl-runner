/// <reference types="mocha" />
/// <reference types="node" />
import * as assert from 'assert';
import * as vscode from 'vscode';
// @ts-ignore - Import from compiled output at runtime, types provided by src inclusion
import { getIndentationLevel, isBlockStart, getCodeBlock } from '../extension.js';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	suite('getIndentationLevel', () => {
		test('should return 0 for empty string', () => {
			assert.strictEqual(getIndentationLevel(''), 0);
		});

		test('should return 0 for line with no indentation', () => {
			assert.strictEqual(getIndentationLevel('print("hello")'), 0);
		});

		test('should return correct indentation for spaces', () => {
			assert.strictEqual(getIndentationLevel('    print("hello")'), 4);
			assert.strictEqual(getIndentationLevel('  x = 1'), 2);
			assert.strictEqual(getIndentationLevel('        return x'), 8);
		});

		test('should return correct indentation for line with only spaces', () => {
			assert.strictEqual(getIndentationLevel('   '), 3);
		});
	});

	suite('isBlockStart', () => {
		test('should identify function definitions', () => {
			assert.strictEqual(isBlockStart('def my_function():'), true);
			assert.strictEqual(isBlockStart('def test(x, y):'), true);
			assert.strictEqual(isBlockStart('    def nested():'), true);
		});

		test('should identify class definitions', () => {
			assert.strictEqual(isBlockStart('class MyClass:'), true);
			assert.strictEqual(isBlockStart('class Test(object):'), true);
		});

		test('should identify decorators', () => {
			assert.strictEqual(isBlockStart('@decorator'), true);
			assert.strictEqual(isBlockStart('@property'), true);
			assert.strictEqual(isBlockStart('    @staticmethod'), true);
		});

		test('should identify control flow statements', () => {
			assert.strictEqual(isBlockStart('if x > 0:'), true);
			assert.strictEqual(isBlockStart('for i in range(10):'), true);
			assert.strictEqual(isBlockStart('while condition:'), true);
			assert.strictEqual(isBlockStart('with open("file"):'), true);
			assert.strictEqual(isBlockStart('try:'), true);
		});

		test('should identify lines ending with colon', () => {
			assert.strictEqual(isBlockStart('if condition:'), true);
			assert.strictEqual(isBlockStart('else:'), true);
			assert.strictEqual(isBlockStart('elif x > 0:'), true);
		});

		test('should not identify comments ending with colon', () => {
			assert.strictEqual(isBlockStart('# This is a comment:'), false);
			assert.strictEqual(isBlockStart('    # Another comment:'), false);
		});

		test('should not identify regular statements', () => {
			assert.strictEqual(isBlockStart('x = 1'), false);
			assert.strictEqual(isBlockStart('print("hello")'), false);
			assert.strictEqual(isBlockStart('return x'), false);
		});

		test('should handle whitespace correctly', () => {
			assert.strictEqual(isBlockStart('  def test():'), true);
			assert.strictEqual(isBlockStart('    if x:'), true);
		});
	});

	suite('getCodeBlock', () => {
		test('should return single line for non-block statement', () => {
			const document = createDocument([
				'x = 1',
				'y = 2'
			]);
			assert.strictEqual(getCodeBlock(document, 0), 'x = 1');
		});

		test('should return complete function definition', () => {
			const document = createDocument([
				'def test():',
				'    return 1',
				'',
				'x = 2'
			]);
			const result = getCodeBlock(document, 0);
			assert.ok(result.includes('def test():'));
			assert.ok(result.includes('    return 1'));
		});

		test('should return complete if block', () => {
			const document = createDocument([
				'if x > 0:',
				'    print("positive")',
				'    y = 1',
				'else:',
				'    print("negative")'
			]);
			const result = getCodeBlock(document, 0);
			assert.ok(result.includes('if x > 0:'));
			assert.ok(result.includes('    print("positive")'));
		});

		test('should find parent block for indented lines', () => {
			const document = createDocument([
				'def outer():',
				'    def inner():',
				'        return 1',
				'    return inner()'
			]);
			// When cursor is on inner function, should get inner function
			const result = getCodeBlock(document, 1);
			assert.ok(result.includes('def inner():'));
			assert.ok(result.includes('        return 1'));
		});

		test('should handle top-level block with blank lines', () => {
			const document = createDocument([
				'def test():',
				'    ',
				'    return 1',
				'    ',
				'x = 2'
			]);
			const result = getCodeBlock(document, 0);
			assert.ok(result.includes('def test():'));
			assert.ok(result.includes('    return 1'));
		});

		test('should stop at dedent', () => {
			const document = createDocument([
				'def test():',
				'    x = 1',
				'    y = 2',
				'',
				'other_code()'
			]);
			const result = getCodeBlock(document, 0);
			assert.ok(result.includes('def test():'));
			assert.ok(result.includes('    x = 1'));
			assert.ok(result.includes('    y = 2'));
			assert.ok(!result.includes('other_code()'));
		});

		test('should handle nested blocks correctly', () => {
			const document = createDocument([
				'def outer():',
				'    if condition:',
				'        print("nested")',
				'    return True'
			]);
			// When on the if line, should get the if block
			const result = getCodeBlock(document, 1);
			assert.ok(result.includes('if condition:'));
			assert.ok(result.includes('        print("nested")'));
		});

		test('should handle class definitions', () => {
			const document = createDocument([
				'class MyClass:',
				'    def method(self):',
				'        pass',
				'',
				'x = MyClass()'
			]);
			const result = getCodeBlock(document, 0);
			assert.ok(result.includes('class MyClass:'));
			assert.ok(result.includes('    def method(self):'));
		});

		test('should handle for loops', () => {
			const document = createDocument([
				'for i in range(10):',
				'    print(i)',
				'    if i > 5:',
				'        break',
				'',
				'print("done")'
			]);
			const result = getCodeBlock(document, 0);
			assert.ok(result.includes('for i in range(10):'));
			assert.ok(result.includes('    print(i)'));
			assert.ok(result.includes('    if i > 5:'));
		});

		test('should handle try-except blocks', () => {
			const document = createDocument([
				'try:',
				'    risky_code()',
				'except:',
				'    handle_error()'
			]);
			const result = getCodeBlock(document, 0);
			assert.ok(result.includes('try:'));
			assert.ok(result.includes('    risky_code()'));
		});

		test('should return current line if no valid block found', () => {
			const document = createDocument([
				'    x = 1',  // Indented but no parent block
				'y = 2'
			]);
			const result = getCodeBlock(document, 0);
			assert.strictEqual(result.trim(), 'x = 1');
		});
	});
});

// Helper function to create a mock TextDocument for testing
function createDocument(lines: string[]): vscode.TextDocument {
	const text = lines.join('\n');
	return {
		lineCount: lines.length,
		lineAt: (lineNumber: number) => {
			if (lineNumber < 0 || lineNumber >= lines.length) {
				throw new Error(`Line ${lineNumber} out of range`);
			}
			return {
				text: lines[lineNumber],
				lineNumber: lineNumber,
				range: new vscode.Range(lineNumber, 0, lineNumber, lines[lineNumber].length),
				rangeIncludingLineBreak: new vscode.Range(lineNumber, 0, lineNumber, lines[lineNumber].length + 1),
				firstNonWhitespaceCharacterIndex: lines[lineNumber].match(/^\s*/)?.[0].length || 0,
				isEmptyOrWhitespace: lines[lineNumber].trim().length === 0
			} as vscode.TextLine;
		},
		getText: (range?: vscode.Range) => {
			if (!range) {
				return text;
			}
			const startLine = range.start.line;
			const endLine = range.end.line;
			const result: string[] = [];
			for (let i = startLine; i <= endLine; i++) {
				if (i === startLine && i === endLine) {
					result.push(lines[i].substring(range.start.character, range.end.character));
				} else if (i === startLine) {
					result.push(lines[i].substring(range.start.character));
				} else if (i === endLine) {
					result.push(lines[i].substring(0, range.end.character));
				} else {
					result.push(lines[i]);
				}
			}
			return result.join('\n');
		}
	} as vscode.TextDocument;
}

