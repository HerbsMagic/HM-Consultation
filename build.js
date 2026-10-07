// Precompiles the JSX files into a single minified dist/app.js (replaces in-browser Babel).
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

// Order matters: same order the scripts were loaded in index.html.
const files = ['Navbar.jsx', 'ConsultationHome.jsx', 'AppointmentBooking.jsx', 'app.jsx'];
const source = files.map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');

const out = esbuild.transformSync(source, { loader: 'jsx', minify: true, target: 'es2018' });
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'app.js'), out.code);
console.log('dist/app.js built.');
