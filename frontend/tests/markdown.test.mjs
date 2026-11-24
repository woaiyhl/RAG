import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/markdown.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { unwrapAssistantMarkdown } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('unwraps a complete Markdown answer containing a heading and table', () => {
  const body = '# 技术栈\n\n| 类别 | 技术 |\n| --- | --- |\n| 前端 | React |';
  assert.equal(unwrapAssistantMarkdown('```markdown\n' + body + '\n```'), body);
  assert.equal(unwrapAssistantMarkdown(' \n~~~MD\r\n# 技术栈\r\n~~~\r\n'), '# 技术栈');
});

test('renders the document while the outer closing fence has not arrived', () => {
  assert.equal(unwrapAssistantMarkdown('```markdown\n# 技术栈\n\n**前端**'), '# 技术栈\n\n**前端**');
});

test('keeps nested Python and JSON examples inside the document', () => {
  for (const outer of ['```', '````', '~~~']) {
    const body = '# 示例\n\n```python\nprint("hello")\n```\n\n```json\n{"ready": true}\n```';
    assert.equal(unwrapAssistantMarkdown(outer + 'markdown\n' + body + '\n' + outer), body);
  }
});

test('preserves ordinary code and Markdown examples followed by an explanation', () => {
  for (const content of [
    '```python\nprint("hello")\n```',
    '```json\n{"ready": true}\n```',
    '```\n# 代码示例\n```',
    '下面是 Markdown 源码：\n\n```markdown\n# 示例\n```',
    '```markdown\n# 示例\n```\n\n以上是 Markdown 源码。',
    '# 普通标题\n\n**正文**',
    '',
  ]) {
    assert.equal(unwrapAssistantMarkdown(content), content);
  }
});
