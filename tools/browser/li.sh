#!/bin/bash
# LinkedIn CDP wrapper
NODE="/mnt/c/Program Files/nodejs/node.exe"
SCRIPT=$(wslpath -w /mnt/c/Temp/li-win/linkedin.js)
"$NODE" "$SCRIPT" "$@" 2>&1
