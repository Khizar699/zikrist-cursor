import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const [platform, ...args] = process.argv.slice(2);
if (platform !== 'ios' && platform !== 'android') throw new Error('Expected ios or android.');

const modelPath = path.join(root, 'assets/model/fastconformer_full_mixed.onnx');
if (!existsSync(modelPath)) {
  console.error(
    'Recognition model missing (gitignored ~88 MB ONNX).\n' +
      'Run:  npm run setup\n' +
      'Or:   npm run assets:download && npm run assets:verify',
  );
  process.exit(1);
}

const env = { ...process.env };
// This workspace may have a project-local CocoaPods installation. Do not
// change the user's shell configuration or require it on other machines.
if (platform === 'ios' && existsSync(path.join(root, '.tooling/bin/pod'))) {
  env.PATH = `${path.join(root, '.tooling/bin')}:${env.PATH}`;
  env.GEM_HOME = path.join(root, '.tooling/gems');
  env.GEM_PATH = env.GEM_HOME;
  env.RUBYOPT = `${env.RUBYOPT ?? ''} -rlogger`.trim();
}
const child = spawn(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), `run:${platform}`, ...args], { cwd: root, env, stdio: 'inherit' });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
