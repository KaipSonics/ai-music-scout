import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || '.v2-comparison');
function replaceFile(path, transform) {
  const file = resolve(root, path);
  const before = readFileSync(file, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`Expected change missing: ${path}`);
  writeFileSync(file, after);
}
replaceFile('src/utils/tauriBridge.ts', s => {
  const re = /^const BUILTIN_FREE_AI_KEY = .*;$/m;
  if (!re.test(s) || !s.includes('asv_crm_artists') || !s.includes('asv_setting_')) throw new Error('Unexpected original bridge');
  return s.replace(re, "const BUILTIN_FREE_AI_KEY = '';")
    .replaceAll('asv_crm_artists', 'scout_v2_test_crm_artists')
    .replaceAll('asv_setting_', 'scout_v2_test_setting_');
});
replaceFile('src/App.vue', s => s.replaceAll('asv_pwa_unlocked', 'scout_v2_test_pwa_unlocked'));
replaceFile('src/views/SettingsView.vue', s => s.replace('scope=friends,photos,audio,video,docs,notes,pages,status,wall,groups,messages,offline', 'scope=wall,groups'));
