/* ===== DompetKu – app.js (fixed) ===== */
'use strict';

// ── Konstanta ─────────────────────────────────────────────────────────────────
const KATEGORI_COLOR = {
  'Makan & Minum': '#22c55e',
  'Transport':     '#3b82f6',
  'Belanja':       '#f59e0b',
  'Tagihan':       '#ef4444',
  'Hiburan':       '#a855f7',
  'Kesehatan':     '#ec4899',
  'Pendidikan':    '#06b6d4',
  'Tabungan':      '#14b8a6',
  'Lainnya':       '#94a3b8',
};

const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli',
                  'Agustus','September','Oktober','November','Desember'];

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  bulan: new Date().getMonth(),
  tahun: new Date().getFullYear(),
  gajiMap: {},
  pengeluaranMap: {},
  darkMode: false,
  filterKategori: 'semua',
  editId: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const kunci      = () => `${state.tahun}-${state.bulan}`;
const gaji       = () => state.gajiMap[kunci()] || 0;
const items      = () => state.pengeluaranMap[kunci()] || [];
const totalKeluar= () => items().reduce((s, x) => s + Number(x.jumlah), 0);
const uid        = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

function fmt(n) {
  if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + ' jt';
  return 'Rp ' + n.toLocaleString('id-ID');
}
function fmtFull(n) { return 'Rp ' + n.toLocaleString('id-ID'); }
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Number Formatting (tanpa side-effect ke state/render) ────────────────────
function toRaw(str) {
  if (!str) return 0;
  return parseInt(String(str).replace(/\./g, '').replace(/\D/g, ''), 10) || 0;
}
function toFormatted(n) {
  if (!n) return '';
  return Number(n).toLocaleString('id-ID');
}

// Flag agar renderSummary tidak trigger formatter
let _settingGaji = false;

function setGajiInput(val) {
  _settingGaji = true;
  document.getElementById('input-gaji').value = val > 0 ? toFormatted(val) : '';
  _settingGaji = false;
}

// Pasang formatter angka ke sebuah input (hanya input event, tidak keydown)
function attachFormatter(el) {
  el.addEventListener('input', function() {
    if (_settingGaji && el.id === 'input-gaji') return;
    const raw = toRaw(this.value);
    // Simpan posisi kursor
    const start = this.selectionStart;
    const oldLen = this.value.length;
    this.value = raw > 0 ? toFormatted(raw) : '';
    const newLen = this.value.length;
    // Sesuaikan kursor
    const pos = Math.max(0, start + (newLen - oldLen));
    try { this.setSelectionRange(pos, pos); } catch(_) {}
  });
}

