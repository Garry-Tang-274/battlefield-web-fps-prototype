@echo off
setlocal
cd /d "%~dp0"
echo [信息] 正在启动群岛前线。
echo [INFO] Starting Archipelago Frontline.
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 scripts\start_server.py
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  python scripts\start_server.py
  goto :end
)
echo [错误] 未找到 Python 3，请先安装并勾选 Add Python to PATH。
echo [ERROR] Python 3 was not found. Install it and select Add Python to PATH.
pause
:end
endlocal
