// Veli hesapları: her öğrenci hesabına, aynı parolayla, "veli_<öğrenci kullanıcı adı>" adlı
// bir veli hesabı bağlanır. Saf fonksiyonlar: veritabanına bağımlılığı yoktur ve test edilebilir.

const PARENT_PREFIX = 'veli_';
const MAX_USERNAME = 32;
const USERNAME = /^[a-z0-9._-]{3,32}$/;

// "ali" → "veli_ali"
function parentUsernameFor(studentUsername) {
  return `${PARENT_PREFIX}${studentUsername}`;
}

// Veli kullanıcı adı geçerli ve 32 karakteri aşmıyorsa öğrenciye veli bağlanabilir
function canHaveGuardian(studentUsername) {
  const parent = parentUsernameFor(studentUsername);
  return USERNAME.test(studentUsername) && parent.length <= MAX_USERNAME;
}

// Velinin görünen adı: "Ali Yılmaz" → "Ali Yılmaz (veli)"
function guardianNameFor(studentName) {
  return `${studentName} (veli)`;
}

// Bir kullanıcı adının, verilen öğrencinin velisi olup olmadığını söyler
function isGuardianOf(parentUsername, studentUsername) {
  return parentUsername === parentUsernameFor(studentUsername);
}

module.exports = { PARENT_PREFIX, MAX_USERNAME, parentUsernameFor, canHaveGuardian, guardianNameFor, isGuardianOf };
