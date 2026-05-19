/* ===== DompetKu – app.js ===== */
'use strict';

// ── Konstanta warna kategori ──────────────────────────────────────────────────
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

const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  bulan: new Date().getMonth(),
  tahun: new Date().getFullYear(),
  gajiMap: {},      // { "2025-5": 5000000 }
  pengeluaranMap: {}, // { "2025-5": [{id, nama, jumlah, kategori, ts}] }
  darkMode: false,
  filterKategori: 'semua',
  editId: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const kunci = () => `${state.tahun}-${state.bulan}`;
const gaji  = () => state.gajiMap[kunci()] || 0;
const items = () => state.pengeluaranMap[kunci()] || [];
const totalKeluar = () => items().reduce((s, x) => s + x.jumlah, 0);

function fmt(n) {
  if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + ' jt';
  return 'Rp ' + n.toLocaleString('id-ID');
}
function fmtFull(n) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── Persistence ───────────────────────────────────────────────────────────────
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
    state.gajiMap = saved.gajiMap || {};
    state.pengeluaranMap = saved.pengeluaranMap || {};
    state.darkMode = saved.darkMode || false;
  } catch {}
}

// ── Dark Mode ─────────────────────────────────────────────────────────────────
function applyDark() {
  document.documentElement.classList.toggle('dark', state.darkMode);
  document.getElementById('icon-dark').textContent = state.darkMode ? '☀️' : '🌙';
}

// ── Chart ─────────────────────────────────────────────────────────────────────
let pieChart = null;

function renderChart() {
  const ctx = document.getElementById('pieChart').getContext('2d');
  const data = items();
  const empty = document.getElementById('chart-empty');

  if (data.length === 0) {
    empty.classList.remove('hidden');
    document.getElementById('chartContainer').style.opacity = '0.2';
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    return;
  }

  empty.classList.add('hidden');
  document.getElementById('chartContainer').style.opacity = '1';

  // Group by kategori
  const grouped = {};
  data.forEach(x => {
    grouped[x.kategori] = (grouped[x.kategori] || 0) + x.jumlah;
  });

  const labels = Object.keys(grouped);
  const values = Object.values(grouped);
  const colors = labels.map(l => KATEGORI_COLOR[l] || '#94a3b8');

  const isDark = state.darkMode;

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 2,
        borderColor: isDark ? '#1e2530' : '#ffffff', hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
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
              const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return `  ${fmtFull(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ── Filter chips ──────────────────────────────────────────────────────────────
function renderFilterChips() {
  const container = document.getElementById('filter-chips');
  const data = items();
  const kategoriSet = new Set(data.map(x => x.kategori));

  // Clear, keep "Semua"
  container.innerHTML = `<button data-filter="semua" class="filter-chip shrink-0 h-8 px-4 rounded-full text-xs font-semibold ${state.filterKategori === 'semua' ? 'bg-hijau-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}">Semua</button>`;

  kategoriSet.forEach(k => {
    const active = state.filterKategori === k;
    const btn = document.createElement('button');
    btn.dataset.filter = k;
    btn.className = `filter-chip shrink-0 h-8 px-4 rounded-full text-xs font-semibold ${active ? 'text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`;
    if (active) btn.style.backgroundColor = KATEGORI_COLOR[k] || '#16a34a';
    btn.textContent = k;
    container.appendChild(btn);
  });

  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filterKategori = btn.dataset.filter;
      renderFilterChips();
      renderList();
    });
  });
}

