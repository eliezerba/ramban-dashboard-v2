@echo off
setlocal
set ROOT=%~dp0

if not exist "%ROOT%index.html" (
	echo [ERROR] Missing file: %ROOT%index.html
	pause
	exit /b 1
)

if not exist "%ROOT%data\data-index.js" (
	echo [INFO] data-index.js is missing. Running data build...
	where node >nul 2>nul
	if errorlevel 1 (
		echo [ERROR] Node.js was not found. Cannot generate data files.
		pause
		exit /b 1
	)
	pushd "%ROOT%"
	node ".\scripts\build-data-index.js"
	if errorlevel 1 (
		popd
		echo [ERROR] Failed to build data index.
		pause
		exit /b 1
	)
	popd
)

start "" "%ROOT%index.html"
