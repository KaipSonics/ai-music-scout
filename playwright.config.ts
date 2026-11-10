import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/ui',fullyParallel:false,workers:1,timeout:45000,
 use:{baseURL:'http://127.0.0.1:5173/ai-music-scout/',headless:true,screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}},
 webServer:[
 {command:'npm run dev -- --host 127.0.0.1 --port 5173',url:'http://127.0.0.1:5173/ai-music-scout/',reuseExistingServer:!process.env.CI},
 {command:'node scripts/serve-original.mjs',url:'http://127.0.0.1:5174/ai-music-scout/',reuseExistingServer:!process.env.CI}
 ],projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}]});
