/* Browser-only credential generator. Passwords are never sent to any service except account creation. */
(function (root) {
  'use strict';
  const GROUPS = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghjkmnpqrstuvwxyz',
    '23456789',
    '!@#$%*-_?'
  ];
  const LOGIN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
  const CYRILLIC = {
    'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye','ж':'zh',
    'з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l','м':'m',
    'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
    'х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'yu','я':'ya',
    'ы':'y','э':'e','ё':'yo','ъ':''
  };
  const SOURCE = GROUPS.join('');
  function rand(max) {
    if (!Number.isSafeInteger(max) || max < 1 || max > 0xffffffff) throw new Error('Невірний діапазон генератора');
    if (!root.crypto || typeof root.crypto.getRandomValues !== 'function') throw new Error('Потрібне захищене HTTPS-з’єднання для генерації пароля');
    const limit = Math.floor(4294967296 / max) * max;
    const buf = new Uint32Array(1);
    do { root.crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }
  function pick(chars) { return chars[rand(chars.length)]; }
  function generatePassword() {
    const out = GROUPS.map(pick);
    while (out.length < 20) out.push(pick(SOURCE));
    for (let i = out.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [out[i],out[j]] = [out[j],out[i]];
    }
    return out.join('');
  }
  function generateLogin(nickname, existing = []) {
    const base = Array.from(String(nickname || '').normalize('NFKD').toLowerCase())
      .map(char => Object.prototype.hasOwnProperty.call(CYRILLIC, char) ? CYRILLIC[char] : char)
      .join('').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '').slice(0, 28) || 'user';
    const used = new Set(existing.map(x => String(x).toLowerCase()));
    for (let attempt = 0; attempt < 30; attempt++) {
      const suffix = Array.from({length:5}, () => pick(LOGIN_ALPHABET)).join('');
      const username = 'grz_' + base + '_' + suffix;
      if (!used.has(username)) return username;
    }
    throw new Error('Не вдалося згенерувати вільний логін. Повторіть спробу.');
  }
  root.GrizzlyCredentials = Object.freeze({ generateLogin, generatePassword });
})(globalThis);
