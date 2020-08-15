const service = require('os-service')
const os = require('os')
const fs = require('fs')
const process = require('process')
const path = require('path')
const cp = require('child_process')
const http = require('http')
const rls = require('readline-sync')
const shell = require('node-powershell')
const network = require('network')

const homedir = os.homedir()
const currPath = process.argv[0]
const origAddonPath = path.dirname(currPath) + path.sep + "service.node"
const newPath = homedir + path.sep + path.basename(currPath)
const confname = `${homedir}${path.sep}ezduck.config.json`
const installedFile = `${homedir}${path.sep}.ezduckInstalled`
const command = process.argv.length > 2 ? process.argv[2] : "default"
var config = getConfig()
var doing = false
var lastPrivateIp = null
var lastPublicIp = null

if(process.platform == "win32" || process.platform == "linux") {
    service.run (function () {
        console.log("service.run callback hit")
        service.stop(0)
        process.exit(0)
    });
}

function getConfig() {
    try {
        let _config = JSON.parse(fs.readFileSync(confname))
        return _config
    }
    catch(xer) {
        console.log(`Config file invalid or doesn't exist: ${confname} (the error was: ${xer})`)
        try {
            fs.unlinkSync(confname)
        }
        catch{}
    }
}

function doUpdate(checkPublic) {
    const du = (conf) => {
        console.log("Doing update")
        try {
            http.get(`http://www.duckdns.org/update?domains=${conf.un}&token=${conf.pw}`)
        }
        catch {
            // Well, this isn't ideal, but maybe it's just because duckdns.org is down for a bit, so we'll pretend it didn't happen and try again in 10 minutes.
        }
    }

    // Our 10-minute timer passes in true to checkPublic. It checks if our public IP changed from dyndns.org, etc. first, and if that fails, it tries to send an update to duckdns.org anyway.
    // If we're able to correctly reach dyndns.org or other public IP service, we only poke duckdns.org when we notice our IP changed, or on service startup.
    if(checkPublic) {
        network.get_public_ip(function(err, ip) {
            if(err || ip != lastPublicIp) {
                du(config)
            }
            if(!err) {
                lastPublicIp = ip
            }
        })
    }
    else {
        du(config)
    }
}

// If we're unable to determine our private IP address on the system, doUpdate never gets called.
// Basically we either successfully get our private IP and determine that it's changed, or this 10-second poll loop never does anything.
function pollIp() {
    network.get_private_ip(function(err, ip) {
        if(!err) {
            if(ip != lastPrivateIp) {
                doUpdate(false)
            }
            lastPrivateIp = ip
        }
    })
}

function doWork() {
    doing = true
    console.log("Doing doWork")
    if(config && config.un && config.pw) {
        doUpdate(true)
        console.log("Waiting 10 minutes")
        setInterval(doUpdate.bind(this, true), 10 * 60 * 1000)
        setInterval(pollIp, 10 * 1000)
    }
    else {
        console.log("Config invalid. File 'ezduck.config.json' should exist with contents like this: { \"un\": \"foodomain\", \"pw\": \"12345\"}")
    }
}

function interactiveConfig() {
    if(config == null || !config["un"] || !config["pw"]) {
        config = {}
        config.un = rls.question("Enter your duckdns.org subdomain name. It doesn't matter if you include the '.duckdns.org' part or not.\n").replace(".duckdns.org", "")
        config.pw = rls.question("Enter your duckdns.org private token, also known as your duckdns.org subdomain password.\n")
        fs.writeFileSync(confname, JSON.stringify(config))
    }
}

function installServiceMac() {
    let filePath = "/Library/LaunchDaemons/ezduck.plist"
    let fileContent = `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
        <dict>
        <key>Label</key>
        <string>ezduck</string>
        <key>Program</key>
        <string>${newPath}</string>
        <key>ProgramArguments</key>
        <array>
        </array>
        <key>RunAtLoad</key>
        <true/>
        <key>KeepAlive</key>
        <true/>
        </dict>
    </plist>`
    console.log("You will be prompted, possibly more than once, for your password. This is because we need temporary root access to install the service.")
    cp.execSync(`sudo mkdir -p ${path.dirname(filePath)}`)
    cp.execSync(`sudo touch ${filePath}`)
    cp.execSync(`sudo chown root:wheel ${filePath}`)
    cp.execSync(`sudo chmod 755 ${filePath}`)
    const command = `sudo sh -c 'cat > ${filePath}'`
    cp.execSync(command, { input: fileContent })
    cp.execSync("sudo launchctl load /Library/LaunchDaemons/ezduck.plist")
}

