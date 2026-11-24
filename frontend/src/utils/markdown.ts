/** 解开助手给整篇 Markdown 正文添加的围栏，保留正文内的代码示例。 */
export function unwrapAssistantMarkdown(content: string): string {
  const opening = /^\s*(`{3,}|~{3,})[ \t]*(?:markdown|md)[ \t]*\r?\n/i.exec(content);
  if (!opening) return content;

  const outerFence = opening[1];
  const body = content.slice(opening[0].length);
  const lines = body.split(/\r?\n/);
  let codeFence: string | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[index]);
    if (!fence) continue;

    const marker = fence[1];
    const isClosing = !fence[2].trim();
    if (codeFence) {
      if (isClosing && marker[0] === codeFence[0] && marker.length >= codeFence.length) {
        codeFence = undefined;
      }
      continue;
    }

    if (isClosing && marker[0] === outerFence[0] && marker.length >= outerFence.length) {
      // 围栏之后还有正文时，这是文中的 Markdown 示例。
      if (lines.slice(index + 1).some((line) => line.trim())) return content;
      return lines.slice(0, index).join("\n");
    }
    codeFence = marker;
  }

  // 流式输出可能尚未收到最外层结束围栏，先渲染已收到的正文。
  return body;
}
