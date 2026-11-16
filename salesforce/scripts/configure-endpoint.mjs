#!/usr/bin/env node
/**
 * Points the Salesforce metadata at your public HTTPS restaurant API host.
 *
 *   node scripts/configure-endpoint.mjs https://api.example.com            (writes the files)
 *   node scripts/configure-endpoint.mjs https://api.example.com --dry-run  (shows what would change)
 *
 * It edits two files:
 *   - namedCredentials/Restaurant_API.namedCredential-meta.xml  -> Url = <host>/api/v1
 *   - cspTrustedSites/Restaurant_Images.cspTrustedSite-meta.xml -> endpointUrl = <image host>, isActive = true
 *
 * Optional: --images https://cdn.example.com   if dish photos are served from a different host.
 * Salesforce can only reach a PUBLIC HTTPS URL. localhost will not work.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const imagesIdx = args.indexOf('--images');
const imagesArg = imagesIdx >= 0 ? args[imagesIdx + 1] : undefined;
const hostArg = args.find((a) => !a.startsWith('--') && a !== imagesArg);

function fail(msg) {
    console.error(`ERROR: ${msg}`);
    process.exit(1);
}

function cleanOrigin(value, label) {
    let u;
    try {
        u = new URL(value);
    } catch {
        fail(`${label} is not a valid URL: ${value}`);
    }
    if (u.protocol !== 'https:') fail(`${label} must be https:// (Salesforce will not call plain http).`);
    if (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(u.hostname)) fail(`${label} cannot be localhost: Salesforce's cloud cannot reach your machine. Use a public tunnel or host.`);
    if (u.username || u.password) fail(`${label} must not contain credentials.`);
    return u.origin;
}

if (!hostArg) fail('Usage: node scripts/configure-endpoint.mjs https://your-public-host [--images https://cdn-host] [--dry-run]');

const apiOrigin = cleanOrigin(hostArg, 'API host');
const imageOrigin = cleanOrigin(imagesArg ?? hostArg, 'Image host');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'force-app', 'main', 'default');

const edits = [
    {
        file: join(root, 'namedCredentials', 'Restaurant_API.namedCredential-meta.xml'),
        apply: (xml) => xml.replace(/(<parameterName>Url<\/parameterName>\s*<parameterType>Url<\/parameterType>\s*<parameterValue>)[^<]*(<\/parameterValue>)/, `$1${apiOrigin}/api/v1$2`),
        check: (xml) => xml.includes(`${apiOrigin}/api/v1`)
    },
    {
        file: join(root, 'cspTrustedSites', 'Restaurant_Images.cspTrustedSite-meta.xml'),
        apply: (xml) => xml.replace(/<endpointUrl>[^<]*<\/endpointUrl>/, `<endpointUrl>${imageOrigin}</endpointUrl>`).replace(/<isActive>false<\/isActive>/, '<isActive>true</isActive>'),
        check: (xml) => xml.includes(`<endpointUrl>${imageOrigin}</endpointUrl>`) && xml.includes('<isActive>true</isActive>')
    }
];

for (const e of edits) {
    const before = readFileSync(e.file, 'utf8');
    const after = e.apply(before);
    if (!e.check(after)) fail(`Could not update ${e.file}. Did its structure change?`);
    console.log(`${dry ? '[dry run] would update' : 'Updated'} ${e.file.split('default')[1]}`);
    if (!dry) writeFileSync(e.file, after);
}
console.log(`\nNamed Credential URL : ${apiOrigin}/api/v1`);
console.log(`CSP trusted image host: ${imageOrigin}`);
console.log('\nNext: deploy, then add the API key secret in Setup (see docs/SETUP.md, step 4).');