// Blokir input non-angka via keydown (pisah dari formatter)
function attachNumericOnly(el) {
  el.addEventListener('keydown', function(e) {
    // Izinkan: kontrol, angka
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const passthrough = ['Backspace','Delete','ArrowLeft','ArrowRight',
                         'ArrowUp','ArrowDown','Tab','Home','End','Enter'];
    if (passthrough.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  });
}

// Sinkronisasi gaji dari input ke state (dipanggil sebelum render)
function syncGaji() {
  const v = toRaw(document.getElementById('input-gaji').value);
  if (v > 0 && v !== state.gajiMap[kunci()]) {
    state.gajiMap[kunci()] = Number(v);
    save();
  }
}


function save() {
  localStorage.setItem('dk_state', JSON.stringify({
    gajiMap: state.gajiMap,
    pengeluaranMap: state.pengeluaranMap,
    darkMode: state.darkMode,
  }));
}

function load() {
  try {
    const raw = localStorage.getItem('dk_state');
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.gajiMap        = saved.gajiMap        || {};
    state.pengeluaranMap = saved.pengeluaranMap || {};
    state.darkMode       = saved.darkMode       || false;
  } catch(_) {}
}

// ── Dark Mode ─────────────────────────────────────────────────────────────────
function applyDark() {
  document.documentElement.classList.toggle('dark', state.darkMode);
  document.getElementById('icon-dark').textContent = state.darkMode ? '☀️' : '🌙';
}

// ── Chart ─────────────────────────────────────────────────────────────────────
let pieChart = null;

function renderChart() {
  const canvas = document.getElementById('pieChart');
  const ctx    = canvas.getContext('2d');
  const data   = items();
  const emptyEl = document.getElementById('chart-empty');
  const container = document.getElementById('chartContainer');

  if (data.length === 0) {
    emptyEl.classList.remove('hidden');
    container.style.opacity = '0.2';
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    return;
  }

  emptyEl.classList.add('hidden');
  container.style.opacity = '1';

  // Kelompokkan per kategori
  const grouped = {};
  data.forEach(x => { grouped[x.kategori] = (grouped[x.kategori] || 0) + x.jumlah; });
  const labels = Object.keys(grouped);
  const values = Object.values(grouped);
  const colors = labels.map(l => KATEGORI_COLOR[l] || '#94a3b8');
  const isDark = state.darkMode;

  if (pieChart) { pieChart.destroy(); pieChart = null; }
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: isDark ? '#1e2530' : '#ffffff',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: isDark ? '#d1d5db' : '#4b5563',
            font: { family: 'DM Sans', size: 11 },
            boxWidth: 12, padding: 10, usePointStyle: true,
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const tot = ctx.dataset.data.reduce((a,b)=>a+b,0);
              const pct = ((ctx.parsed / tot) * 100).toFixed(1);
              return `  ${fmtFull(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ── Filter Chips ──────────────────────────────────────────────────────────────
function renderFilterChips() {
  const container = document.getElementById('filter-chips');
  const kategoriSet = new Set(items().map(x => x.kategori));

  container.innerHTML = '';

  // Tombol "Semua"
  const allBtn = document.createElement('button');
  allBtn.dataset.filter = 'semua';
  allBtn.className = `filter-chip shrink-0 h-8 px-4 rounded-full text-xs font-semibold ${
    state.filterKategori === 'semua' ? 'bg-hijau-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
  }`;
  allBtn.textContent = 'Semua';
  container.appendChild(allBtn);

  // Tombol per kategori
  kategoriSet.forEach(k => {
    const active = state.filterKategori === k;
    const btn = document.createElement('button');
    btn.dataset.filter = k;
    btn.className = `filter-chip shrink-0 h-8 px-4 rounded-full text-xs font-semibold ${
      active ? 'text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
    }`;
    if (active) btn.style.backgroundColor = KATEGORI_COLOR[k] || '#16a34a';
    btn.textContent = k;
    container.appendChild(btn);
  });

  // Event — pakai event delegation di container (tidak re-attach terus)
  container.onclick = (e) => {
    const btn = e.target.closest('.filter-chip');
    if (!btn) return;
    state.filterKategori = btn.dataset.filter;
    renderFilterChips();
    renderList();
  };
}

// ── List Pengeluaran ──────────────────────────────────────────────────────────
function renderList() {
  const container     = document.getElementById('list-pengeluaran');
  const emptyEl       = document.getElementById('empty-state');
  const btnHapusSemua = document.getElementById('btn-hapus-semua');
  const totalK        = totalKeluar();
  const g             = gaji();

  let data = [...items()];
  if (state.filterKategori !== 'semua') {
    data = data.filter(x => x.kategori === state.filterKategori);
  }
  data.sort((a, b) => b.ts - a.ts);

  // Selalu bersihkan container dulu (emptyEl sudah di luar, aman)
  container.innerHTML = '';

  if (data.length === 0) {
    emptyEl.classList.remove('hidden');
    btnHapusSemua.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  btnHapusSemua.classList.remove('hidden');

  data.forEach((item, i) => {
    const pctGaji  = g > 0      ? ((item.jumlah / g)      * 100).toFixed(1) : 0;
    const pctTotal = totalK > 0  ? ((item.jumlah / totalK) * 100).toFixed(1) : 0;
    const color    = KATEGORI_COLOR[item.kategori] || '#94a3b8';

    const div = document.createElement('div');
    div.className = 'item-card animate-in rounded-2xl border border-gray-100 dark:border-gray-700 p-4 bg-white dark:bg-gray-800';
    div.style.animationDelay = `${i * 30}ms`;
    div.dataset.id = item.id;
    div.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-semibold mb-1"
                style="background:${color}">${escHtml(item.kategori)}</span>
          <p class="font-semibold text-base text-gray-800 dark:text-white truncate">${escHtml(item.nama)}</p>
          <p class="text-hijau-600 dark:text-hijau-400 font-bold mt-0.5">${fmtFull(item.jumlah)}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-xs text-gray-400 mb-2">${pctGaji}% gaji</p>
          <div class="flex gap-2">
            <button data-action="edit" class="btn-edit w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button data-action="hapus" class="btn-hapus w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/40 text-red-400 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div class="h-full bar-fill rounded-full" style="width:${pctTotal}%;background:${color}"></div>
      </div>
      <p class="text-xs text-gray-400 mt-1">${pctTotal}% dari total pengeluaran</p>
    `;
    container.appendChild(div);
  });

  // Event delegation — pakai data-action untuk deteksi tombol
  container.onclick = (e) => {
    const btn  = e.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('.item-card');
    if (!card) return;
    const id   = card.dataset.id;
    if (btn.dataset.action === 'hapus') hapusItem(id);
    else if (btn.dataset.action === 'edit') bukaModal(id);
  };
}

