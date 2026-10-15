(function () {
  'use strict';
  const EXTENSIONS = { html: 'html', htm: 'html', css: 'css', js: 'js', javascript: 'js', ts: 'ts', typescript: 'ts', py: 'py', python: 'py', json: 'json', bash: 'sh', sh: 'sh', shell: 'sh', xml: 'xml', yaml: 'yml', yml: 'yml', sql: 'sql', java: 'java', c: 'c', cpp: 'cpp', csharp: 'cs', php: 'php', go: 'go', rust: 'rs', markdown: 'md', md: 'md', text: 'txt', plaintext: 'txt' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function extension(language) { return EXTENSIONS[String(language || '').toLowerCase()] || 'txt'; }
  function downloadCode(code, filename) {
    const blob = new Blob([String(code ?? '')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = filename || `verity-code.${extension('text')}`; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) {
      const el = document.createElement('textarea'); el.value = text; el.style.position = 'fixed'; el.style.opacity = '0'; document.body.appendChild(el); el.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} el.remove(); return ok;
    }
  }
  function extractFences(text) {
    const out = []; const re = /```([\w+#.-]*)\s*\n?([\s\S]*?)```/g; let match;
    while ((match = re.exec(String(text || '')))) out.push({ language: match[1] || 'text', code: match[2].replace(/^\n|\n$/g, '') });
    return out;
  }
  function createCodeCard(code, language, notify) {
    const wrap = document.createElement('section'); wrap.className = 'code-card';
    const head = document.createElement('div'); head.className = 'code-card-head';
    const lang = document.createElement('span'); lang.className = 'code-lang'; lang.textContent = (language || 'text').toUpperCase(); head.appendChild(lang);
    const info = document.createElement('span'); info.textContent = 'Verity CodeBox'; head.appendChild(info);
    const actions = document.createElement('div'); actions.className = 'code-card-actions';
    const mk = (label, icon, fn) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = `<svg class="icon"><use href="#i-${icon}"></use></svg><span>${label}</span>`; b.addEventListener('click', fn); return b; };
    actions.appendChild(mk('Copy', 'copy', async () => { const ok = await copyText(code); notify(ok ? 'Code copied.' : 'Could not copy automatically.', ok ? 'success' : 'error'); }));
    actions.appendChild(mk('Download', 'download', () => { downloadCode(code, `verity-code.${extension(language)}`); notify('Code download started.', 'success'); }));
    if (/^html?$/i.test(language || '')) actions.appendChild(mk('Preview', 'sparkle', () => { const win = window.open('about:blank', '_blank'); if (!win) { notify('Allow pop-ups to preview HTML.', 'error'); return; } win.opener = null; win.document.open(); win.document.write(code); win.document.close(); }));
    head.appendChild(actions); wrap.appendChild(head);
    const pre = document.createElement('pre'); const codeEl = document.createElement('code'); codeEl.textContent = code; pre.appendChild(codeEl); wrap.appendChild(pre);
    return wrap;
  }
  window.VerityCodeBox = { extension, downloadCode, copyText, extractFences, createCodeCard };
}());
