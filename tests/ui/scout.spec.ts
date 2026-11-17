import {test,expect,type Page} from '@playwright/test';
async function mockVK(page:Page,options:{error?:number;empty?:boolean;slow?:boolean}={}){
 await page.route('https://api.vk.com/method/**',async route=>{
  if(options.slow)await new Promise(r=>setTimeout(r,2000));
  const method=new URL(route.request().url()).pathname.split('/').pop();const body=new URLSearchParams(route.request().postData()||'');
  const owner=Number(body.get('group_ids')||body.get('owner_id')||42),id=Math.abs(owner);
  const profile={id,name:id===84?'Growth Artist':'Hot Artist',description:'Независимый музыкальный артист',members_count:1200,screen_name:'artist'+id};
  const post={id:101,owner_id:owner>0?-owner:owner,from_id:owner>0?-owner:owner,date:Math.floor(Date.now()/1000)-86400,text:id===84?'Записываем новый альбом':'Ищу звукорежиссера для сведения нового трека'};
  let response:unknown=method==='users.get'?[{id:1,first_name:'Test',last_name:'Operator'}]:method==='groups.getById'?[profile]:method==='groups.search'?{items:[{id:84,name:'Growth Artist'}]}:method==='wall.get'?{items:options.empty?[]:[post]}:{items:options.empty?[]:[{...post,owner_id:-42,from_id:-42}],groups:[{...profile,id:42}]};
  await route.fulfill({json:options.error?{error:{error_code:options.error,error_msg:'fixture error'}}:{response}}).catch(()=>{});
 });
}
async function configure(page:Page){await page.goto('./#/settings');await page.getByPlaceholder('https://oauth.vk.com/blank.html#access_token=...').fill('test-placeholder');const limits=page.locator('.settings-page input[type="number"]');await limits.nth(0).fill('1');await limits.nth(1).fill('1');await page.getByRole('button',{name:'Сохранить все настройки',exact:true}).click();await expect(page.getByText('Настройки сохранены; токены — только до перезагрузки',{exact:true})).toBeVisible();}
test('original navigation, isolated demo, evidence, three editable drafts',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('./#/search');await page.getByRole('button',{name:'Демо',exact:true}).click();await expect(page.locator('.candidate-card-v2')).toHaveCount(4);
 expect(await page.evaluate(()=>localStorage.getItem('asv_scout_v3_records'))).toBeNull();await expect(page.getByRole('button',{name:'В CRM',exact:true}).first()).toBeDisabled();
 await page.getByRole('button',{name:'Публикации и оценка'}).first().click();await expect(page.locator('.evidence-panel').first()).toContainText('не является вероятностью');
 await page.getByRole('button',{name:'Сообщение',exact:true}).first().click();const draft=page.getByRole('textbox',{name:'Текст обращения'});expect(await draft.inputValue()).not.toMatch(/послуш/);await draft.fill('Мой черновик');await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.goto('./#/crm');await expect(page.locator('.kanban-board')).toBeVisible();
 for(const label of ['ИМПОРТ','ЭКСПОРТ']){const box=await page.getByRole('button',{name:label,exact:true}).boundingBox();expect(box&&box.x>=0&&box.x+box.width<=page.viewportSize()!.width).toBeTruthy();}await page.getByRole('button',{name:/Список/}).click();await expect(page.locator('.crm-page')).toContainText('CRM пока пуста');await page.getByRole('button',{name:'Доска',exact:true}).click();
 await page.goto('./#/settings');await expect(page.getByPlaceholder('https://oauth.vk.com/blank.html#access_token=...')).toHaveAttribute('type','password');expect(errors).toEqual([]);
});
test('MOCK VK full flow: search → evidence → CRM → manual contact → paid order → reload/export',async({page})=>{
 await mockVK(page);await configure(page);await page.getByRole('button',{name:'ПРОВЕРИТЬ VK ТОКЕН'}).click();await expect(page.getByText('Подключено: Test Operator',{exact:true})).toBeVisible();
 await page.goto('./#/search');await page.getByRole('button',{name:'🚀 Найти клиентов'}).click();await expect(page.locator('.candidate-card-v2')).toHaveCount(2);expect(await page.evaluate(()=>localStorage.getItem('asv_scout_v3_records'))).toBeNull();
 await page.getByRole('combobox',{name:'Фильтр возможностей'}).selectOption('growth');await expect(page.locator('.candidate-card-v2')).toHaveCount(1);await expect(page.locator('.candidate-card-v2')).toContainText('Growth Artist');await page.getByRole('combobox',{name:'Фильтр возможностей'}).selectOption('hot');
 await page.getByRole('button',{name:'Публикации и оценка'}).click();await expect(page.locator('.evidence-panel')).toContainText('Ищу звукорежиссера');
 await page.route('https://vk.com/**',route=>route.fulfill({body:'Mock VK source: no messages sent',contentType:'text/plain'}));const sourcePopup=page.waitForEvent('popup');await page.getByRole('button',{name:'Открыть источник',exact:true}).click();const source=await sourcePopup;await expect(source).toHaveURL(/wall-42_101/);await source.close();
 await page.getByRole('button',{name:'В CRM',exact:true}).click();await expect(page.getByText('Артист сохранён в CRM',{exact:true})).toBeVisible();await page.getByRole('button',{name:'В CRM',exact:true}).click();await expect(page.locator('.artist-page')).toBeVisible();
 const draft=page.getByRole('textbox',{name:'Текст обращения'});expect(await draft.inputValue()).toContain('wall-42_101');
 await page.route('https://vk.me/**',route=>route.fulfill({body:'Mock manual VK contact screen',contentType:'text/plain'}));const contactPopup=page.waitForEvent('popup');await page.getByRole('button',{name:/НАПИСАТЬ В СООБЩЕСТВО/}).click();const contact=await contactPopup;await expect(contact).toHaveURL(/vk.me/);await contact.close();
 await page.locator('.status-select-v2').selectOption('Ответил');await expect(page.getByText('Данные сохранены',{exact:true}).last()).toBeVisible();await page.locator('.status-select-v2').selectOption('Переговоры');await expect(page.locator('.artist-page button').filter({hasText:'СОХРАНИТЬ'})).toBeEnabled();
 await page.getByLabel('Напоминание').fill('2026-12-10');await page.getByRole('spinbutton',{name:'Сумма заказа'}).fill('12000');await page.locator('.status-select-v2').selectOption('Клиент');await expect(page.getByRole('button',{name:'СОХРАНИТЬ',exact:true})).toBeEnabled();await page.getByRole('button',{name:'СОХРАНИТЬ',exact:true}).click();await expect(page.getByText('Данные сохранены',{exact:true}).last()).toBeVisible();
 await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('asv_scout_v3_records')||'[]')[0]?.valueRub)).toBe(12000);
 await page.getByPlaceholder('О чем договорились? Отправили демо? Вопросы по прайсу?..').fill('Договорились об обработке EP');await page.getByRole('button',{name:'ДОБАВИТЬ ЗАПИСЬ'}).click();await expect(page.getByText('Заметка добавлена в историю',{exact:true})).toBeVisible();
 await page.reload();await expect(page.locator('.artist-page')).toContainText('Договорились об обработке EP');await expect(page.getByRole('spinbutton',{name:'Сумма заказа'})).toHaveValue('12000');await expect(page.locator('.status-select-v2')).toHaveValue('Клиент');
 await page.goto('./#/crm');await expect(page.locator('.crm-page')).toContainText('12');const download=page.waitForEvent('download');await page.getByRole('button',{name:'ЭКСПОРТ',exact:true}).click();const exported=await download;expect(exported.suggestedFilename()).toBe('ASV-Scout-CRM.json');const exportPath=await exported.path();expect(exportPath).toBeTruthy();
 const csv=page.waitForEvent('download');await page.getByRole('button',{name:'CSV',exact:true}).click();expect((await csv).suggestedFilename()).toBe('ASV-Scout-CRM.csv');
 await page.locator('.crm-page input[type=file]').setInputFiles(exportPath!);await expect(page.getByText(/Импортировано:/).last()).toBeVisible();await page.getByRole('button',{name:/Список/}).click();await expect(page.locator('.crm-page')).toContainText('Hot Artist');
 expect(await page.evaluate(()=>[...Object.entries(localStorage)].some(([k,v])=>/token|key/i.test(k)||String(v).includes('test-placeholder')))).toBeFalsy();
});
test('MOCK VK explicit errors, empty search, cancellation and repeat scan dedupe',async({page})=>{
 await mockVK(page,{error:5});await configure(page);await page.goto('./#/search');await page.getByRole('button',{name:'🚀 Найти клиентов'}).click();await expect(page.locator('.error-alert')).toContainText('токен');await expect(page.locator('.candidate-card-v2')).toHaveCount(0);
 await page.unroute('https://api.vk.com/method/**');await mockVK(page,{slow:true});await page.getByRole('button',{name:'🚀 Найти клиентов'}).click();await page.getByRole('button',{name:'Отменить поиск'}).click();await expect(page.getByText('Поиск отменён пользователем',{exact:true})).toBeVisible();
 await page.unroute('https://api.vk.com/method/**');await mockVK(page,{empty:true});await page.getByRole('button',{name:'🚀 Найти клиентов'}).click();await expect(page.getByText('Подходящих возможностей не найдено',{exact:true}).first()).toBeVisible();
});
for(const route of ['search','crm','settings'])test('visual comparison original 2.0 / final 3.0: '+route,async({page},info)=>{
 await page.route(/https:\/\/(?:api\.)?vk\./,r=>r.abort());
 await page.goto('http://127.0.0.1:5174/ai-music-scout/#/'+route);await expect(page.locator('.main-content')).toBeVisible();await page.screenshot({path:`test-results/original-${route}-${info.project.name}.png`,fullPage:true});
 await page.goto('./#/'+route);await expect(page.locator('.main-content')).toBeVisible();await page.screenshot({path:`test-results/final-${route}-${info.project.name}.png`,fullPage:true});
 if(route==='search'){await page.getByRole('button',{name:'Демо',exact:true}).click();await page.screenshot({path:`test-results/final-results-${info.project.name}.png`,fullPage:true});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
