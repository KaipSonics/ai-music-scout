import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {candidateFromOwner,evaluateOpportunity,classifyPost,draftOutreach}=require('../.test-dist/scout/opportunity.js');
const now=Date.UTC(2026,10,9,10);
const artist=candidateFromOwner(-42,{name:'Artist',screen_name:'artist42',members_count:1200,description:'Независимый музыкант'});
const p=(text,days=1,extra={})=>({id:123,owner_id:-42,from_id:-42,date:Math.floor((now-days*86400000)/1000),text,...extra});
let passed=0;
function test(name,cb){try{cb();console.log('✓',name);passed++}catch(e){console.error('✗',name);throw e}}
test('missing data never produces confidence or score',()=>{
  const v=evaluateOpportunity(artist,null,'community',now);
  assert.equal(v.score,null);assert.equal(v.confidence,'missing');
});
test('no signal yields no score',()=>assert.equal(evaluateOpportunity(artist,[p('Просто всем привет')],'community',now).score,null));
test('direct mixing request returns HOT and source permalink',()=>{
  const v=evaluateOpportunity(artist,[p('Ищу звукорежиссера для сведения EP')],'community',now);
  assert.equal(v.kind,'hot');assert.equal(v.service,'mix_master');assert.equal(v.signals[0].url,'https://vk.com/wall-42_123');assert(v.score>60);
});
test('beat request recognized',()=>assert.equal(classifyPost(p('Нужен битмейкер для нового сингла'),now)?.service,'beat'));
test('stem-mastering is detected distinctly',()=>assert.equal(classifyPost(p('Ищу stem-мастеринг под новый EP'),now)?.service,'stem_master'));
test('release planned is GROWTH',()=>assert.equal(evaluateOpportunity(artist,[p('Записываем новый альбом')],'community',now).kind,'growth'));
test('negated request rejected',()=>assert.equal(classifyPost(p('Уже нашли звукорежиссера, спасибо!'),now),null));
test('service advertisement is not a lead',()=>assert.equal(classifyPost(p('Предлагаем сведение и мастеринг от 2000 рублей'),now),null));
test('reposts not treated as commercial evidence',()=>assert.equal(classifyPost(p('Ищу звукорежиссера',1,{copy_history:[{}]}),now),null));
test('posts older than 30 days are not hot',()=>assert.equal(classifyPost(p('Ищу звукорежиссера',35),now),null));
test('future posts do not count',()=>assert.equal(classifyPost(p('Ищу звукорежиссера',-2),now),null));
test('growth activity requires musical context',()=>{
  const c=candidateFromOwner(-12,{name:'Случайный магазин'});
  const posts=[p('Скидка на шторы',2),{...p('Работаем до шести',3),id:124},{...p('Привезли коробки',4),id:125}];
  assert.equal(evaluateOpportunity(c,posts,'community',now).kind,'rejected');
});
test('recent direct request outranks a release hint',()=>{
 const direct=evaluateOpportunity(artist,[p('Ищу звукорежиссера')],'community',now);
 const release=evaluateOpportunity(artist,[p('Записываем новый альбом')],'community',now);
 assert(direct.score>release.score);
});
test('draft never pretends we listened to music',()=>{
  const v=evaluateOpportunity(artist,[p('Ищу звукорежиссера')],'community',now);
  assert(!/послушали|прослушали|оценили ваш звук/i.test(draftOutreach(v)));
});
test('same owner ID is namespaced by source kind',()=>{
  assert.notEqual(candidateFromOwner(-42).id,candidateFromOwner(42).id);
});
test('source confidence requires review, never identity verification',()=>{
  const v=evaluateOpportunity(artist,[p('Ищу звукорежиссера')],'newsfeed',now);
  assert.equal(v.confidence,'source_only');assert.equal(v.signals[0].confidence,'needs_review');
});
console.log(`\n${passed} checks passed`);
