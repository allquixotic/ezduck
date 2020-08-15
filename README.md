# ezduck

Very easy [DuckDNS](https://duckdns.org) updater daemon with an extremely simple install process.

## Features:

 - Extremely easy to install.
 - Low memory/CPU footprint. On Windows it takes up about 7.5 MB.
 - Cross-platform. Runs on Windows 7 x64, recent macOS and Linux.
 - Doesn't require any runtimes or dependencies on the system.
 - Fairly expeditiously detects network changes (like going from an Internet cafe to home and back) without spamming public network services.
 - Automatically starts on boot.
 - Runs as a service. No annoying system tray icon.

## Howto:

Step 1 is common to all OSes.

1. Download or compile the program. If you use my release .zip, extract it to a folder -- don't run the exe directly within the zip. If you want to compile from source, see the instructions below.

### Windows

2. Run ezduck.exe. When you receive the Windows User Account Control prompt, make sure to allow the program to run.

3. When prompted, enter your DuckDNS subdomain and token.

### MacOS

2. Launch a Terminal. The Terminal app is accessible from "Applications" in Finder.

3. Use `cd` to change directory to where the zip file is extracted.

4. Run `./ezduck` 

5. When prompted, enter your DuckDNS subdomain and token.

6. When prompted, enter your logged-in user's password. Your user must be an admin to install the ezduck service.

### Linux

2. From a terminal, use `cd` to change directory to where the zip file is extracted.

3. Run `sudo ./ezduck` in a terminal. Enter your logged-in user's password. Your user must be in the sudoers file to install the ezduck service.

4. When prompted, enter your DuckDNS subdomain and token.

### Compiling from Source

Run `node build.js`. There is no support for building for a different platform than the one you're on. Check the output directory, e.g. output-win32, output-macos, output-linux for the result.

--------

## Default Behavior

On all platforms, the result of following the "Howto" instructions is as follows:

 - The file `service.node` (a required dependency) and the `ezduck` or `ezduck.exe` executable is copied to your home directory.
   - Your home directory is `C:\Users\<you>` on Windows, `/home/<you>` on Linux, or `/Users/<you>` on macOS.
 - The ezduck program will start up automatically when your PC starts, using the "service management" facility of your platform.
   - Supported service management interfaces: Windows Services; macOS launchd; and on Linux, systemd or SysV init. Others that implement compatibility with one of the above may work.
 - A file named `.ezduckInstalled` will be created in your home directory to indicate to ezduck that it has previously been installed.
 - A file named `ezduck.config.json` will be created in your home directory to store your DuckDNS subdomain and token.

## Request Logic (Technical)

 - Every 10 _seconds_, ezduck will look at your active network interface's private IP address (this does not involve a network hop). If it changed, we will call DuckDNS and ask them to update your dynamic DNS with your latest public IP.
   - Note that your private IP changing is not a fantastic heuristic for your public IP changing in general. However, it's often true that when your private IP changes, it "typically" means that the user has changed to a different network/ISP. Even if this assumption is wrong, this doesn't happen often enough to impose a lot of load on DuckDNS.
 - Every 10 _minutes_, ezduck will query a public "what is my IP" service, such as dyndns.org, to determine if your public IP address from the perspective of the Internet has changed. If it _has_ changed, DuckDNS will be notified of the change.
   - If the public "what is my IP" services are down, we'll just send the request to DuckDNS anyway. This isn't a big deal, since we're only doing it every 10 minutes.
   - We use a public IP service to reduce load on DuckDNS, even though it does technically _create_ load for the public IP service. I believe the public IP services have a larger network capacity to handle frequent requests than the very small, "indie" service DuckDNS, which is why I choose to put the every-10-minutes burden primarily on dyndns.org or similar rather than DuckDNS. dyndns.org is owned by Oracle; DuckDNS is run by a few private individuals.

## Limitations:

 - Polls your private network IP (which doesn't involve a hop to the Internet, at least) every 10 seconds. On a Raspberry Pi, this could be significant CPU usage. It's nothing on a desktop PC or laptop.
 - Fairly cryptic user interface, especially for those who don't read the docs, need to do something non-standard, or are non-technical.
 - Not too customizable.
 - No support for multiple subdomains yet.
 - Only designed to work with DuckDNS. Could easily be adapted to work with another DDNS service that implemented the same protocol, though.

License: Apache License 2.0 as per https://www.apache.org/licenses/LICENSE-2.0.txt
