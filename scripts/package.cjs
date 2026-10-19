// Explicit allowlist: never ship Git metadata, screenshots, fixtures or credentials.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8'));
const files=['manifest.json','core.js','api.js','threads.js','queue.js','content.js','content.css','popup.html','popup.js'];
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const policy=fs.readFileSync(path.join(root,'PRIVACY.md'),'utf8');
const html='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>隱私政策｜快速封鎖</title><style>body{max-width:800px;margin:40px auto;padding:0 24px;font:16px/1.8 system-ui;color:#252b39}h1{font-size:28px}h2{font-size:21px}</style><main>'+policy.trim().split(/\n\n+/).map(p=>p.startsWith('# ')?`<h1>${escape(p.slice(2))}</h1>`:p.startsWith('## ')?`<h2>${escape(p.slice(3))}</h2>`:`<p>${escape(p).replace(/\n/g,'<br>')}</p>`).join('\n')+'</main></html>\n';
fs.writeFileSync(path.join(root,'extension/privacy.html'),html);
fs.mkdirSync(dist,{recursive:true});
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'quick-block-release-'));
try {
 for(const file of [...files,'privacy.html'])fs.copyFileSync(path.join(root,'extension',file),path.join(stage,file));
 for(const file of ['LICENSE','PRIVACY.md','README.md'])fs.copyFileSync(path.join(root,file),path.join(stage,file));
 const zip=path.join(dist,`facebook-threads-quick-block-${manifest.version}.zip`);
 if(fs.existsSync(zip))fs.unlinkSync(zip);
 execFileSync('zip',['-q','-X',zip,...files,'privacy.html','LICENSE','PRIVACY.md','README.md'],{cwd:stage});
 const entries=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');
 const allowed=[...files,'privacy.html','LICENSE','PRIVACY.md','README.md'];
 if(entries.length!==allowed.length||entries.some(e=>!allowed.includes(e))||!entries.includes('manifest.json'))throw Error('Unexpected archive contents');
 const hash=createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
 fs.writeFileSync(`${zip}.sha256`,`${hash}  ${path.basename(zip)}\n`);
 console.log(`${path.relative(root,zip)}\n${hash}\nVerified ${entries.length} allowlisted files; manifest.json at ZIP root.`);
} finally {fs.rmSync(stage,{recursive:true,force:true});}
