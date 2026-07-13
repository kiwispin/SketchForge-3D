$ErrorActionPreference = "Stop"

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) {
  throw "Visual Studio Build Tools could not be found. Install the Desktop development with C++ workload first."
}

$installPath = & $vswhere -latest -products * -property installationPath
$devCommand = Join-Path $installPath "Common7\Tools\LaunchDevCmd.bat"
if (-not (Test-Path $devCommand)) {
  throw "Visual Studio's developer command prompt is unavailable."
}

# Tauri uses Rust's Windows linker. LaunchDevCmd supplies the correct linker,
# Windows SDK and libraries for the machine's native architecture.
$command = "call `"$devCommand`" -host_arch=arm64 -arch=arm64 >nul && set PATH=%USERPROFILE%\.cargo\bin;%PATH% && npm.cmd run desktop:build -- --debug"
& cmd.exe /d /s /c $command
exit $LASTEXITCODE
