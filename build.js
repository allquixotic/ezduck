const process = require('process')
const child = require('child_process')
const fs = require('fs')

const pmap = {
    "win32" : "win",
    "darwin" : "macos",
    "linux" : "linux",
    "freebsd" : "freebsd"
}

const outdir = `output-${process.platform}`

try {
    fs.mkdirSync(outdir, { recursive: true })
}
catch {
    // Don't care
}

try {
    child.execSync(`npx pkg . --out-path ${outdir} --targets node${process.versions.node.split('.')[0]}-${pmap[process.platform]}-x64`, (process.platform == "win32" ? {windowsHide: true} : {}))
}
catch(e) {
    console.log(e)
}


fs.copyFileSync("node_modules/os-service/build/Release/service.node", `${outdir}/service.node`)

