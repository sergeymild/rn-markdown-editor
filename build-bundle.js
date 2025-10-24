import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Building project...');

// Сборка проекта
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}

console.log('📦 Creating bundle.html...');

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

// Читаем index.html
let html = fs.readFileSync(indexPath, 'utf-8');

// Находим и встраиваем CSS файлы
const cssRegex = /<link[^>]+href="([^"]+\.css)"[^>]*>/g;
let match;
let allCssContent = '';

while ((match = cssRegex.exec(html)) !== null) {
  const cssFile = match[1].replace(/^\//, '');
  const cssPath = path.join(distPath, cssFile);

  if (fs.existsSync(cssPath)) {
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    allCssContent += cssContent + '\n';
    console.log(`✅ Collected CSS: ${cssFile}`);
  }
}

// Удаляем все link теги для CSS
html = html.replace(/<link[^>]+href="[^"]+\.css"[^>]*>/g, '');

// Удаляем favicon link
html = html.replace(/<link[^>]+rel="icon"[^>]*>/g, '');

// Вставляем все стили в head
if (allCssContent) {
  const styleTag = `  <style>${allCssContent}</style>\n`;
  html = html.replace('</head>', `${styleTag}</head>`);
  console.log(`✅ Inlined all CSS in <head>`);
}

// Собираем все JS файлы
const jsRegex = /<script[^>]+src="([^"]+\.js)"[^>]*>/g;
let jsMatch;
let allJsContent = '';

while ((jsMatch = jsRegex.exec(html)) !== null) {
  const jsFile = jsMatch[1].replace(/^\//, '');
  const jsPath = path.join(distPath, jsFile);

  if (fs.existsSync(jsPath)) {
    let jsContent = fs.readFileSync(jsPath, 'utf-8');
    const beforeCount = (jsContent.match(/(?<!\\)<\//g) || []).length;
    // Экранируем </ СРАЗУ при чтении
    jsContent = jsContent.split('</').join('<\\/');
    // Экранируем $ для предотвращения интерпретации $& и других спецсимволов в .replace()
    // Каждый $ становится $$ чтобы .replace() интерпретировал его как литеральный $
    jsContent = jsContent.split('$').join('$$');
    const afterCount = (jsContent.match(/(?<!\\)<\//g) || []).length;
    console.log(`✅ Collected JS: ${jsFile} (escaped ${beforeCount} -> ${afterCount} unescaped </)`);
    allJsContent += jsContent + '\n';
  }
}

// Удаляем все script теги из head
html = html.replace(/<script[^>]+src="[^"]+\.js"[^>]*>[\s\S]*?<\/script>/g, '');

// Вставляем весь JS перед закрывающим </body>
if (allJsContent) {
  const scriptTag = '  <script>' + allJsContent + '</script>\n';
  html = html.replace('</body>', scriptTag + '</body>');
  console.log(`✅ Inlined all JS before </body>`);
}

// Сохраняем bundle.html
const bundlePath = path.join(distPath, 'bundle.html');
fs.writeFileSync(bundlePath, html);

// Проверяем что записалось
const verification = fs.readFileSync(bundlePath, 'utf-8');
const verifyEscaped = (verification.match(/<\\\//g) || []).length;
const verifyUnescaped = (verification.match(/<\//g) || []).length - verifyEscaped;
console.log(`   Verification: ${verifyEscaped} escaped, ${verifyUnescaped} unescaped </ sequences in file`);

console.log(`✨ Bundle created: ${bundlePath}`);
console.log(`📊 Size: ${(fs.statSync(bundlePath).size / 1024).toFixed(2)} KB`);