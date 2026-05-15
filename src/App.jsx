import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Trash2, Edit3, Search, ChevronDown, ChevronRight, Filter, ArrowUpDown, Layers, Grid3x3, Download, Upload, Mic, Star, Users, BookOpen } from 'lucide-react';
import { supabase } from './supabase';
import { SEED_DATA } from './data/animeData';
import { VA_SEED_DATA } from './data/vaData';

const RED = '#E63946';
const YELLOW = '#F4D35E';
const BLUE_BRIGHT = '#3A86FF';
const BG = '#0a0a0a';
const FG = '#f5f1e8';
const STORAGE_KEY = 'anime-archive-v3';

export default function AnimeArchive() {
  // ── Anime state ──
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', rating: 0, review: '', series: '' });
  const [saveStatus, setSaveStatus] = useState('');
  const [lastBackup, setLastBackup] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(0);

  // ── VA state ──
  const [vaList, setVaList] = useState([]);
  const [vaLoading, setVaLoading] = useState(true);
  const [showVaForm, setShowVaForm] = useState(false);
  const [editingVaId, setEditingVaId] = useState(null);
  const [vaForm, setVaForm] = useState({ name: '', gender: 'f', note: '', roles: [] });
  const [vaUnsaved, setVaUnsaved] = useState(0);
  const [selectedVa, setSelectedVa] = useState(null);
  const [vaSearch, setVaSearch] = useState('');
  const [vaSaveStatus, setVaSaveStatus] = useState('');

  // ── UI state ──
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [filterMode, setFilterMode] = useState('all');
  const [groupMode, setGroupMode] = useState('series');
  const [expandedSeries, setExpandedSeries] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState('anime');

  // ── Init ──
  useEffect(() => {
    loadEntries();
    loadVA();
    const handleMouse = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouse);
    try {
      const last = localStorage.getItem('anime-archive-last-backup');
      if (last) setLastBackup(new Date(last));
    } catch (e) {}
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  // ── Load entries ──
  const loadEntries = async () => {
    try {
      const { data, error } = await supabase.from('entries').select('*').order('id', { ascending: false });
      if (!error && data && data.length > 0) {
        setEntries(data); setLoading(false); return;
      }
    } catch (e) {}
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEntries(parsed); setLoading(false); return;
        }
      }
    } catch (e) {}
    const seeded = SEED_DATA.map((e, i) => ({ id: Date.now() + i, ...e }));
    setEntries(seeded);
    setLoading(false);
  };

  const saveEntries = async (newEntries) => {
    setSaveStatus('saving');
    try {
      const { error } = await supabase.from('entries').upsert(
        newEntries.map(e => ({
          id: e.id, title: e.title, rating: e.rating,
          review: e.review || '', series: e.series || '',
          season: e.season || '', date: e.date || ''
        }))
      );
      if (!error) {
        const { data: existing } = await supabase.from('entries').select('id');
        if (existing) {
          const newIds = new Set(newEntries.map(e => e.id));
          const toDelete = existing.filter(e => !newIds.has(e.id)).map(e => e.id);
          if (toDelete.length > 0) await supabase.from('entries').delete().in('id', toDelete);
        }
        setSaveStatus('saved'); setUnsavedChanges(0);
        setTimeout(() => setSaveStatus(''), 2000);
        return true;
      }
    } catch (e) {}
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries)); } catch (e) {}
    setSaveStatus('saved'); setUnsavedChanges(p => p + 1);
    setTimeout(() => setSaveStatus(''), 2000);
    return true;
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    const seriesName = form.series.trim() || form.title.trim();
    let newEntries;
    if (editingId !== null) {
      newEntries = entries.map(e => e.id === editingId ? { ...e, ...form, series: seriesName } : e);
    } else {
      newEntries = [{ id: Date.now(), ...form, series: seriesName, date: new Date().toISOString().split('T')[0], season: '' }, ...entries];
    }
    setEntries(newEntries);
    const ok = await saveEntries(newEntries);
    if (!ok) { alert('⚠️ 儲存失敗！請先複製備份。'); return; }
    setForm({ title: '', rating: 0, review: '', series: '' });
    setShowForm(false); setEditingId(null);
  };

  const handleEdit = (entry) => {
    setForm({ title: entry.title, rating: entry.rating, review: entry.review, series: entry.series || '' });
    setEditingId(entry.id); setShowForm(true);
  };

  const handleDelete = async (id) => {
    const newEntries = entries.filter(e => e.id !== id);
    setEntries(newEntries); await saveEntries(newEntries);
  };

  // ── Load VA ──
  const loadVA = async () => {
    try {
      const { data, error } = await supabase.from('voice_actors').select('*');
      if (!error && data && data.length > 0) {
        setVaList(data); setVaLoading(false); return;
      }
    } catch (e) {}
    const seeded = VA_SEED_DATA;
    setVaList(seeded);
    try {
      await supabase.from('voice_actors').upsert(seeded.map(v => ({
        id: v.id, name: v.name, gender: v.gender,
        note: v.note || '', roles: v.roles || []
      })));
    } catch (e) {}
    setVaLoading(false);
  };

  const saveVA = async (newList) => {
    setVaSaveStatus('saving');
    try {
      const { error } = await supabase.from('voice_actors').upsert(
        newList.map(v => ({
          id: v.id, name: v.name, gender: v.gender,
          note: v.note || '', roles: v.roles || []
        }))
      );
      if (!error) {
        const { data: existing } = await supabase.from('voice_actors').select('id');
        if (existing) {
          const newIds = new Set(newList.map(v => v.id));
          const toDelete = existing.filter(v => !newIds.has(v.id)).map(v => v.id);
          if (toDelete.length > 0) await supabase.from('voice_actors').delete().in('id', toDelete);
        }
        setVaSaveStatus('saved'); setVaUnsaved(0);
        setTimeout(() => setVaSaveStatus(''), 2000);
        return true;
      }
    } catch (e) {}
    setVaSaveStatus('error');
    return false;
  };

  const handleVaSubmit = async () => {
    if (!vaForm.name.trim()) return;
    let newList;
    if (editingVaId !== null) {
      newList = vaList.map(v => v.id === editingVaId ? { ...v, ...vaForm } : v);
    } else {
      newList = [...vaList, { id: `va_${Date.now()}`, ...vaForm }];
    }
    setVaList(newList);
    await saveVA(newList);
    setVaForm({ name: '', gender: 'f', note: '', roles: [] });
    setShowVaForm(false); setEditingVaId(null);
  };

  const handleVaEdit = (va) => {
    setVaForm({ name: va.name, gender: va.gender, note: va.note || '', roles: va.roles || [] });
    setEditingVaId(va.id); setShowVaForm(true);
  };

  const handleVaDelete = async (id) => {
    if (!window.confirm('確定刪除這位聲優？')) return;
    const newList = vaList.filter(v => v.id !== id);
    setVaList(newList); await saveVA(newList);
  };

  // ── Export / Import ──
  const handleExport = () => {
    const data = { exportDate: new Date().toISOString(), version: 'v4', count: entries.length, entries };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `anime-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setLastBackup(new Date()); setUnsavedChanges(0);
    try { localStorage.setItem('anime-archive-last-backup', new Date().toISOString()); } catch (e) {}
  };

  const handleExportVA = () => {
    const blob = new Blob([JSON.stringify(vaList, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `va-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url); setVaUnsaved(0);
  };

  const handleCopyToClipboard = async () => {
    const data = { exportDate: new Date().toISOString(), version: 'v4', count: entries.length, entries };
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      alert(`✅ 已複製 ${entries.length} 筆紀錄到剪貼簿\n請貼到備忘錄保存！`);
      setLastBackup(new Date()); setUnsavedChanges(0);
      try { localStorage.setItem('anime-archive-last-backup', new Date().toISOString()); } catch (e) {}
    } catch { alert('複製失敗，請用「下載 JSON」'); }
  };

  const handlePasteImport = () => {
    const text = window.prompt('請貼上備份 JSON 文字：');
    if (!text) return;
    try {
      const data = JSON.parse(text);
      const imp = data.entries || data;
      if (!Array.isArray(imp)) { alert('格式錯誤'); return; }
      if (!window.confirm(`匯入 ${imp.length} 筆，覆蓋現有 ${entries.length} 筆？`)) return;
      setEntries(imp); saveEntries(imp);
      alert(`✅ 匯入成功！${imp.length} 筆`);
    } catch (err) { alert('解析失敗：' + err.message); }
  };

  const handleImport = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const imp = data.entries || data;
        if (!Array.isArray(imp)) { alert('格式錯誤'); return; }
        if (!window.confirm(`匯入 ${imp.length} 筆，覆蓋現有 ${entries.length} 筆？`)) return;
        setEntries(imp); await saveEntries(imp);
        alert(`✅ 匯入成功！${imp.length} 筆`);
      } catch (err) { alert('解析失敗：' + err.message); }
    };
    reader.readAsText(file); event.target.value = '';
  };

  // ── VA matching ──
  const getAnimeVAs = (animeTitle) => {
    if (!animeTitle || !vaList.length) return [];
    const title = animeTitle.toLowerCase();
    const matched = [];
    vaList.forEach(va => {
      va.roles?.forEach(role => {
        const anime = (role.anime || '').toLowerCase();
        if (title.includes(anime) || anime.includes(title.split(/[（(]/)[0].trim().toLowerCase())) {
          matched.push({ va: va.name, character: role.character, level: role.level, note: role.note });
        }
      });
    });
    return matched;
  };

  // ── Filter / sort ──
  const processed = useMemo(() => {
    let result = [...entries];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e => e.title.toLowerCase().includes(s) || e.review.toLowerCase().includes(s) || (e.series || '').toLowerCase().includes(s));
    }
    if (filterMode === 'rated') result = result.filter(e => e.rating > 0);
    else if (filterMode === 'unrated') result = result.filter(e => e.rating === 0);
    else if (filterMode === 'noreview') result = result.filter(e => !e.review || e.review.trim() === '');
    else if (filterMode === '10') result = result.filter(e => e.rating === 10);
    else if (filterMode === '9plus') result = result.filter(e => e.rating >= 9);
    else if (filterMode === '8plus') result = result.filter(e => e.rating >= 8 && e.rating < 9);
    else if (filterMode === 'below8') result = result.filter(e => e.rating > 0 && e.rating < 8);
    if (sortBy === 'rating') result.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'rating-asc') result.sort((a, b) => a.rating - b.rating);
    else if (sortBy === 'title') result.sort((a, b) => a.title.localeCompare(b.title, 'zh-TW'));
    else if (sortBy === 'date') result.sort((a, b) => b.id - a.id);
    return result;
  }, [entries, search, filterMode, sortBy]);

  const grouped = useMemo(() => {
    if (groupMode !== 'series') return null;
    const map = new Map();
    processed.forEach(e => {
      const key = e.series || e.title;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return Array.from(map.entries()).map(([series, items]) => ({
      series, items,
      avgRating: items.filter(i => i.rating > 0).length > 0
        ? items.filter(i => i.rating > 0).reduce((s, i) => s + i.rating, 0) / items.filter(i => i.rating > 0).length
        : 0,
      count: items.length
    }));
  }, [processed, groupMode]);

  const stats = useMemo(() => {
    const rated = entries.filter(e => e.rating > 0);
    return {
      total: entries.length,
      rated: rated.length,
      avg: rated.length > 0 ? (rated.reduce((s, e) => s + e.rating, 0) / rated.length).toFixed(1) : '0.0',
      masterpieces: rated.filter(e => e.rating === 10).length
    };
  }, [entries]);

  const toggleSeries = (series) => setExpandedSeries(prev => ({ ...prev, [series]: !prev[series] }));

  const ratingColor = (r) => {
    if (r === 10) return RED;
    if (r >= 9) return YELLOW;
    if (r >= 8) return BLUE_BRIGHT;
    if (r >= 7) return '#999';
    return '#444';
  };

  const filteredVA = useMemo(() => {
    if (!vaSearch) return vaList;
    const s = vaSearch.toLowerCase();
    return vaList.filter(va =>
      va.name.toLowerCase().includes(s) ||
      va.roles?.some(r => r.anime.toLowerCase().includes(s) || r.character.toLowerCase().includes(s))
    );
  }, [vaList, vaSearch]);

  // ── VA chips ──
  const VaChips = ({ animeTitle }) => {
    const vas = getAnimeVAs(animeTitle);
    if (!vas.length) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {vas.map((v, i) => (
          <button key={i}
            onClick={() => { const found = vaList.find(va => va.name === v.va); if (found) { setSelectedVa(found); setPage('va'); } }}
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] transition-all hover:opacity-80"
            style={{ background: '#1a1a1a', border: `1px solid ${v.level === '🔴' ? RED : v.level === '🔵' ? BLUE_BRIGHT : '#444'}40`, borderRadius: '2px', color: '#bbb' }}>
            <span>{v.level}</span>
            <span style={{ color: v.level === '🔴' ? RED : v.level === '🔵' ? BLUE_BRIGHT : '#888' }}>{v.va}</span>
            <span style={{ color: '#666' }}>/{v.character}</span>
          </button>
        ))}
      </div>
    );
  };

  // ── VA detail modal ──
  const VaDetailModal = ({ va, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg p-7 relative max-h-[85vh] overflow-y-auto"
        style={{ background: '#0f0f0f', border: `2px solid ${BLUE_BRIGHT}`, borderRadius: '4px', boxShadow: `8px 8px 0 ${YELLOW}` }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2" style={{ background: '#1a1a1a', color: '#888', borderRadius: '2px' }}>
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Mic className="w-4 h-4" style={{ color: BLUE_BRIGHT }} />
          <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: BLUE_BRIGHT }}>
            {va.gender === 'f' ? 'Voice Actress' : 'Voice Actor'}
          </span>
        </div>
        <h2 className="text-3xl font-black tracking-tight mb-1">{va.name}</h2>
        {va.note && <p className="text-sm mb-4" style={{ color: YELLOW }}>{va.note}</p>}
        <div className="space-y-2 mt-4">
          {(va.roles || []).map((role, i) => (
            <div key={i} className="flex items-start gap-3 p-3"
              style={{ background: '#111', borderRadius: '2px', borderLeft: `3px solid ${role.level === '🔴' ? RED : role.level === '🔵' ? BLUE_BRIGHT : '#444'}` }}>
              <span className="text-base">{role.level}</span>
              <div>
                <div className="text-sm font-bold">{role.character}</div>
                <div className="text-xs" style={{ color: '#888' }}>{role.anime}{role.note && ` · ${role.note}`}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => { handleVaEdit(va); setSelectedVa(null); }}
          className="mt-4 w-full py-2 text-xs font-bold tracking-widest uppercase transition-all hover:translate-x-0.5 hover:-translate-y-0.5"
          style={{ background: '#1a1a1a', color: BLUE_BRIGHT, border: `1px solid ${BLUE_BRIGHT}40`, borderRadius: '2px' }}>
          <Edit3 className="w-3 h-3 inline mr-2" />編輯此聲優
        </button>
      </div>
    </div>
  );

  // ── Render ──
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: BG, fontFamily: '"Inter Tight", system-ui, sans-serif', color: FG }}>
      {/* Mouse halo */}
      <div className="fixed pointer-events-none z-0 mix-blend-screen"
        style={{ left: mousePos.x - 150, top: mousePos.y - 150, width: 300, height: 300, background: `radial-gradient(circle, ${RED}40 0%, transparent 70%)`, filter: 'blur(40px)', transition: 'left 0.3s, top 0.3s' }} />

      <div className="relative max-w-6xl mx-auto px-6 py-10">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8 text-xs tracking-[0.3em] uppercase border-b pb-4" style={{ borderColor: '#1a1a1a' }}>
          <span style={{ color: YELLOW }}>● Anime Archive</span>
          {saveStatus === 'saving' && <span style={{ color: '#888' }}>● 儲存中...</span>}
          {saveStatus === 'saved' && <span style={{ color: '#4ade80' }}>● 已儲存</span>}
          {saveStatus === 'error' && <span style={{ color: RED }}>● 儲存失敗</span>}
          {vaSaveStatus === 'saved' && <span style={{ color: '#4ade80' }}>● 聲優已儲存</span>}
          {!saveStatus && !vaSaveStatus && <span className="hidden sm:block" style={{ color: '#666' }}>EST. 2026 / TAIPEI</span>}
          <span style={{ color: BLUE_BRIGHT }}>Vol. 01</span>
        </div>

        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full" style={{ background: RED }} />
            <div className="w-8 h-8" style={{ background: YELLOW }} />
            <div style={{ width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderBottom: `28px solid ${BLUE_BRIGHT}` }} />
          </div>
          <h1 className="font-black leading-[0.85] tracking-[-0.04em]" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}>
            ANIME<br />
            <span style={{ color: RED }}>AR</span><span style={{ color: YELLOW }}>CH</span><span style={{ color: BLUE_BRIGHT }}>IVE</span>.
          </h1>
          <p className="mt-3 text-xs tracking-widest" style={{ color: '#666' }}>主公大大 · 個人觀影紀錄</p>
        </header>

        {/* Page tabs */}
        <div className="flex gap-2 mb-8">
          {[{ v: 'anime', label: '作品', Icon: BookOpen }, { v: 'va', label: `聲優 (${vaList.length})`, Icon: Mic }].map(({ v, label, Icon }) => (
            <button key={v} onClick={() => setPage(v)}
              className="px-5 py-2.5 text-xs font-bold tracking-[0.2em] uppercase flex items-center gap-2 transition-all hover:translate-x-0.5 hover:-translate-y-0.5"
              style={{ background: page === v ? (v === 'anime' ? RED : BLUE_BRIGHT) : '#111', color: FG, borderRadius: '2px', boxShadow: page === v ? `3px 3px 0 ${YELLOW}` : 'none', border: page === v ? 'none' : '1px solid #222' }}>
              <Icon className="w-3 h-3" strokeWidth={3} />{label}
            </button>
          ))}
        </div>

        {/* ══ Anime page ══ */}
        {page === 'anime' && (
          <>
            {/* Stats */}
            {!loading && entries.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {[
                  { label: 'Total', sub: '作品總數', val: stats.total, color: RED },
                  { label: 'Avg', sub: '平均評分', val: stats.avg, color: YELLOW },
                  { label: 'Rated', sub: '已評分', val: stats.rated, color: BLUE_BRIGHT },
                  { label: '10/10', sub: '滿分神作', val: stats.masterpieces, color: FG },
                ].map(({ label, sub, val, color }) => (
                  <div key={label} className="p-5 relative overflow-hidden" style={{ background: '#111', borderRadius: '4px' }}>
                    <div className="absolute -right-2 -bottom-6 font-black leading-none" style={{ fontSize: '5rem', color, opacity: 0.85 }}>{val}</div>
                    <div className="relative text-[10px] tracking-[0.3em] uppercase" style={{ color: '#888' }}>{label}</div>
                    <div className="relative mt-1 text-xs">{sub}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Search + add */}
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#666' }} />
                <input type="text" placeholder="搜尋作品、系列、心得..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 text-sm focus:outline-none"
                  style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', color: FG }} />
              </div>
              <button onClick={() => setShowFilters(!showFilters)}
                className="px-5 py-3 text-xs font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2"
                style={{ background: showFilters ? YELLOW : '#111', color: showFilters ? BG : FG, border: '1px solid #222', borderRadius: '4px' }}>
                <Filter className="w-3 h-3" strokeWidth={3} />Filters
              </button>
              <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ title: '', rating: 0, review: '', series: '' }); }}
                className="px-6 py-3 text-xs font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition-all hover:translate-x-1 hover:-translate-y-1"
                style={{ background: RED, color: FG, borderRadius: '4px', boxShadow: `4px 4px 0 ${YELLOW}` }}>
                <Plus className="w-3 h-3" strokeWidth={3} />New
              </button>
            </div>

            {/* Filter panel */}
            {showFilters && (
              <div className="mb-6 p-5 grid gap-4" style={{ background: '#0d0d0d', border: `1px solid ${YELLOW}40`, borderRadius: '4px' }}>
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: YELLOW }}>Group By</div>
                  <div className="flex gap-2 flex-wrap">
                    {[{ v: 'series', label: '系列折疊', Icon: Layers }, { v: 'flat', label: '全部展開', Icon: Grid3x3 }].map(({ v, label, Icon }) => (
                      <button key={v} onClick={() => setGroupMode(v)}
                        className="px-3 py-2 text-xs flex items-center gap-2"
                        style={{ background: groupMode === v ? YELLOW : '#1a1a1a', color: groupMode === v ? BG : FG, borderRadius: '2px' }}>
                        <Icon className="w-3 h-3" />{label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: RED }}>Filter</div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { v: 'all', label: '全部' }, { v: '10', label: '10 神作' }, { v: '9plus', label: '9+' },
                      { v: '8plus', label: '8–9' }, { v: 'below8', label: '< 8' }, { v: 'rated', label: '有評分' },
                      { v: 'unrated', label: '未評分' }, { v: 'noreview', label: '未撰寫心得' }
                    ].map(({ v, label }) => (
                      <button key={v} onClick={() => setFilterMode(v)}
                        className="px-3 py-2 text-xs"
                        style={{ background: filterMode === v ? RED : '#1a1a1a', color: FG, borderRadius: '2px' }}>{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: BLUE_BRIGHT }}>Sort</div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { v: 'date', label: '加入時間' }, { v: 'rating', label: '評分高→低' },
                      { v: 'rating-asc', label: '評分低→高' }, { v: 'title', label: '名稱' }
                    ].map(({ v, label }) => (
                      <button key={v} onClick={() => setSortBy(v)}
                        className="px-3 py-2 text-xs flex items-center gap-1"
                        style={{ background: sortBy === v ? BLUE_BRIGHT : '#1a1a1a', color: FG, borderRadius: '2px' }}>
                        <ArrowUpDown className="w-3 h-3" />{label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-6 text-xs tracking-widest" style={{ color: '#666' }}>
              顯示 <span style={{ color: YELLOW, fontWeight: 700 }}>{processed.length}</span> 筆
              {groupMode === 'series' && grouped && <> · <span style={{ color: BLUE_BRIGHT, fontWeight: 700 }}>{grouped.length}</span> 系列</>}
            </div>

            {/* List */}
            {loading ? (
              <div className="text-center py-20" style={{ color: '#666' }}>LOADING...</div>
            ) : processed.length === 0 ? (
              <div className="py-20 text-center">
                <div className="text-6xl font-black mb-2" style={{ color: RED }}>0</div>
                <p className="text-lg font-bold">找不到紀錄</p>
              </div>
            ) : groupMode === 'series' && grouped ? (
              <div className="space-y-2">
                {grouped.map((group, gi) => {
                  const accent = [RED, YELLOW, BLUE_BRIGHT][gi % 3];
                  const isExpanded = expandedSeries[group.series] !== false;
                  if (group.count === 1) {
                    const entry = group.items[0];
                    return (
                      <article key={group.series} className="group relative grid grid-cols-12 gap-4 p-5 transition-all"
                        style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '4px' }}>
                        <div className="col-span-2 md:col-span-1">
                          <div className="text-2xl font-black tabular-nums" style={{ color: accent }}>{String(gi + 1).padStart(2, '0')}</div>
                        </div>
                        <div className="col-span-10 md:col-span-8">
                          <h2 className="text-lg font-bold leading-tight mb-1 tracking-tight">{entry.title}</h2>
                          {entry.season && <span className="inline-block text-[10px] tracking-widest px-2 py-0.5 mr-2 mb-2" style={{ background: '#1a1a1a', color: '#888', borderRadius: '2px' }}>{entry.season}</span>}
                          <VaChips animeTitle={entry.title} />
                          {entry.review
                            ? <p className="text-xs leading-relaxed whitespace-pre-wrap mt-2" style={{ color: '#bbb' }}>{entry.review}</p>
                            : <p className="text-xs italic mt-1" style={{ color: '#555' }}>（尚未撰寫心得）</p>}
                        </div>
                        <div className="col-span-12 md:col-span-3 flex md:justify-end items-start">
                          <div className="flex flex-col items-end">
                            {entry.rating > 0
                              ? <div className="text-2xl font-black" style={{ color: ratingColor(entry.rating) }}>{entry.rating}</div>
                              : <div className="text-xs" style={{ color: '#444' }}>—</div>}
                            <div className="text-[10px] tracking-widest mt-1" style={{ color: '#666' }}>/ 10</div>
                            <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(entry)} className="p-1.5" style={{ background: '#1a1a1a', color: BLUE_BRIGHT, borderRadius: '2px' }}><Edit3 className="w-3 h-3" /></button>
                              <button onClick={() => handleDelete(entry.id)} className="p-1.5" style={{ background: '#1a1a1a', color: RED, borderRadius: '2px' }}><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  }
                  return (
                    <div key={group.series} style={{ background: '#0d0d0d', border: `1px solid ${accent}30`, borderRadius: '4px' }}>
                      <button onClick={() => toggleSeries(group.series)}
                        className="w-full p-5 flex items-center justify-between hover:bg-[#111] transition-colors text-left"
                        style={{ borderRadius: '4px' }}>
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {isExpanded
                            ? <ChevronDown className="w-5 h-5 flex-shrink-0" style={{ color: accent }} />
                            : <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: accent }} />}
                          <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-bold tracking-tight truncate">{group.series}</h2>
                            <div className="text-[10px] tracking-[0.3em] uppercase mt-1" style={{ color: '#666' }}>
                              <span style={{ color: accent }}>{group.count}</span> 部作品
                              {group.avgRating > 0 && <> · 平均 <span style={{ color: accent }}>{group.avgRating.toFixed(1)}</span></>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-4">
                          {group.items.slice(0, 5).map((item, i) => (
                            <div key={i} className="w-2 h-8" style={{ background: ratingColor(item.rating), opacity: item.rating > 0 ? 0.9 : 0.2 }} />
                          ))}
                        </div>
                      </button>
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid #1a1a1a' }}>
                          {group.items.map((entry, i) => (
                            <article key={entry.id} className="group relative grid grid-cols-12 gap-4 p-5 transition-all hover:bg-[#0f0f0f]"
                              style={{ borderTop: i > 0 ? '1px solid #181818' : 'none' }}>
                              <div className="col-span-2 md:col-span-1 flex items-start">
                                <div className="text-xs tracking-widest font-bold" style={{ color: accent }}>{entry.season || `#${i + 1}`}</div>
                              </div>
                              <div className="col-span-10 md:col-span-8">
                                <h3 className="text-base font-bold leading-tight mb-1">{entry.title}</h3>
                                <VaChips animeTitle={entry.title} />
                                {entry.review
                                  ? <p className="text-xs leading-relaxed whitespace-pre-wrap mt-2" style={{ color: '#bbb' }}>{entry.review}</p>
                                  : <p className="text-xs italic mt-1" style={{ color: '#555' }}>（尚未撰寫心得）</p>}
                              </div>
                              <div className="col-span-12 md:col-span-3 flex md:justify-end items-start">
                                <div className="flex flex-col items-end">
                                  {entry.rating > 0
                                    ? <div className="text-xl font-black" style={{ color: ratingColor(entry.rating) }}>{entry.rating}</div>
                                    : <div className="text-xs" style={{ color: '#444' }}>—</div>}
                                  <div className="text-[10px] tracking-widest mt-0.5" style={{ color: '#666' }}>/ 10</div>
                                  <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(entry)} className="p-1.5" style={{ background: '#1a1a1a', color: BLUE_BRIGHT, borderRadius: '2px' }}><Edit3 className="w-3 h-3" /></button>
                                    <button onClick={() => handleDelete(entry.id)} className="p-1.5" style={{ background: '#1a1a1a', color: RED, borderRadius: '2px' }}><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-px">
                {processed.map((entry, i) => {
                  const accent = [RED, YELLOW, BLUE_BRIGHT][i % 3];
                  return (
                    <article key={entry.id} className="group relative grid grid-cols-12 gap-4 p-5 transition-all hover:bg-[#0f0f0f]"
                      style={{ background: '#0a0a0a', borderTop: '1px solid #1a1a1a' }}>
                      <div className="col-span-2 md:col-span-1">
                        <div className="text-2xl font-black tabular-nums" style={{ color: accent }}>{String(i + 1).padStart(2, '0')}</div>
                      </div>
                      <div className="col-span-10 md:col-span-8">
                        <div className="flex items-baseline gap-2 flex-wrap mb-1">
                          <h2 className="text-lg font-bold leading-tight tracking-tight">{entry.title}</h2>
                          {entry.season && <span className="text-[10px] tracking-widest px-2 py-0.5" style={{ background: '#1a1a1a', color: '#888', borderRadius: '2px' }}>{entry.season}</span>}
                        </div>
                        <VaChips animeTitle={entry.title} />
                        {entry.review
                          ? <p className="text-xs leading-relaxed whitespace-pre-wrap mt-2" style={{ color: '#bbb' }}>{entry.review}</p>
                          : <p className="text-xs italic mt-1" style={{ color: '#555' }}>（尚未撰寫心得）</p>}
                      </div>
                      <div className="col-span-12 md:col-span-3 flex md:justify-end items-start">
                        <div className="flex flex-col items-end">
                          {entry.rating > 0
                            ? <div className="text-2xl font-black" style={{ color: ratingColor(entry.rating) }}>{entry.rating}</div>
                            : <div className="text-xs" style={{ color: '#444' }}>—</div>}
                          <div className="text-[10px] tracking-widest mt-1" style={{ color: '#666' }}>/ 10</div>
                          <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(entry)} className="p-1.5" style={{ background: '#1a1a1a', color: BLUE_BRIGHT, borderRadius: '2px' }}><Edit3 className="w-3 h-3" /></button>
                            <button onClick={() => handleDelete(entry.id)} className="p-1.5" style={{ background: '#1a1a1a', color: RED, borderRadius: '2px' }}><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Backup */}
            {!loading && (
              <div className="mt-12 p-5"
                style={{ background: unsavedChanges >= 5 ? `${RED}15` : '#0d0d0d', border: unsavedChanges >= 5 ? `1px solid ${RED}` : '1px dashed #2a2a2a', borderRadius: '4px' }}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2" style={{ background: unsavedChanges >= 5 ? RED : BLUE_BRIGHT }} />
                    <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: unsavedChanges >= 5 ? RED : BLUE_BRIGHT }}>Backup / 資料備份</span>
                  </div>
                  <div className="text-[10px] tracking-widest" style={{ color: '#666' }}>
                    {lastBackup
                      ? <>上次備份：<span style={{ color: unsavedChanges >= 5 ? RED : YELLOW }}>{Math.floor((Date.now() - lastBackup.getTime()) / 86400000)} 天前</span></>
                      : <span style={{ color: RED }}>● 從未備份</span>}
                    {unsavedChanges > 0 && <> · <span style={{ color: YELLOW }}>{unsavedChanges} 筆未備份</span></>}
                  </div>
                </div>
                <p className="text-xs mb-4" style={{ color: '#888', lineHeight: 1.6 }}>
                  <strong style={{ color: FG }}>建議每寫 5 筆就備份一次。</strong><br />
                  手機用「複製到剪貼簿」貼到備忘錄；電腦用「下載 JSON」存雲端硬碟。
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleCopyToClipboard}
                    className="px-3 py-3 text-xs font-bold tracking-[0.15em] uppercase flex items-center justify-center gap-2 transition-all hover:translate-x-0.5 hover:-translate-y-0.5"
                    style={{ background: YELLOW, color: BG, borderRadius: '2px', boxShadow: `3px 3px 0 ${RED}` }}>📋 複製到剪貼簿</button>
                  <button onClick={handleExport}
                    className="px-3 py-3 text-xs font-bold tracking-[0.15em] uppercase flex items-center justify-center gap-2 transition-all hover:translate-x-0.5 hover:-translate-y-0.5"
                    style={{ background: BLUE_BRIGHT, color: FG, borderRadius: '2px', boxShadow: `3px 3px 0 ${YELLOW}` }}>
                    <Download className="w-3 h-3" strokeWidth={3} />下載 JSON 檔</button>
                  <button onClick={handlePasteImport}
                    className="px-3 py-3 text-xs font-bold tracking-[0.15em] uppercase flex items-center justify-center gap-2"
                    style={{ background: '#1a1a1a', color: FG, border: `1px solid ${YELLOW}40`, borderRadius: '2px' }}>📥 貼上文字還原</button>
                  <label className="px-3 py-3 text-xs font-bold tracking-[0.15em] uppercase flex items-center justify-center gap-2 cursor-pointer"
                    style={{ background: '#1a1a1a', color: FG, border: `1px solid ${YELLOW}40`, borderRadius: '2px' }}>
                    <Upload className="w-3 h-3" strokeWidth={3} />匯入檔案還原
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                  </label>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══ VA page ══ */}
        {page === 'va' && (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#666' }} />
                <input type="text" placeholder="搜尋聲優名、角色名、作品名..." value={vaSearch} onChange={e => setVaSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 text-sm focus:outline-none"
                  style={{ background: '#111', border: '1px solid #222', borderRadius: '4px', color: FG }} />
              </div>
              <button onClick={() => { setShowVaForm(true); setEditingVaId(null); setVaForm({ name: '', gender: 'f', note: '', roles: [] }); }}
                className="px-6 py-3 text-xs font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition-all hover:translate-x-1 hover:-translate-y-1"
                style={{ background: BLUE_BRIGHT, color: FG, borderRadius: '4px', boxShadow: `4px 4px 0 ${YELLOW}` }}>
                <Plus className="w-3 h-3" strokeWidth={3} />新增聲優
              </button>
              <button onClick={handleExportVA}
                className="px-5 py-3 text-xs font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2"
                style={{ background: '#111', color: YELLOW, border: `1px solid ${YELLOW}40`, borderRadius: '4px' }}>
                <Download className="w-3 h-3" />備份聲優庫
              </button>
            </div>

            {vaUnsaved >= 3 && (
              <div className="mb-4 px-4 py-3 text-xs font-bold flex items-center gap-2"
                style={{ background: `${RED}20`, border: `1px solid ${RED}60`, borderRadius: '4px', color: RED }}>
                ⚠️ 已修改 {vaUnsaved} 筆聲優資料，記得按「備份聲優庫」！
              </div>
            )}

            <div className="mb-4 text-xs tracking-widest" style={{ color: '#666' }}>
              顯示 <span style={{ color: BLUE_BRIGHT, fontWeight: 700 }}>{filteredVA.length}</span> 位聲優
            </div>

            {['f', 'm'].map(gender => {
              const genderVAs = filteredVA.filter(v => v.gender === gender);
              if (!genderVAs.length) return null;
              return (
                <div key={gender} className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1" style={{ background: gender === 'f' ? RED : BLUE_BRIGHT, opacity: 0.3 }} />
                    <span className="text-xs tracking-[0.3em] uppercase font-bold" style={{ color: gender === 'f' ? RED : BLUE_BRIGHT }}>
                      {gender === 'f' ? '女聲優' : '男聲優'} · {genderVAs.length} 位
                    </span>
                    <div className="h-px flex-1" style={{ background: gender === 'f' ? RED : BLUE_BRIGHT, opacity: 0.3 }} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {genderVAs.map((va) => (
                      <button key={va.id} onClick={() => setSelectedVa(va)}
                        className="group text-left p-4 transition-all hover:scale-[1.01]"
                        style={{ background: '#0d0d0d', border: `1px solid ${gender === 'f' ? RED : BLUE_BRIGHT}20`, borderRadius: '4px' }}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base font-bold">{va.name}</span>
                              {va.note && <span className="text-sm">{va.note}</span>}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(va.roles || []).slice(0, 4).map((role, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5"
                                  style={{ background: '#1a1a1a', color: role.level === '🔴' ? RED : role.level === '🔵' ? BLUE_BRIGHT : '#666', borderRadius: '2px' }}>
                                  {role.level} {role.character}
                                </span>
                              ))}
                              {(va.roles || []).length > 4 && (
                                <span className="text-[10px] px-1.5 py-0.5" style={{ background: '#1a1a1a', color: '#666', borderRadius: '2px' }}>+{va.roles.length - 4}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                            <button onClick={e => { e.stopPropagation(); handleVaEdit(va); }}
                              className="p-1.5" style={{ background: '#1a1a1a', color: BLUE_BRIGHT, borderRadius: '2px' }}><Edit3 className="w-3 h-3" /></button>
                            <button onClick={e => { e.stopPropagation(); handleVaDelete(va.id); }}
                              className="p-1.5" style={{ background: '#1a1a1a', color: RED, borderRadius: '2px' }}><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t flex items-center justify-between text-[10px] tracking-[0.3em] uppercase" style={{ borderColor: '#1a1a1a', color: '#444' }}>
          <span>—— End</span>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: RED }} />
            <div className="w-2 h-2" style={{ background: YELLOW }} />
            <div className="w-2 h-2 rounded-full" style={{ background: BLUE_BRIGHT }} />
          </div>
        </footer>
      </div>

      {/* VA detail modal */}
      {selectedVa && <VaDetailModal va={selectedVa} onClose={() => setSelectedVa(null)} />}

      {/* Anime form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg p-7 relative max-h-[90vh] overflow-y-auto"
            style={{ background: '#0f0f0f', border: `2px solid ${YELLOW}`, borderRadius: '4px', boxShadow: `8px 8px 0 ${RED}` }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 p-2" style={{ background: '#1a1a1a', color: '#888', borderRadius: '2px' }}>
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ background: RED }} />
              <div className="w-3 h-3" style={{ background: YELLOW }} />
              <div className="w-3 h-3 rounded-full" style={{ background: BLUE_BRIGHT }} />
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-1">{editingId ? 'Edit.' : 'New Entry.'}</h2>
            <p className="text-xs tracking-[0.3em] uppercase mb-5" style={{ color: '#666' }}>{editingId ? '編輯紀錄' : '建立新紀錄'}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: YELLOW }}>01 / Title 作品名稱</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '2px', color: FG }}
                  placeholder="例：葬送的芙莉蓮 III (2026)" />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: BLUE_BRIGHT }}>02 / Series 系列名（選填）</label>
                <input type="text" value={form.series} onChange={e => setForm({ ...form, series: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '2px', color: FG }}
                  placeholder="例：葬送的芙莉蓮" />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: RED }}>
                  03 / Rating <span style={{ color: '#666' }}>{form.rating > 0 ? `${form.rating}/10` : '未評分'}</span>
                </label>
                <input type="range" min="0" max="10" step="0.1" value={form.rating}
                  onChange={e => setForm({ ...form, rating: parseFloat(e.target.value) })}
                  className="w-full" style={{ accentColor: RED }} />
                <div className="flex justify-between text-[10px] mt-1" style={{ color: '#666' }}><span>0</span><span>5</span><span>10</span></div>
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: YELLOW }}>04 / Review 心得（選填）</label>
                <textarea value={form.review} onChange={e => setForm({ ...form, review: e.target.value })} rows={5}
                  className="w-full px-3 py-2.5 text-sm focus:outline-none resize-none"
                  style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '2px', color: FG, lineHeight: '1.6' }}
                  placeholder="留下您對這部作品的想法..." />
              </div>
              <button onClick={handleSubmit} disabled={!form.title.trim()}
                className="w-full py-3 text-xs font-black tracking-[0.2em] uppercase transition-all hover:translate-x-1 hover:-translate-y-1 disabled:opacity-30"
                style={{ background: FG, color: BG, borderRadius: '2px', boxShadow: `4px 4px 0 ${RED}` }}>
                {editingId ? 'Update →' : 'Submit →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VA form modal */}
      {showVaForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowVaForm(false)}>
          <div className="w-full max-w-lg p-7 relative max-h-[90vh] overflow-y-auto"
            style={{ background: '#0f0f0f', border: `2px solid ${BLUE_BRIGHT}`, borderRadius: '4px', boxShadow: `8px 8px 0 ${YELLOW}` }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowVaForm(false)} className="absolute top-4 right-4 p-2" style={{ background: '#1a1a1a', color: '#888', borderRadius: '2px' }}>
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-2"><Mic className="w-4 h-4" style={{ color: BLUE_BRIGHT }} /></div>
            <h2 className="text-3xl font-black tracking-tight mb-1">{editingVaId ? 'Edit VA.' : 'New VA.'}</h2>
            <p className="text-xs tracking-[0.3em] uppercase mb-5" style={{ color: '#666' }}>{editingVaId ? '編輯聲優' : '新增聲優'}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: BLUE_BRIGHT }}>聲優名</label>
                <input type="text" value={vaForm.name} onChange={e => setVaForm({ ...vaForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '2px', color: FG }}
                  placeholder="例：花守由美里" />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: BLUE_BRIGHT }}>性別</label>
                <div className="flex gap-2">
                  {[{ v: 'f', label: '女聲優' }, { v: 'm', label: '男聲優' }].map(({ v, label }) => (
                    <button key={v} onClick={() => setVaForm({ ...vaForm, gender: v })}
                      className="px-4 py-2 text-xs font-bold"
                      style={{ background: vaForm.gender === v ? BLUE_BRIGHT : '#1a1a1a', color: FG, borderRadius: '2px' }}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: BLUE_BRIGHT }}>備註（選填）</label>
                <input type="text" value={vaForm.note} onChange={e => setVaForm({ ...vaForm, note: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm focus:outline-none"
                  style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '2px', color: FG }}
                  placeholder="例：👍🏻 最愛聲優" />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.3em] uppercase mb-2" style={{ color: YELLOW }}>
                  作品列表（{vaForm.roles.length} 筆）
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
                  {vaForm.roles.map((role, i) => (
                    <div key={i} className="flex items-center gap-2 p-2" style={{ background: '#111', borderRadius: '2px' }}>
                      <select value={role.level}
                        onChange={e => { const roles = [...vaForm.roles]; roles[i] = { ...roles[i], level: e.target.value }; setVaForm({ ...vaForm, roles }); }}
                        className="text-xs focus:outline-none"
                        style={{ background: '#0a0a0a', border: '1px solid #333', color: FG, borderRadius: '2px', padding: '2px' }}>
                        <option>🔴</option><option>🔵</option><option>⚪️</option>
                      </select>
                      <input value={role.character}
                        onChange={e => { const roles = [...vaForm.roles]; roles[i] = { ...roles[i], character: e.target.value }; setVaForm({ ...vaForm, roles }); }}
                        placeholder="角色名" className="flex-1 px-2 py-1 text-xs focus:outline-none"
                        style={{ background: '#0a0a0a', border: '1px solid #333', color: FG, borderRadius: '2px' }} />
                      <input value={role.anime}
                        onChange={e => { const roles = [...vaForm.roles]; roles[i] = { ...roles[i], anime: e.target.value }; setVaForm({ ...vaForm, roles }); }}
                        placeholder="作品名" className="flex-1 px-2 py-1 text-xs focus:outline-none"
                        style={{ background: '#0a0a0a', border: '1px solid #333', color: FG, borderRadius: '2px' }} />
                      <button onClick={() => setVaForm({ ...vaForm, roles: vaForm.roles.filter((_, j) => j !== i) })}
                        className="p-1" style={{ color: RED }}><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setVaForm({ ...vaForm, roles: [...vaForm.roles, { anime: '', character: '', level: '🔵', note: '' }] })}
                  className="w-full py-2 text-xs font-bold tracking-widest uppercase"
                  style={{ background: '#1a1a1a', color: YELLOW, border: `1px dashed ${YELLOW}40`, borderRadius: '2px' }}>
                  + 新增作品
                </button>
              </div>
              <button onClick={handleVaSubmit} disabled={!vaForm.name.trim()}
                className="w-full py-3 text-xs font-black tracking-[0.2em] uppercase transition-all hover:translate-x-1 hover:-translate-y-1 disabled:opacity-30"
                style={{ background: FG, color: BG, borderRadius: '2px', boxShadow: `4px 4px 0 ${BLUE_BRIGHT}` }}>
                {editingVaId ? 'Update →' : 'Submit →'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter Tight', system-ui, sans-serif; }
      `}</style>
    </div>
  );
}
