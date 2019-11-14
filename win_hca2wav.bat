@echo off
set /P key=Please input key and press Enter: 
if "%key%"=="" set key=0
set /P awbKey=Please input awbKey and press Enter: 
if "%awbKey%"=="" set awbKey=0
node.exe "%~dp0index.js" hca2wav -k %key% -w %awbKey% %*
pause