// ── List pengeluaran ──────────────────────────────────────────────────────────
function renderList() {
  const container = document.getElementById('list-pengeluaran');
  const emptyEl = document.getElementById('empty-state');
  const btnHapusSemua = document.getElementById('btn-hapus-semua');
  const total = totalKeluar();
  const g = gaji();

  let data = items();
  if (state.filterKategori !== 'semua') {
    data = data.filter(x => x.kategori === state.filterKategori);
  }

  // Sort terbaru dulu
  data = [...data].sort((a,b) => b.ts - a.ts);

  if (data.length === 0) {
    emptyEl.classList.remove('hidden');
    btnHapusSemua.classList.add('hidden');
    container.querySelectorAll('.item-card').forEach(el => el.remove());
    return;
  }

  emptyEl.classList.add('hidden');
  btnHapusSemua.classList.remove('hidden');

  // Build HTML
  container.innerHTML = '';
  data.forEach((item, i) => {
    const pct = g > 0 ? ((item.jumlah / g) * 100).toFixed(1) : 0;
    const barPct = total > 0 ? ((item.jumlah / total) * 100).toFixed(1) : 0;
    const color = KATEGORI_COLOR[item.kategori] || '#94a3b8';

    const div = document.createElement('div');
    div.className = 'item-card animate-in rounded-2xl border border-gray-100 dark:border-gray-700 p-4 bg-white dark:bg-gray-800';
    div.style.animationDelay = `${i * 30}ms`;
    div.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="chip text-white text-xs" style="background:${color}">${item.kategori}</span>
          </div>
          <p class="font-semibold text-base text-gray-800 dark:text-white truncate">${escHtml(item.nama)}</p>
          <p class="text-hijau-600 dark:text-hijau-400 font-bold mt-0.5">${fmtFull(item.jumlah)}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-xs text-gray-400 mb-2">${pct}% gaji</p>
          <div class="flex gap-2">
            <button class="btn-edit w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-500 flex items-center justify-center" data-id="${item.id}">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button class="btn-hapus w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/40 text-red-400 flex items-center justify-center" data-id="${item.id}">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div class="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div class="h-full bar-fill rounded-full" style="width:${barPct}%;background:${color}"></div>
      </div>
      <p class="text-xs text-gray-400 mt-1">${barPct}% dari total pengeluaran</p>
    `;
    container.appendChild(div);
  });

  // Events
  container.querySelectorAll('.btn-hapus').forEach(btn => {
    btn.addEventListener('click', () => hapusItem(btn.dataset.id));
  });
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => bukaModal(btn.dataset.id));
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Ringkasan ─────────────────────────────────────────────────────────────────
function renderSummary() {
  const g = gaji();
  const keluar = totalKeluar();
  const sisa = g - keluar;
  const pct = g > 0 ? Math.min((keluar / g) * 100, 100) : 0;

  document.getElementById('total-keluar').textContent = fmt(keluar);
  document.getElementById('total-sisa').textContent = fmt(Math.abs(sisa));
  document.getElementById('total-sisa').className = `font-display font-bold text-base ${sisa >= 0 ? 'text-hijau-600 dark:text-hijau-400' : 'text-red-500'}`;
  document.getElementById('bar-max').textContent = fmt(g);
  document.getElementById('input-gaji').value = g > 0 ? g : '';

  // Status
  const statusEl = document.getElementById('status-label');
  if (g === 0) { statusEl.textContent = '–'; statusEl.className = 'font-display font-bold text-base text-gray-400'; }
  else if (sisa > 0) { statusEl.textContent = '✅ Sisa'; statusEl.className = 'font-display font-bold text-base text-hijau-600 dark:text-hijau-400'; }
  else if (sisa === 0) { statusEl.textContent = '⚖️ Pas'; statusEl.className = 'font-display font-bold text-base text-amber-500'; }
  else { statusEl.textContent = '🚨 Kurang'; statusEl.className = 'font-display font-bold text-base text-red-500'; }

  // Progress bar
  const bar = document.getElementById('progress-bar');
  bar.style.width = pct + '%';
  bar.className = `h-full bar-fill rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-hijau-500'}`;
  document.getElementById('pct-label').textContent = pct.toFixed(0) + '%';
  document.getElementById('pct-label').className = `text-sm font-bold ${pct >= 100 ? 'text-red-500' : pct >= 75 ? 'text-amber-500' : 'text-hijau-600 dark:text-hijau-400'}`;
}

// ── Header bulan ──────────────────────────────────────────────────────────────
function renderHeader() {
  document.getElementById('label-bulan').textContent = `${BULAN_ID[state.bulan]} ${state.tahun}`;
}

// ── Render all ────────────────────────────────────────────────────────────────
function renderAll() {
  renderHeader();
  renderSummary();
  renderFilterChips();
  renderList();
  renderChart();
}

// ── Actions ───────────────────────────────────────────────────────────────────
function tambahItem() {
  const nama = document.getElementById('form-nama').value.trim();
  const jumlah = parseInt(document.getElementById('form-jumlah').value) || 0;
  const kategori = document.getElementById('form-kategori').value || 'Lainnya';

  if (!nama) { showToast('⚠️ Nama pengeluaran kosong!'); return; }
  if (jumlah <= 0) { showToast('⚠️ Jumlah harus lebih dari 0!'); return; }

  const k = kunci();
  if (!state.pengeluaranMap[k]) state.pengeluaranMap[k] = [];
  state.pengeluaranMap[k].push({ id: uid(), nama, jumlah, kategori, ts: Date.now() });

  // Reset form
  document.getElementById('form-nama').value = '';
  document.getElementById('form-jumlah').value = '';
  document.getElementById('form-kategori').value = '';

  save();
  state.filterKategori = 'semua';
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
  save();
  state.filterKategori = 'semua';
  renderAll();
  showToast('🗑️ Semua pengeluaran dihapus');
}

// ── Modal Edit ────────────────────────────────────────────────────────────────
function bukaModal(id) {
  const item = items().find(x => x.id === id);
  if (!item) return;
  state.editId = id;
  document.getElementById('edit-nama').value = item.nama;
  document.getElementById('edit-jumlah').value = item.jumlah;
  document.getElementById('edit-kategori').value = item.kategori;
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('edit-nama').focus();
}

function tutupModal() {
  state.editId = null;
  document.getElementById('modal-backdrop').classList.add('hidden');
}

function simpanEdit() {
  const nama = document.getElementById('edit-nama').value.trim();
  const jumlah = parseInt(document.getElementById('edit-jumlah').value) || 0;
  const kategori = document.getElementById('edit-kategori').value || 'Lainnya';

  if (!nama || jumlah <= 0) { showToast('⚠️ Data tidak lengkap!'); return; }

  const k = kunci();
  const idx = (state.pengeluaranMap[k] || []).findIndex(x => x.id === state.editId);
  if (idx !== -1) {
    state.pengeluaranMap[k][idx] = { ...state.pengeluaranMap[k][idx], nama, jumlah, kategori };
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

// ── Event Listeners ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  load();
  applyDark();
  renderAll();

  // Gaji
  document.getElementById('btn-simpan-gaji').addEventListener('click', () => {
    const v = parseInt(document.getElementById('input-gaji').value) || 0;
    state.gajiMap[kunci()] = v;
    save();
    renderSummary();
    renderChart();
    showToast('💰 Gaji disimpan!');
  });
  document.getElementById('input-gaji').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-simpan-gaji').click();
  });

  // Tambah pengeluaran
  document.getElementById('btn-tambah').addEventListener('click', tambahItem);
  document.getElementById('form-jumlah').addEventListener('keydown', e => {
    if (e.key === 'Enter') tambahItem();
  });

  // Hapus semua
  document.getElementById('btn-hapus-semua').addEventListener('click', hapusSemua);

  // Navigasi bulan
  document.getElementById('btn-prev-month').addEventListener('click', () => {
    if (state.bulan === 0) { state.bulan = 11; state.tahun--; }
    else state.bulan--;
    state.filterKategori = 'semua';
    renderAll();
  });
  document.getElementById('btn-next-month').addEventListener('click', () => {
    if (state.bulan === 11) { state.bulan = 0; state.tahun++; }
    else state.bulan++;
    state.filterKategori = 'semua';
    renderAll();
  });

  // Dark mode
  document.getElementById('btn-dark').addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    applyDark();
    save();
    // Rerender chart with new colors
    setTimeout(renderChart, 50);
  });

  // FAB scroll & tambah
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
