@echo off
set /P key=Please input key and press Enter: 
if "%key%"=="" set key=0
node.exe "%~dp0src\index.js" acb2wavs -k %key% %*
pause
