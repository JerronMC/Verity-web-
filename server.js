'use strict';
// Verity AI local API relay. No external npm dependencies are required. Node.js 18+.
// Binds to localhost only. API keys are received per-request and never written to disk or logged.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const MAX_BODY = 3 * 1024 * 1024;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8', '.json':'application/json; charset=utf-8' };
function json(res, status, payload) { const body = Buffer.from(JSON.stringify(payload)); res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Content-Length':body.length, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }); res.end(body); }
function sendError(res, status, message, extra = {}) { return json(res, status, { error: { message, ...extra } }); }
async function bodyJson(req) { const chunks = []; let size = 0; for await (const part of req) { size += part.length; if (size > MAX_BODY) throw Object.assign(new Error('Request is too large.'), { status:413 }); chunks.push(part); } try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status:400 }); } }
function errMessage(raw, fallback) { try { const x = JSON.parse(raw); return x?.error?.message || x?.message || x?.detail || fallback; } catch { return (raw || fallback).slice(0, 900); } }
async function upstreamJson(url, options, res) { let upstream; try { upstream = await fetch(url, { ...options, signal: AbortSignal.timeout(options.timeout || 120000) }); } catch (e) { return { error: { status:502, message:`Could not reach provider: ${e.message || 'network failure'}` } }; } const raw = await upstream.text().catch(() => ''); if (!upstream.ok) return { error: { status:upstream.status, message:errMessage(raw, `Provider returned HTTP ${upstream.status}`) } }; try { return { data: JSON.parse(raw) }; } catch { return { error: { status:502, message:'Provider returned an invalid JSON response.' } }; } }
function requireKey(body, field, label) { const key = typeof body[field] === 'string' ? body[field].trim() : ''; if (!key) throw Object.assign(new Error(`${label} API key is missing. Add it in Verity Settings.`), { status:400 }); return key; }
async function routeApi(req, res, url) {
  const body = await bodyJson(req);
  if (url.pathname === '/api/chat') {
    const apiKey = requireKey(body, 'apiKey', 'Groq'); const model = String(body.model || 'openai/gpt-oss-120b').slice(0, 160);
    const messages = Array.isArray(body.messages) ? body.messages.slice(-26).map(m => ({ role: ['system','user','assistant'].includes(m.role) ? m.role : 'user', content: String(m.content ?? m.text ?? '').slice(0, 60000) })) : [];
    const payload = { model, messages: [{ role:'system', content:String(body.system || 'You are Verity, a friendly and helpful assistant.').slice(0, 12000) }, ...messages.filter(m => m.role !== 'system')], temperature: 0.7, max_completion_tokens: 4096 };
    const out = await upstreamJson('https://api.groq.com/openai/v1/chat/completions', { method:'POST', headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json' }, body:JSON.stringify(payload) });
    if (out.error) return sendError(res, out.error.status, out.error.message);
    const result = out.data?.choices?.[0]?.message?.content; return json(res, 200, { text: typeof result === 'string' ? result : Array.isArray(result) ? result.map(x => x.text || '').join('\n') : '', model:out.data.model, usage:out.data.usage });
  }
  if (url.pathname === '/api/models') {
    const apiKey = requireKey(body, 'apiKey', 'Groq'); const out = await upstreamJson('https://api.groq.com/openai/v1/models', { method:'GET', headers:{ Authorization:`Bearer ${apiKey}` } });
    if (out.error) return sendError(res, out.error.status, out.error.message);
    return json(res, 200, { models:(out.data.data || []).map(m => ({ id:m.id, active:m.active !== false, owned_by:m.owned_by })).sort((a,b)=>a.id.localeCompare(b.id)) });
  }
  if (url.pathname === '/api/tts') {
    const apiKey = requireKey(body, 'apiKey', 'Fish Audio'); const text = String(body.text || '').trim(); if (!text) return sendError(res,400,'Add text to generate speech.'); if (text.length > 5000) return sendError(res,413,'Speech text must be under 5,000 characters.');
    const payload = { text, format:'mp3', latency:'normal' }; const ref = typeof body.referenceId === 'string' ? body.referenceId.trim() : ''; if (ref) payload.reference_id = ref;
    let r; try { r = await fetch('https://api.fish.audio/v1/tts', { method:'POST', headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json', model:'s2.1-pro-free' }, body:JSON.stringify(payload), signal:AbortSignal.timeout(90000) }); } catch(e) { return sendError(res,502,`Could not reach Fish Audio: ${e.message || 'network failure'}`); }
    if (!r.ok) return sendError(res,r.status,errMessage(await r.text().catch(()=>''),`Fish Audio returned HTTP ${r.status}`));
    const type = r.headers.get('content-type') || 'audio/mpeg'; if (/json|text\//i.test(type)) return sendError(res,502,errMessage(await r.text().catch(()=>''),'Fish Audio did not return audio bytes.'));
    const audio = Buffer.from(await r.arrayBuffer()); if (!audio.length) return sendError(res,502,'Fish Audio returned an empty audio response.');
    res.writeHead(200,{ 'Content-Type':type, 'Content-Length':audio.length, 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }); return res.end(audio);
  }
  if (url.pathname === '/api/image') {
    const apiKey = requireKey(body, 'apiKey', 'OpenAI'); const prompt = String(body.prompt || '').trim(); if (!prompt) return sendError(res,400,'Describe the image you want to generate.'); if (prompt.length > 12000) return sendError(res,413,'Image prompt is too long.');
    const size = ['1024x1024','1024x1536','1536x1024','auto'].includes(body.size) ? body.size : '1024x1024'; const quality = ['low','medium','high','auto'].includes(body.quality) ? body.quality : 'medium';
    const payload = { model:'gpt-image-1', prompt, size, quality, n:1, output_format:'png' };
    const out = await upstreamJson('https://api.openai.com/v1/images/generations', { method:'POST', headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json' }, body:JSON.stringify(payload), timeout:180000 });
    if (out.error) return sendError(res,out.error.status,out.error.message);
    return json(res,200,{ data:out.data.data || [], model:out.data.model || 'gpt-image-1', usage:out.data.usage || null });
  }
  return sendError(res,404,'Unknown API route.');
}
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res,200,{ ok:true, service:'Verity AI API relay', node:process.version, endpoints:['/api/chat','/api/models','/api/tts','/api/image'] });
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) { try { await routeApi(req,res,url); } catch(e) { sendError(res,e.status || 500,e.message || 'Unexpected server error.'); } return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendError(res,405,'Method not allowed.');
  let requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const full = path.resolve(ROOT, '.' + requested); if (!full.startsWith(ROOT + path.sep) && full !== path.join(ROOT,'index.html')) return sendError(res,403,'Forbidden.');
  fs.readFile(full,(err,data)=>{ if (err) return sendError(res,404,'File not found.'); const ext = path.extname(full).toLowerCase(); res.writeHead(200,{ 'Content-Type':MIME[ext] || 'application/octet-stream', 'Cache-Control':ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer' }); if (req.method==='HEAD') return res.end(); res.end(data); });
});
server.listen(PORT,HOST,()=>{ console.log(`Verity AI is ready at http://${HOST}:${PORT}`); console.log('Listening on localhost only. API keys are not logged or written to disk.'); });
server.on('error',e=>{ console.error(`Could not start: ${e.message}`); if(e.code==='EADDRINUSE')console.error(`Port ${PORT} is in use; close the other Verity instance.`); process.exitCode=1; });
