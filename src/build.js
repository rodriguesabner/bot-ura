const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const child_process = require('child_process');

const DestDir = path.join(__dirname, 'pkg-dist');
const BEFORE = 'before';
const AFTER = 'after';

(async function main() {
    if (!fs.existsSync(DestDir)) fs.mkdirSync(DestDir);
    else fse.emptyDirSync(DestDir);
    await exec({cmd: 'npm', args: ['run', 'tsc']});
    handleModuleSharp(BEFORE);
    handlePackage(BEFORE);
    await exec({cmd: 'pkg', args: ['.', '--targets', 'node10-linux-x64', '--out-path', DestDir, '--debug']});
    handlePackage(AFTER);
    handleModuleSharp(AFTER);
    handleAssets();
})();

function handlePackage(arg) {
    const pkgName = path.join(__dirname, 'package.json');
    const pkgInfo = JSON.parse(fs.readFileSync(pkgName));
    pkgInfo.egg.typescript = arg === BEFORE ? undefined : true;
    fs.writeFileSync(pkgName, JSON.stringify(pkgInfo, null, 2) + '\n');
};

function handleAssets() {
    const srcFiles = [
        path.join(__dirname, 'bin'),
    ];
    srcFiles.forEach(filepath => {
        fse.copySync(filepath, path.join(DestDir, path.basename(filepath)), {recursive: true});
    });
};

function handleModuleSharp(arg) {
    const pkgName = path.join(__dirname, 'package.json');
    const pkgInfo = JSON.parse(fs.readFileSync(pkgName));
    if (!pkgInfo.dependencies.sharp) return;

    const moduleSharpDir = path.join(__dirname, 'node_modules/sharp');
    const keyStr = {
        raw: "require('../build/Release/sharp.node')",
        replaced: "require(require('path').join(process.cwd(), 'sharp/build/Release/sharp.node'))",
    };
    const targetDir = path.join(moduleSharpDir, 'lib');
    fs.readdirSync(targetDir).forEach(filename => {
        if (!filename.endsWith('.js')) return;
        const filepath = path.join(targetDir, filename);
        let content = fs.readFileSync(filepath, {encoding: 'utf8'});
        if (arg === BEFORE) content = content.replace(keyStr.raw, keyStr.replaced);
        else if (arg === AFTER) content = content.replace(keyStr.replaced, keyStr.raw);
        fs.writeFileSync(filepath, content);
    });
    if (arg === AFTER) {
        fse.copySync(path.join(moduleSharpDir, 'build'), path.join(DestDir, 'sharp/build'), {recursive: true});
        fse.copySync(path.join(moduleSharpDir, 'vendor/lib'), path.join(DestDir, 'sharp/vendor/lib'), {recursive: true});
    }
    ;
};

async function exec(params) {
    const cwd = params.cwd || process.cwd();
    const ok = await new Promise((r) => {
        const cmd = child_process.spawn(params.cmd, params.args, {cwd});
        cmd.stderr.pipe(process.stderr);
        cmd.stdout.pipe(process.stdout);
        cmd.on('close', (code) => {
            const ok = code === 0;
            if (!ok) console.log(`${JSON.stringify(params)}failed,code${code}`);
            r(ok);
        });
    });
    return ok;
};