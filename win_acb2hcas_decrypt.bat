@echo off
set /P key=Please input key and press Enter: 
if "%key%"=="" set key=0
node.exe "%~dp0index.js" acb2hcas -d -k %key% %*
pause
