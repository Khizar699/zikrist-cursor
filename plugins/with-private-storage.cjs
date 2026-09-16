const { withAppDelegate, withAndroidManifest, withDangerousMod, withPodfile, withXcodeProject } = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

function readShellScript(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    return JSON.parse(value);
  } catch {
    // Fresh Expo templates can embed raw newlines inside the quoted pbxproj
    // string, which is not valid JSON. Unquote and unescape manually.
    let script = value;
    if (script.startsWith('"') && script.endsWith('"')) script = script.slice(1, -1);
    return script.replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
}

function quoteBuildPhases(project) {
  for (const phase of Object.values(project.hash.project.objects.PBXShellScriptBuildPhase ?? {})) {
    if (typeof phase !== 'object') continue;
    const script = readShellScript(phase.shellScript);
    if (!script) continue;
    // Quote the path returned by Node, so the workspace may contain spaces.
    phase.shellScript = JSON.stringify(script.replace(/^`(.+react-native-xcode\.sh.+)`$/m, '"$($1)"'));
  }
}

module.exports = function withPrivateStorage(config) {
  config = withXcodeProject(config, (mod) => { quoteBuildPhases(mod.modResults); return mod; });
  // AudioAPI reads this while autolinking evaluates podspecs. The upstream
  // plugin appends it too late for that first evaluation; set it at the top.
  config = withPodfile(config, (mod) => {
    mod.modResults.contents = "ENV['DISABLE_AUDIOAPI_FFMPEG'] = '1'\npod 'onnxruntime-c', '1.24.3'\n" + mod.modResults.contents
      .replace(/^.*ENV\['DISABLE_AUDIOAPI_FFMPEG'\].*\n?/gm, '')
      .replace(/^pod 'onnxruntime-c'.*\n?/gm, '');
    return mod;
  });
  config = withAppDelegate(config, (mod) => {
    const marker = '// Zikrist: private offline storage';
    if (!mod.modResults.contents.includes(marker)) {
      const anchor = 'let delegate = ReactNativeDelegate()';
      if (!mod.modResults.contents.includes(anchor)) throw new Error('Private storage plugin: AppDelegate template changed.');
      mod.modResults.contents = mod.modResults.contents.replace(anchor, `${marker}
    for directory: FileManager.SearchPathDirectory in [.documentDirectory, .applicationSupportDirectory] {
      do {
        var url = try FileManager.default.url(for: directory, in: .userDomainMask, appropriateFor: nil, create: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try url.setResourceValues(values)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path)
      } catch {
        fatalError("Unable to protect Zikrist storage: \\(error)")
      }
    }
    ${anchor}`);
    }
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0].$;
    app['android:allowBackup'] = 'false';
    app['android:fullBackupContent'] = 'false';
    app['android:dataExtractionRules'] = '@xml/zikrist_data_extraction_rules';
    return mod;
  });
  return withDangerousMod(config, ['android', async (mod) => {
    const directory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await fs.mkdir(directory, { recursive: true });
    const exclusions = ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref']
      .map((domain) => `<exclude domain="${domain}" path="."/>`).join('');
    await fs.writeFile(path.join(directory, 'zikrist_data_extraction_rules.xml'),
      `<?xml version="1.0" encoding="utf-8"?><data-extraction-rules><cloud-backup>${exclusions}</cloud-backup><device-transfer>${exclusions}</device-transfer></data-extraction-rules>`);
    return mod;
  }]);
};
module.exports.quoteBuildPhases = quoteBuildPhases;
module.exports.readShellScript = readShellScript;