function uninstallServiceMac() {
    try {
        console.log("You will be prompted, possibly more than once, for your password. This is because we need temporary root access to uninstall the service.")
        cp.execSync("sudo rm -f /Library/LaunchDaemons/ezduck.plist")
    }
    catch{}
}

function writeInstalledFile() {
    fs.closeSync(fs.openSync(installedFile, 'w'))
    console.log("Wrote file " + installedFile)
}

function elevateWindows(operation) {
    let elev = `"${currPath}" ${operation} elevated`
    console.log("Running the following command elevated: " + elev)
    
    const ps = new shell({
        executionPolicy: 'Bypass',
        noProfile: true
    })
    
    ps.addCommand(`Start-Process -WindowStyle normal cmd -Verb RunAs -ArgumentList '/c ${elev}'`)
    ps.invoke().then(o => process.exit(0))
}

function installServiceWinLin() {
    // Must be elevated on Windows or sudo on Linux
    if(process.platform == "win32") {
        // We could be reinstalling
        try {
            cp.execSync("net stop ezduck")
        }
        catch {}
    }
    if(currPath != newPath) {
        console.log("Installing binaries into " + path.dirname(newPath))
        fs.copyFileSync(currPath, newPath)
        fs.copyFileSync(origAddonPath, homedir + path.sep + "service.node")
    }
    process.argv[1] = ""
    service.remove("ezduck", (e) => {
        service.add(
            "ezduck",
            {
                displayName: "ezduck",
                programPath: "",
                nodePath: newPath
            },
            (ee) => {
                if(ee) {
                    console.log(ee)
                }
                if(process.platform == "win32") {
                    cp.execSync("net start ezduck")
                }
                else {
                    cp.execSync("service ezduck start")
                }
                writeInstalledFile()
                process.exit(0)
            }
        )
    })
}

function installService() {
    try {
        if(process.platform == "linux" && os.userInfo().username != "root") {
            console.log("Please run as root.")
            process.exit(1)
        }

        if(process.platform == "win32") {
            if(!(process.argv.length == 3 && process.argv[2] == "elevated" || process.argv.length == 4 && process.argv[3] == "elevated")) {
                console.log("Need to elevate for service install.")
                
                elevateWindows("install")
            }
            else { 
                console.log("This process has been elevated.")
                installServiceWinLin()
            }
        }
        else if(process.platform == "darwin") {
            installServiceMac()
            writeInstalledFile()
            process.exit(0)
        }
        else {
            installServiceWinLin()
        }
    }
    catch(ierr) {
        console.log(ierr)
        setTimeout(function(){}, 60000)
    }
}

function uninstallService() {
    if(process.platform == "linux" && os.userInfo().username != "root") {
        console.log("Please run as root.")
        process.exit(1)
    }

    //Stop the service - Mac/Linux only; Win needs to happen after elevation
    try {
        // Ignore if the service isn't running
        if(process.platform == "darwin") {
            cp.execSync("sudo launchctl unload /Library/LaunchDaemons/ezduck.plist")
        }
        else if(process.platform == "linux" || process.platform == "freebsd") {
            cp.execSync("service ezduck stop")
        }
    }
    catch{}

    if(process.platform == "win32") {
        if(!(process.argv.length == 3 && process.argv[2] == "elevated" || process.argv.length == 4 && process.argv[3] == "elevated")) {
            console.log("Need to elevate for service uninstall.")
            elevateWindows("uninstall")
        }
        else { 
            console.log("This process has been elevated.")
            uninstallServiceWinLin()
        }
    }
    else if(process.platform == "darwin") {
        uninstallServiceMac()
        deleteInstalledFile()
        process.exit(0)
    }
    else {
        uninstallServiceWinLin()
    }
}

function uninstallServiceWinLin() {
    // Must be elevated on Windows or sudo on Linux
    if(process.platform == "win32") {
        // Stop before removing, but ignore if it's not running
        try {
            cp.execSync("net stop ezduck")
        }
        catch {}
    }

    service.remove("ezduck", (e) => {
        deleteInstalledFile()
        process.exit(0)
    })
}

function deleteInstalledFile() {
    try {
        fs.unlinkSync(installedFile)
    }
    catch{}
}

console.log("Command: " + command)
if(command == "default") {
    if(!fs.existsSync(installedFile)) {
        interactiveConfig()
        installService()
        setTimeout(function(){}, 5000)
    }
    else {
        doWork()
    }
}
else if(command == "install") {
    interactiveConfig()
    installService()
    setTimeout(function(){}, 5000)
}
else if(command == "uninstall") {
    uninstallService()
    setTimeout(function(){}, 5000)
}
else if(command == "run") {
    doWork()
}
else {
    console.log("Unknown command. Usage: ezduck [command]. Valid commands are: default, install, uninstall, run. Falling back to 'run' behavior.")
    doWork()
}