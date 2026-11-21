#!/usr/bin/env node
/**
 * Wires the local upload keystore into the generated Android project.
 *
 * The keystore and its passwords live in ./keystore.properties, which is
 * gitignored. This script only injects a *loader* into Gradle; secrets are never
 * copied into the project, logged, or committed.
 *
 * Usage:
 *   npx expo prebuild --platform android --clean
 *   node tools/android/configure-signing.mjs          # patch + verify
 *   cd android && ./gradlew bundleRelease
 *
 * The android/ directory is generated and gitignored.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PROPS = join(ROOT, 'keystore.properties');
const GRADLE = join(ROOT, 'android/app/build.gradle');

const START = '// @afterlight-signing-start';
const END = '// @afterlight-signing-end';

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!existsSync(PROPS)) fail('keystore.properties not found at repository root.');
if (!existsSync(GRADLE)) fail('android/app/build.gradle not found. Run "npx expo prebuild --platform android" first.');

const raw = readFileSync(PROPS, 'utf8');
const props = {};
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const index = trimmed.indexOf('=');
  if (index < 0) continue;
  props[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
}

for (const key of ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']) {
  if (!props[key]) fail(`keystore.properties is missing "${key}".`);
}

const storePath = isAbsolute(props.storeFile) ? props.storeFile : resolve(ROOT, props.storeFile);
if (!existsSync(storePath)) {
  // Do not print the path's contents, only whether it exists.
  console.warn('! Keystore file referenced by storeFile does not exist on this machine.');
}

let gradle = readFileSync(GRADLE, 'utf8');

if (gradle.includes(START)) {
  console.log('✓ Signing configuration already present. Nothing to do.');
  process.exit(0);
}

const loader = `${START}
    // Loads upload credentials from the gitignored root keystore.properties.
    // No secret is stored in this generated project.
    def afterlightKeystore = new Properties()
    def afterlightKeystoreFile = rootProject.file("../keystore.properties")
    if (afterlightKeystoreFile.exists()) {
        afterlightKeystoreFile.withInputStream { afterlightKeystore.load(it) }
    }
    def afterlightReleaseSigning = !afterlightKeystore.isEmpty()
    ${END}
`;

if (!/^android\s*\{/m.test(gradle)) fail('Could not find the android { } block in build.gradle.');
gradle = gradle.replace(/^android\s*\{/m, (match) => `${match}\n${loader}`);

const signingAnchor = /    signingConfigs \{\n/;
if (!signingAnchor.test(gradle)) fail('Could not find signingConfigs { } in build.gradle.');
gradle = gradle.replace(
  signingAnchor,
  `    signingConfigs {
        release {
            if (afterlightReleaseSigning) {
                storeFile file(afterlightKeystore['storeFile'])
                storePassword afterlightKeystore['storePassword']
                keyAlias afterlightKeystore['keyAlias']
                keyPassword afterlightKeystore['keyPassword']
            }
        }
`,
);

const releaseBlock = /(        release \{\n)([\s\S]*?)(\n        \}\n)/;
const match = gradle.match(releaseBlock);
if (!match) fail('Could not find the release { } build type.');

let block = match[2];
if (!block.includes('afterlightReleaseSigning')) {
  block = block.replace(
    /signingConfig signingConfigs\.debug/,
    `if (afterlightReleaseSigning) {
                signingConfig signingConfigs.release
            } else {
                signingConfig signingConfigs.debug
            }`,
  );
  if (block === match[2]) {
    block = `signingConfig afterlightReleaseSigning ? signingConfigs.release : signingConfigs.debug\n${block}`;
  }
}

gradle = gradle.replace(releaseBlock, `${match[1]}${block}${match[3]}`);

writeFileSync(GRADLE, gradle);
console.log('✓ Release signing configured (reads ./keystore.properties at build time).');
console.log('  Build an AAB with: cd android && ./gradlew bundleRelease');
console.log('  Output: android/app/build/outputs/bundle/release/app-release.aab');
console.log('  The keystore path is never printed. Keep keystore.properties out of git.');
