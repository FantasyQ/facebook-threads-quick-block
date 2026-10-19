const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension/core.js');
test('accept profile identities and discard tracking/comment parameters', () => {
  assert.equal(C.profileURL('https://www.facebook.com/example.name?comment_id=abc&__tn__=x'), 'https://www.facebook.com/example.name');
  assert.equal(C.profileURL('/profile.php?id=123456&comment_id=abc'), 'https://www.facebook.com/profile.php?id=123456');
  assert.equal(C.profileURL('/123456/'), 'https://www.facebook.com/123456');
});
test('reject external, executable, non-profile and credential-bearing URLs', () => {
  for (const url of ['javascript:alert(1)','https://evil.test/alice','https://www.facebook.com.evil.test/alice','https://www.facebook.com@evil.test/alice','https://u:p@www.facebook.com/alice','http://www.facebook.com/alice','https://www.facebook.com:444/alice','/groups/test','/alice/posts/123','/photo/?fbid=123','/profile.php?id=no','/settings','/']) assert.equal(C.profileURL(url),null,url);
});
test('identify authors using article labels, not mentions or reply authors', () => {
  assert.equal(C.authorMatches('Alice的留言3年前','Alice'),true);
  assert.equal(C.authorMatches('Alice的留言3年前','Ali'),false);
  assert.equal(C.authorMatches('Alice的留言3年前','Bob'),false);
  assert.equal(C.authorMatches('Alice的留言3年前',''),false);
  assert.equal(C.authorMatches('Comment by Alice 2 days ago','Alice'),true);
});
test('require the confirmation title to identify exactly the intended person', () => {
  assert.equal(C.confirmationMatches('封鎖Alice？','Alice'),true);
  assert.equal(C.confirmationMatches('封鎖Alice Smith？','Alice'),false);
  assert.equal(C.confirmationMatches('Block Alice?','Alice'),true);
});
test('recognize expanded reply labels without selecting the recipient or a partial name', () => {
  for (const name of ['測試甲','Test Alice']) {
    const label = `${name}回覆測試乙的留言16小時前`;
    assert.equal(C.authorMatches(label,name),true);
    assert.equal(C.authorMatches(label,'測試乙'),false);
    assert.equal(C.authorMatches(label,name.slice(0,-1)),false);
    assert.equal(C.authorMatches(label,''),false);
  }
  assert.equal(C.authorMatches('測試甲回覆的留言','測試甲'),false);
});
