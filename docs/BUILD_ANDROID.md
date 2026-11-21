# Build the Android APK (from Ubuntu in proot, e.g. Termux + proot-distro)

Two ways to get the game on your phone. Option A takes 2 minutes. Option B gives
you an installable APK built entirely on your device.

## Option A — play instantly, no build

1. Copy the `game/` folder to your phone (e.g. into the Download folder).
2. Open Chrome or Firefox on Android, type
   `file:///sdcard/Download/game/index.html`
   (or open it with your Files app -> open with browser).
3. Optional: in Chrome use **⋮ -> Add to Home screen** for an icon.

## Option B — build a real APK inside proot Ubuntu

### 1. Install the tools

```bash
sudo apt update
sudo apt install -y openjdk-17-jdk-headless unzip wget
```

AGP 8.4 needs JDK 17 exactly, so check: `java -version` should say 17.

### 2. Install the Android SDK (command-line, no Android Studio)

```bash
mkdir -p ~/android/cmdline-tools
cd /tmp
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip -d ~/android/cmdline-tools
mv ~/android/cmdline-tools/cmdline-tools ~/android/cmdline-tools/latest

export ANDROID_HOME=~/android
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

yes | sdkmanager --licenses
sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"
```

### 3. Install Gradle 8.7 (do not use apt's gradle — it is far too old for AGP 8)

```bash
cd /tmp
wget https://services.gradle.org/distributions/gradle-8.7-bin.zip
unzip gradle-8.7-bin.zip -d ~/
export PATH=$PATH:~/gradle-8.7/bin
```

### 4. Sync the game into the app and build

```bash
cd /path/to/kung-fu-pigeon
./tools/sync-assets.sh

echo "sdk.dir=$HOME/android" > android/local.properties

cd android
gradle assembleDebug
```

The first build downloads Gradle plugins and can take 10-30 minutes inside
proot. Subsequent builds are much faster (the daemon stays alive).

### 5. Install the APK on your device

```bash
cp app/build/outputs/apk/debug/app-debug.apk ~/storage/shared/Download/
```

(The `~/storage/shared` path assumes Termux storage access.) Then on Android:
enable **Settings -> Security -> Install unknown apps** for your Files app if
asked, tap the APK in Download, and install. You will get a launcher icon.

## Troubleshooting in proot

- **Out of memory / JVM killed**: lower the heap in `android/gradle.properties`
  (`-Xmx1024m`) and make sure no other apps are open. Building with less than
  ~2 GB free RAM is painful.
- **Slow first build**: normal. Everything after the first `assembleDebug` is incremental.
- **`Failed to find sdk.dir`**: make sure `android/local.properties` exists and points at `$HOME/android`.
- **WebView too old**: the game needs Chrome/WebView 70+. Update Android System WebView via Play Store.

## Making a shareable release APK

```bash
cd android
gradle assembleRelease
```

For a fully signed release to share with others, add your own signing config —
or just share the debug APK, which is self-signed and installs fine on any phone
that allows unknown sources.