// ── Ringkasan ─────────────────────────────────────────────────────────────────
function renderSummary() {
  syncGaji();
  const g      = gaji();
  const keluar = totalKeluar();
  const sisa   = g - keluar;
  const pct    = g > 0 ? Math.min((keluar / g) * 100, 100) : 0;

  document.getElementById('total-keluar').textContent = fmt(keluar);

  const sisaEl = document.getElementById('total-sisa');
  sisaEl.textContent = fmt(Math.abs(sisa));
  sisaEl.className = `font-display font-bold text-base ${sisa >= 0 ? 'text-hijau-600 dark:text-hijau-400' : 'text-red-500'}`;



  // Hanya update input gaji saat halaman pertama load (jika input kosong)
  const gajiInput = document.getElementById('input-gaji');
  if (!gajiInput.dataset.userEditing && g > 0 && !gajiInput.value) {
    setGajiInput(g);
  }

  // Status
  const statusEl = document.getElementById('status-label');
  if      (g === 0)    { statusEl.textContent = '–';         statusEl.className = 'font-display font-bold text-base text-gray-400'; }
  else if (sisa > 0)   { statusEl.textContent = '✅ Sisa';   statusEl.className = 'font-display font-bold text-base text-hijau-600 dark:text-hijau-400'; }
  else if (sisa === 0) { statusEl.textContent = '⚖️ Pas';    statusEl.className = 'font-display font-bold text-base text-amber-500'; }
  else                 { statusEl.textContent = '🚨 Kurang'; statusEl.className = 'font-display font-bold text-base text-red-500'; }

  // Progress bar
  const bar = document.getElementById('progress-bar');
  bar.style.width = pct + '%';
  bar.className = `h-full bar-fill rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-hijau-500'}`;

  const pctEl = document.getElementById('pct-label');
  pctEl.textContent = pct.toFixed(0) + '%';
  pctEl.className = `text-sm font-bold ${pct >= 100 ? 'text-red-500' : pct >= 75 ? 'text-amber-500' : 'text-hijau-600 dark:text-hijau-400'}`;
}

// ── Render All ────────────────────────────────────────────────────────────────
function renderAll() {
  renderSummary();
  renderFilterChips();
  renderList();
  renderChart();
}

// ── Actions ───────────────────────────────────────────────────────────────────
function tambahItem() {
  const namaEl     = document.getElementById('form-nama');
  const jumlahEl   = document.getElementById('form-jumlah');
  const kategoriEl = document.getElementById('form-kategori');

  // Pastikan gaji tersinkron dari input sebelum render
  syncGaji();

  const nama    = namaEl.value.trim();
  const jumlah  = toRaw(jumlahEl.value);
  const kategori= kategoriEl.value || 'Lainnya';

  if (!nama)       { showToast('⚠️ Nama pengeluaran kosong!');    return; }
  if (jumlah <= 0) { showToast('⚠️ Jumlah harus lebih dari 0!'); return; }

  const k = kunci();
  if (!state.pengeluaranMap[k]) state.pengeluaranMap[k] = [];
  state.pengeluaranMap[k].push({ id: uid(), nama, jumlah: Number(jumlah), kategori, ts: Date.now() });

  // Reset form
  namaEl.value     = '';
  jumlahEl.value   = '';
  kategoriEl.value = '';

  state.filterKategori = 'semua';
  save();
  renderAll();
  showToast('✅ Pengeluaran ditambahkan!');
}

