// Güvenli Markdown dönüştürücü: önce HTML kaçışı yapılır, sonra yalnızca izinli biçimler üretilir.
import { esc } from './core.js';

const inline = text => esc(text)
  .replace(/`([^`\n]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
  .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);

export function renderMarkdown(source) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null;
  let code = null;
  const flush = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of lines) {
    if (code) {
      if (/^```/.test(line)) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; }
      else code.push(line);
      continue;
    }
    if (/^```/.test(line)) { flush(); closeList(); code = []; continue; }
    if (!line.trim()) { flush(); closeList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flush(); closeList();
      const tag = `h${heading[1].length + 2}`;
      out.push(`<${tag}>${inline(heading[2])}</${tag}>`);
      continue;
    }
    const item = line.match(/^\s*([-*•]|\d+[.)])\s+(.*)$/);
    if (item) {
      flush();
      const type = /\d/.test(item[1]) ? 'ol' : 'ul';
      if (list !== type) { closeList(); out.push(`<${type}>`); list = type; }
      out.push(`<li>${inline(item[2])}</li>`);
      continue;
    }
    closeList();
    para.push(line);
  }
  if (code) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  flush();
  closeList();
  return out.join('');
}
