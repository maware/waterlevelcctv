@echo off
set PATH=%PATH%;C:\ffmpeg\bin
cd C:\xampp\htdocs\1
pm2 start "C:\Users\Maware\AppData\Roaming\npm\node_modules\tsx\dist\cli.mjs" --name watpuek-cam -- "C:\xampp\htdocs\1\server.ts"