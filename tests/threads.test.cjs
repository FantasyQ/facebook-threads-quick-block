const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../extension/threads.js');
test('Threads profile URL accepts only exact account paths on supported hosts',()=>{
 assert.equal(T.profileURL('/@test.user_1?x=2'),'https://www.threads.com/@test.user_1');
 for(const url of ['https://evil.test/@alice','https://www.threads.com/@alice/post/123','https://www.threads.com/search','javascript:alert(1)','https://x:y@www.threads.com/@alice'])assert.equal(T.profileURL(url),null);
});
test('confirmation must exactly identify target, not a partial match',()=>{
 assert.ok(T.confirmationMatches('封鎖alice？','alice'));
 assert.ok(T.confirmationMatches('Block @alice?','alice'));
 assert.equal(T.confirmationMatches('封鎖alice2？','alice'),false);
 assert.equal(T.confirmationMatches('封鎖？','alice'),false);
});
test('success requires explicit block result, not generic mention or failure',()=>{
 assert.ok(T.successMatches('已封鎖','alice'));
 assert.ok(T.successMatches('已封鎖「alice」。','alice'));
 for(const text of ['無法封鎖','未能確認已封鎖','alice not blocked','Blocked bob','unblocked','封鎖alice？'])assert.equal(T.successMatches(text,'alice'),false);
});
