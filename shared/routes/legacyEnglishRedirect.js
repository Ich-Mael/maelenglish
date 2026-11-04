/**
 * The English program moved from /programs/language-learning to /maelenglish
 * (rebranding « English Boost » → MaelEnglish). Old links (emails, bookmarks,
 * shared posts, open tabs) are redirected permanently:
 *   /, /english4all*, /english4everyone*  → /maelenglish
 *   /general-english-boost                → /maelenglish#programmes (catalogue)
 *   /general-english-boost/*              → /maelenglish/cours/*
 *   /pecp*                                → /maelenglish/coaching
 *   anything else (/instructor, /admin…)  → /maelenglish + same path
 * The query string is kept. GET/HEAD get a 301; other methods a 308 so a form
 * posted from an old tab is re-sent with the same method and body.
 */
const NEW_BASE = '/maelenglish';

function mapLegacyPath(path) {
  if (path === '/' || path === '' || /^\/(english4all|english4everyone)(\/|$)/.test(path)) return NEW_BASE;
  if (/^\/general-english-boost\/?$/.test(path)) return NEW_BASE + '#programmes';
  if (/^\/general-english-boost(\/|$)/.test(path)) return NEW_BASE + '/cours' + path.slice('/general-english-boost'.length);
  if (/^\/pecp(\/|$)/.test(path)) return NEW_BASE + '/coaching';
  return NEW_BASE + path;
}

function legacyEnglishRedirect(req, res) {
  const q = req.originalUrl.indexOf('?');
  const query = q >= 0 ? req.originalUrl.slice(q) : '';
  const mapped = mapLegacyPath(req.path);
  const hash = mapped.includes('#') ? mapped.slice(mapped.indexOf('#')) : '';
  const target = mapped.replace(/#.*$/, '').replace(/\/+$/, '') || NEW_BASE;
  const status = (req.method === 'GET' || req.method === 'HEAD') ? 301 : 308;
  res.redirect(status, target + query + hash);
}

module.exports = legacyEnglishRedirect;
module.exports.mapLegacyPath = mapLegacyPath;
