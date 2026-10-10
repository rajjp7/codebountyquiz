const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
async function build() {
  fs.mkdirSync('dist/css', { recursive: true });
  for (const name of ['style.css', 'animations.css']) fs.copyFileSync(path.join('public/css', name), path.join('dist/css', name));
  fs.copyFileSync('public/index.html', 'dist/index.html');
  await esbuild.build({ entryPoints: ['src/main.jsx'], bundle: true, minify: true, sourcemap: true, outdir: 'dist/assets', entryNames: 'app', define: { 'process.env.NODE_ENV': '"production"' }, target: ['es2022'] });
  console.log('React production build written to dist/');
}
build().catch(error => { console.error(error); process.exitCode = 1; });
