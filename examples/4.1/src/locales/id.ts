// #region catalog
// Any part of the default catalog; what it leaves out falls back to it
export default {
  warn: { name: 'peringatan', description: 'Beri peringatan ke anggota', done: '{user} diberi peringatan.' },
  // Indonesian has a single plural form
  warnings: { other: '{user} punya {count} peringatan' },
  types: { color: 'warna hex' },
  // #endregion catalog
  // #region meocord
  // MeoCord's own texts: any of them, and what is left out stays in MeoCord's English
  meocord: {
    usage: { heading: 'Cara pakai: {usage}', notValid: '{label}: "{word}" bukan {type} yang sah' },
    types: { int: 'bilangan bulat' },
    cooldown: { seconds: 'Pelan-pelan: coba lagi dalam {seconds} detik.' },
    fallback: { notFound: 'Perintah tidak ditemukan!' },
  },
  // #endregion meocord
  // #region catalog
}
// #endregion catalog
