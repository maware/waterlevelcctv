@echo off
cd C:\web

echo =============================
echo   Git Push - waterlevelcctv
echo =============================

set /p msg="ใส่ commit message: "

git add .
git commit -m "%msg%"
git push

echo.
echo =============================
echo   Push เสร็จแล้ว!
echo =============================
pause
