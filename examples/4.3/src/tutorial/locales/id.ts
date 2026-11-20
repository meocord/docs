// #region catalog
export default {
  feedback: {
    name: 'masukan',
    description: 'Kirim masukan ke staf',
    modal: { title: 'Kirim masukan', about: 'Tentang apa?', details: 'Ceritakan lebih lanjut' },
    thanks: 'Terima kasih! Staf akan segera membacanya.',
    review: {
      heading: 'Masukan #{id} dari {user}',
      approve: 'Setujui',
      reject: 'Tolak',
      approved: 'Disetujui oleh {user}.',
      rejected: 'Ditolak oleh {user}.',
    },
    verdict: {
      approved: 'Masukanmu “{about}” disetujui. Terima kasih!',
      rejected: 'Masukanmu “{about}” belum bisa diterima kali ini.',
    },
    staffOnly: 'Hanya staf yang bisa meninjau masukan.',
    notFound: 'Masukan itu sudah tidak ada.',
    // #region step:localisation
    chat: {
      filed: 'Tersimpan sebagai masukan #{id}. Terima kasih!',
      status: {
        open: 'Masukan #{id} masih terbuka.',
        approved: 'Masukan #{id} disetujui.',
        rejected: 'Masukan #{id} ditolak.',
      },
      unknown: 'Tidak ada masukan #{id}.',
    },
    welcome: 'Terima kasih sudah menambahkanku! Pakai /{command}, atau sebut aku: {example}',
    // #endregion step:localisation
  },
  presenter: { loading: 'Sedang diproses…', failed: 'Terjadi kesalahan' },
}
// #endregion catalog
