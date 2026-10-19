/* Shared URL and author validation. */
(() => {
  const reserved = new Set(['photo','photos','posts','groups','watch','reel','reels','stories','story.php','permalink.php','friends','settings','help','login','login.php','checkpoint','notifications','messages','marketplace','gaming','share','sharer.php','hashtag','search','pages','events','privacy','policies','dialog','l.php']);
  function profileURL(raw) {
    try {
      const u = new URL(raw, 'https://www.facebook.com');
      if (u.protocol !== 'https:' || u.hostname !== 'www.facebook.com' || u.port || u.username || u.password) return null;
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length === 1 && parts[0] === 'profile.php') {
        const id = u.searchParams.get('id');
        return /^\d+$/.test(id || '') ? `https://www.facebook.com/profile.php?id=${id}` : null;
      }
      if (parts.length === 1 && /^[a-zA-Z0-9.]+$/.test(parts[0]) && !reserved.has(parts[0].toLowerCase())) return `https://www.facebook.com/${parts[0]}`;
      return null;
    } catch { return null; }
  }
  const normalize = text => String(text || '').replace(/\s+/g, ' ').trim();
  function authorMatches(label, name) {
    label = normalize(label); name = normalize(name);
    const replyPrefix = `${name}回覆`;
    const replyToCommentOrReply = label.startsWith(replyPrefix) && /^.+的(?:留言|回覆)/.test(label.slice(replyPrefix.length));
    return Boolean(name) && (label.startsWith(`${name}的留言`) || label.startsWith(`${name}的回覆`) || replyToCommentOrReply || [`Comment by ${name}`, `Reply by ${name}`].some(prefix => label === prefix || label.startsWith(`${prefix} `)));
  }
  function confirmationMatches(title, name) {
    title = normalize(title); name = normalize(name);
    return title === `封鎖${name}？` || title === `封鎖 ${name}？` || title === `Block ${name}?`;
  }
  const api = { profileURL, normalize, authorMatches, confirmationMatches };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.FBQuickBlock = api;
})();