function hapusItem(id) {
  const k = kunci();
  state.pengeluaranMap[k] = (state.pengeluaranMap[k] || []).filter(x => x.id !== id);
  save();
  renderAll();
  showToast('🗑️ Dihapus');
}

function hapusSemua() {
  if (!confirm('Hapus semua pengeluaran bulan ini?')) return;
  state.pengeluaranMap[kunci()] = [];
  state.filterKategori = 'semua';
  save();
  renderAll();
  showToast('🗑️ Semua pengeluaran dihapus');
}

// ── Modal Edit ────────────────────────────────────────────────────────────────
function bukaModal(id) {
  const item = items().find(x => x.id === id);
  if (!item) return;
  state.editId = id;
  document.getElementById('edit-nama').value     = item.nama;
  document.getElementById('edit-jumlah').value   = toFormatted(item.jumlah);
  document.getElementById('edit-kategori').value = item.kategori;
  document.getElementById('modal-backdrop').classList.remove('hidden');
  setTimeout(() => document.getElementById('edit-nama').focus(), 50);
}

function tutupModal() {
  state.editId = null;
  document.getElementById('modal-backdrop').classList.add('hidden');
}

function simpanEdit() {
  const nama    = document.getElementById('edit-nama').value.trim();
  const jumlah  = toRaw(document.getElementById('edit-jumlah').value);
  const kategori= document.getElementById('edit-kategori').value || 'Lainnya';

  if (!nama)       { showToast('⚠️ Nama tidak boleh kosong!');    return; }
  if (jumlah <= 0) { showToast('⚠️ Jumlah harus lebih dari 0!'); return; }

  const k   = kunci();
  const idx = (state.pengeluaranMap[k] || []).findIndex(x => x.id === state.editId);
  if (idx !== -1) {
    state.pengeluaranMap[k][idx] = {
      ...state.pengeluaranMap[k][idx], nama, jumlah: Number(jumlah), kategori
    };
  }

  save();
  tutupModal();
  renderAll();
  showToast('✅ Berhasil diperbarui!');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  load();
  applyDark();
  renderAll();

  const gajiInput = document.getElementById('input-gaji');

  // Set nilai awal dari localStorage
  if (gaji() > 0) setGajiInput(gaji());

  // Tandai saat user sedang edit (agar renderSummary tidak overwrite)
  gajiInput.addEventListener('focus', () => { gajiInput.dataset.userEditing = '1'; });
  gajiInput.addEventListener('blur',  () => { delete gajiInput.dataset.userEditing; });

  // Formatter & blokir non-angka
  attachFormatter(gajiInput);
  attachFormatter(document.getElementById('form-jumlah'));
  attachFormatter(document.getElementById('edit-jumlah'));
  attachNumericOnly(gajiInput);
  attachNumericOnly(document.getElementById('form-jumlah'));
  attachNumericOnly(document.getElementById('edit-jumlah'));

  // Gaji – simpan saat klik tombol atau blur
  const simpanGaji = () => {
    const v = toRaw(gajiInput.value);
    state.gajiMap[kunci()] = Number(v);
    save();
    renderSummary();
    renderChart();
    showToast('💰 Gaji disimpan!');
  };
  document.getElementById('btn-simpan-gaji').addEventListener('click', simpanGaji);
  gajiInput.addEventListener('blur', simpanGaji);
  gajiInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { simpanGaji(); gajiInput.blur(); }
  });

  // Tambah pengeluaran
  document.getElementById('btn-tambah').addEventListener('click', tambahItem);
  document.getElementById('form-nama').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('form-jumlah').focus();
  });
  document.getElementById('form-jumlah').addEventListener('keydown', e => {
    if (e.key === 'Enter') tambahItem();
  });

  // Hapus semua
  document.getElementById('btn-hapus-semua').addEventListener('click', hapusSemua);

  // Dark mode
  document.getElementById('btn-dark').addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    applyDark();
    save();
    setTimeout(renderChart, 50);
  });

  // FAB
  document.getElementById('fab').addEventListener('click', () => {
    document.getElementById('form-nama').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => document.getElementById('form-nama').focus(), 400);
  });

  // Modal
  document.getElementById('modal-close').addEventListener('click', tutupModal);
  document.getElementById('modal-backdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-backdrop')) tutupModal();
  });
  document.getElementById('btn-simpan-edit').addEventListener('click', simpanEdit);

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});