const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
async function start() {
  fs.mkdirSync('dist/css', { recursive: true });
  const copyStatic = () => {
    fs.copyFileSync('public/index.html', 'dist/index.html');
    for (const name of ['style.css', 'animations.css']) fs.copyFileSync(path.join('public/css', name), path.join('dist/css', name));
  };
  copyStatic();
  const context = await esbuild.context({ entryPoints: ['src/main.jsx'], bundle: true, sourcemap: true, outdir: 'dist/assets', entryNames: 'app', define: { 'process.env.NODE_ENV': '"development"' }, target: ['es2022'] });
  await context.rebuild();
  await context.watch();
  const watchers = ['public', 'public/css'].map(directory => fs.watch(directory, copyStatic));
  const server = require('../server.js').listen(process.env.PORT || 3000, '0.0.0.0', error => {
    if (error) { console.error(error); process.exit(1); }
    console.log('React source rebuilds automatically. Refresh the page to see changes. Restart for backend edits.');
  });
  const close = async () => { watchers.forEach(watcher => watcher.close()); await context.dispose(); server.close(() => process.exit()); };
  process.once('SIGINT', close); process.once('SIGTERM', close);
}
start().catch(error => { console.error(error); process.exitCode = 1; });
