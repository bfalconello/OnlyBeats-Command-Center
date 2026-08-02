# Windows Installation — Release 0.2.1

## Option A: instant preview

1. Right-click the ZIP and select **Extract All**.
2. Do not run files from inside the ZIP.
3. Open the extracted folder.
4. Double-click `PREVIEW_APP.bat`.

This opens the interface in your default browser. Preferences persist in that browser profile.

## Option B: native desktop development app

Install these official prerequisites:

1. **Node.js LTS**. During installation, keep the option to add Node to PATH enabled.
2. **Rust** using rustup. Select the default installation.
3. **Microsoft Visual Studio Build Tools 2022**. Select **Desktop development with C++**, the Windows SDK, and MSVC build tools.
4. Restart Windows after installation.
5. Run `CHECK_MY_PC.bat`.
6. Run `RUN_DESKTOP.bat`.

On the first run, npm and Cargo download dependencies. This requires internet access and can take several minutes.

## Create an installer

1. Confirm `RUN_DESKTOP.bat` works first.
2. Close the development app.
3. Run `BUILD_WINDOWS.bat`.
4. When complete, look under `src-tauri\target\release\bundle\`.
5. Use the NSIS `.exe` installer for normal installation.

Do not delete the extracted source folder until the installer has finished building.
