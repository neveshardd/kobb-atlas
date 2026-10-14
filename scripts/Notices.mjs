import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const sections = [];
for (const [path, metadata] of Object.entries(lock.packages)) {
  if (!path || metadata.dev || !existsSync(join(root, path))) continue;
  const directory = join(root, path);
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  const files = readdirSync(directory).filter(name => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name));
  const notices = files.map(name => { try { return readFileSync(join(directory, name), 'utf8'); } catch { return ''; } }).filter(Boolean);
  if (notices.length) sections.push(`${manifest.name} ${manifest.version}\n${notices.join('\n')}`);
  else sections.push(`${manifest.name} ${manifest.version}\nLicença declarada: ${manifest.license ?? metadata.license ?? 'Consultar o pacote original'}\n${manifest.homepage ?? ''}`);
}
const nugetLicense = resolve(process.env.USERPROFILE, '.nuget/packages/microsoft.web.webview2/1.0.4258.31/LICENSE.txt');
sections.push('ACadSharp 3.7.1\nhttps://github.com/DomCR/ACadSharp\n' + readFileSync(join(root, 'assets/licenses/ACadSharp.txt'), 'utf8'));
if (existsSync(nugetLicense)) sections.push('Microsoft.Web.WebView2 1.0.4258.31\n' + readFileSync(nugetLicense, 'utf8'));
for (const name of ['LICENSE.txt', 'ThirdPartyNotices.txt']) {
  const path = resolve(process.env.USERPROFILE, '.tools/dotnet', name);
  if (existsSync(path)) sections.push('.NET 10 · ' + name + '\n' + readFileSync(path, 'utf8'));
}
writeFileSync(process.argv[2] ?? join(root, 'payload/THIRD-PARTY-NOTICES.txt'), sections.join('\n\n====================\n\n'), 'utf8');
