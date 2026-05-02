'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { Search, Sparkles, ChevronRight, Loader2, Library, ArrowRight,
         GraduationCap, Briefcase, Home, BarChart3, Leaf, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AUDIENCES, type EntryPreview } from '@/types';

const AUDIENCE_MAP = Object.fromEntries(AUDIENCES.map(a => [a.id, a]));

const ZEN_PHRASES = [
  '慧心感应中，请稍候…',
  '拨云见日，须臾即来…',
  '法海无边，片刻回航…',
  '菩提树下，思忖片刻…',
];

function AudienceIcon({ id, size = 20 }: { id: string; size?: number }) {
  const s = { width: size, height: size };
  switch (id) {
    case 'student':   return <GraduationCap style={s} />;
    case 'worker':    return <Briefcase style={s} />;
    case 'homemaker': return <Home style={s} />;
    case 'boss':      return <BarChart3 style={s} />;
    case 'elder':     return <Leaf style={s} />;
    case 'entrepreneur': return <TrendingUp style={s} />;
    default:          return null;
  }
}

function DharmaWheelLoader() {
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 8;
    return {
      x1: 50 + 13 * Math.sin(angle),
      y1: 50 - 13 * Math.cos(angle),
      x2: 50 + 40 * Math.sin(angle),
      y2: 50 - 40 * Math.cos(angle),
    };
  });

  return (
    <div style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 2rem' }}>
      {[0, 1].map(i => (
        <div key={i} style={{
          position: 'absolute',
          inset: `${-(14 + i * 16)}px`,
          border: '1px solid rgba(156,189,161,0.3)',
          borderRadius: '50%',
          animation: `dharma-ripple 2.6s ease-out ${i * 0.65}s infinite`,
        }} />
      ))}
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', animation: 'dharma-spin 5s linear infinite' }}>
        <circle cx="50" cy="50" r="44" fill="none" stroke="#9CBDA1" strokeWidth="3.5" />
        <circle cx="50" cy="50" r="27" fill="none" stroke="rgba(156,189,161,0.35)" strokeWidth="1.5" />
        {spokes.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke="#9CBDA1" strokeWidth="2.5" strokeLinecap="round" />
        ))}
        <circle cx="50" cy="50" r="12" fill="#9CBDA1" />
        <circle cx="50" cy="50" r="5.5" fill="#09330D" />
      </svg>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('term') ?? '');
  const [results, setResults] = useState<EntryPreview[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedAudience, setSelectedAudience] = useState(() => searchParams.get('audience') ?? '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genPhrase, setGenPhrase] = useState(ZEN_PHRASES[0]);
  const [recentEntries, setRecentEntries] = useState<EntryPreview[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [genError, setGenError] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '' }),
    })
      .then(r => r.json())
      .then(d => setRecentEntries((d.entries || []).slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoadingRecent(false));
  }, []);

  // If term pre-filled from library page, trigger search immediately
  useEffect(() => {
    const term = searchParams.get('term');
    if (term) {
      setIsSearching(true);
      fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term }),
      })
        .then(r => r.json())
        .then(d => { setResults(d.entries || []); setSearched(true); })
        .catch(() => { setResults([]); setSearched(true); })
        .finally(() => setIsSearching(false));
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) { setResults([]); setSearched(false); return; }

    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim() }),
        });
        const data = await res.json();
        setResults(data.entries || []);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setIsSearching(false);
      }
    }, 450);

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  useEffect(() => {
    if (!isGenerating) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % ZEN_PHRASES.length;
      setGenPhrase(ZEN_PHRASES[i]);
    }, 2800);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async () => {
    if (!query.trim() || !selectedAudience || isGenerating) return;
    setIsGenerating(true);
    setGenError('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: query.trim(), audience: selectedAudience }),
      });
      const data = await res.json();
      if (data.success && data.entry?.id) {
        sessionStorage.setItem(`buddha_entry_${data.entry.id}`, JSON.stringify(data.entry));
        router.push(`/entry/${data.entry.id}`);
      } else if (data.rejected) {
        setGenError(`🚫 ${data.reason || '该词汇不符合本应用的内容规范'}`);
      } else {
        setGenError(data.error || '生成失败，请稍后再试');
      }
    } catch {
      setGenError('生成失败，请检查网络后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const showBrowse = !query.trim();
  const showResults = searched && results.length > 0;
  const showGenerate = searched && !isSearching;
  const hasResults = results.length > 0;
  // Audiences that already have an entry for this exact term
  const coveredAudiences = new Set(
    results.filter(e => e.term === query.trim()).map(e => e.audience)
  );

  return (
    <div style={{ background: '#F7F7E8', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ background: '#09330D', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', bottom: '-40px', right: '-40px',
          width: '200px', height: '200px',
          border: '1px solid rgba(156,189,161,0.2)', borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', right: '-60px',
          width: '280px', height: '280px',
          border: '1px solid rgba(156,189,161,0.12)', borderRadius: '50%',
        }} />
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '3rem 1.5rem 2.5rem', position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 8vw, 4rem)', fontWeight: 700, color: 'white',
            letterSpacing: '-0.02em', lineHeight: 1.1, margin: '0 0 0.5rem',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}>
            凡人问佛
          </h1>
          <p style={{ color: '#9CBDA1', fontSize: '1rem', margin: '0 0 0.25rem', letterSpacing: '0.05em' }}>
            Ask Buddha
          </p>
          <p style={{ color: 'rgba(199,207,183,0.8)', fontSize: '0.875rem', margin: 0 }}>
            以凡人之心，问佛法之道
          </p>
        </div>
      </header>

      {/* Search bar */}
      <div style={{ background: '#09330D', paddingBottom: '1.5rem' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{
              position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
              color: '#9CBDA1', width: 20, height: 20, pointerEvents: 'none',
            }} />
            {isSearching && (
              <Loader2 style={{
                position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                color: '#9CBDA1', width: 18, height: 18,
                animation: 'spin 1s linear infinite',
              }} />
            )}
            <input
              className="zen-input"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="请输入佛法词汇，如：无常、般若、涅槃、菩提…"
              aria-label="搜索佛法词汇"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: '680px', margin: '0 auto', padding: '1.5rem', width: '100%' }}>

        {/* Search Results */}
        {showResults && (
          <div className="float-up">
            <p style={{ color: '#9CBDA1', fontSize: '0.875rem', marginBottom: '1rem' }}>
              找到 {results.length} 条相关词汇
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {results.map(entry => <EntryCard key={entry.id} entry={entry} />)}
            </div>
          </div>
        )}

        {/* Generate Section */}
        {showGenerate && !isGenerating && (
          <div className="float-up" style={{ marginTop: hasResults ? '1.5rem' : 0 }}>
            <div style={{
              textAlign: 'center', padding: hasResults ? '1.25rem 0 1.25rem' : '2rem 0 1.5rem',
              borderTop: hasResults ? '1px solid #C7CFB7' : 'none',
              borderBottom: '1px solid #C7CFB7', marginBottom: '1.5rem',
            }}>
              {!hasResults && (
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}>
                  <svg viewBox="0 0 60 60" width="48" height="48" style={{ opacity: 0.5 }}>
                    <circle cx="30" cy="30" r="28" fill="none" stroke="#9CBDA1" strokeWidth="2.5" />
                    {Array.from({ length: 8 }, (_, i) => {
                      const a = (i * Math.PI * 2) / 8;
                      return <line key={i} x1={30 + 8 * Math.sin(a)} y1={30 - 8 * Math.cos(a)}
                        x2={30 + 24 * Math.sin(a)} y2={30 - 24 * Math.cos(a)}
                        stroke="#9CBDA1" strokeWidth="2" strokeLinecap="round" />;
                    })}
                    <circle cx="30" cy="30" r="7" fill="#9CBDA1" />
                  </svg>
                </div>
              )}
              <p style={{ color: '#09330D', fontWeight: 600, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                {hasResults ? `换个视角看「${query}」` : `「${query}」尚未收录`}
              </p>
              <p style={{ color: '#9CBDA1', fontSize: '0.875rem' }}>
                {hasResults ? '选择另一个身份，让佛陀换个角度开示' : '选择你的身份，让佛陀以你的视角来解说'}
              </p>
            </div>

            <p style={{ fontWeight: 600, color: '#09330D', marginBottom: '1rem', fontSize: '0.9rem', letterSpacing: '0.02em' }}>
              请问施主是何方人士？
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {AUDIENCES.map(audience => {
                const covered = coveredAudiences.has(audience.id);
                const selected = selectedAudience === audience.id;
                return (
                  <button
                    key={audience.id}
                    className={`audience-card${selected ? ' selected' : ''}`}
                    onClick={() => !covered && setSelectedAudience(audience.id)}
                    disabled={covered}
                    title={covered ? '已有此身份的开示' : undefined}
                    style={{ opacity: covered ? 0.45 : 1, cursor: covered ? 'not-allowed' : 'pointer', position: 'relative' }}
                  >
                    {covered && (
                      <span style={{
                        position: 'absolute', top: 6, right: 8,
                        fontSize: '0.65rem', fontWeight: 600, color: '#9CBDA1',
                        background: 'rgba(156,189,161,0.15)', borderRadius: '99px',
                        padding: '0.1rem 0.4rem',
                      }}>已有</span>
                    )}
                    <div style={{
                      width: 40, height: 40, borderRadius: '10px', margin: '0 auto 0.5rem',
                      background: selected ? '#09330D' : 'rgba(156,189,161,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                      color: selected ? '#9CBDA1' : '#09330D',
                    }}>
                      <AudienceIcon id={audience.id} size={20} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#09330D', marginBottom: '0.125rem' }}>
                      {audience.label}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#9CBDA1', lineHeight: 1.3 }}>
                      {audience.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ textAlign: 'center' }}>
              <button className="btn-primary" onClick={handleGenerate} disabled={!selectedAudience}>
                <Sparkles style={{ width: 18, height: 18 }} />
                请佛开示
              </button>
              {!selectedAudience && !genError && (
                <p style={{ color: '#C7CFB7', fontSize: '0.8rem', marginTop: '0.5rem' }}>请先选择身份</p>
              )}
              {genError && (
                <p style={{ color: '#8B2020', fontSize: '0.8rem', marginTop: '0.5rem' }}>{genError}</p>
              )}
            </div>
          </div>
        )}

        {/* Generating State */}
        {isGenerating && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }} className="float-up">
            <DharmaWheelLoader />
            <p style={{ color: '#09330D', fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              {genPhrase}
            </p>
            <p style={{ color: '#9CBDA1', fontSize: '0.875rem' }}>
              正在为「{query}」生成专属开示
            </p>
          </div>
        )}

        {/* Browse Recent — 3 latest + link to full library */}
        {showBrowse && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Library style={{ width: 16, height: 16, color: '#9CBDA1' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#09330D', letterSpacing: '0.04em' }}>
                  最新收录
                </span>
              </div>
              {!loadingRecent && recentEntries.length > 0 && (
                <Link href="/library" className="all-terms-link" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  fontSize: '0.8rem', color: '#9CBDA1', textDecoration: 'none',
                  transition: 'color 0.15s',
                }}>
                  全部词汇
                  <ArrowRight style={{ width: 13, height: 13 }} />
                </Link>
              )}
            </div>

            {loadingRecent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{
                    height: 88, borderRadius: '1rem', background: '#C7CFB7',
                    opacity: 0.3, animation: 'zen-pulse 1.5s ease-in-out infinite',
                  }} />
                ))}
              </div>
            ) : recentEntries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentEntries.map(entry => <EntryCard key={entry.id} entry={entry} />)}
              </div>
            ) : (
              <EmptyBrowse onTermClick={setQuery} />
            )}
            <AboutSection />
          </div>
        )}
      </main>

      <footer style={{
        background: '#09330D', color: 'rgba(199,207,183,0.6)',
        textAlign: 'center', padding: '1.25rem',
        fontSize: '0.8rem', letterSpacing: '0.04em',
      }}>
        凡人问佛 · Made with care by VibeUncle
      </footer>
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  view: '#8B6914', aspire: '#09330D', practice: '#2D5A7B', obstacle: '#8B3A3A',
};

function EntryCard({ entry }: { entry: EntryPreview }) {
  const audience = AUDIENCE_MAP[entry.audience];
  const dotColor = entry.category ? CATEGORY_COLORS[entry.category] : undefined;
  return (
    <Link href={`/entry/${entry.id}`} className="entry-card" style={{ textDecoration: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
            {dotColor && (
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0, display: 'inline-block' }} />
            )}
            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#09330D', fontFamily: 'Georgia, serif' }}>
              {entry.term}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#9CBDA1', fontStyle: 'italic' }}>
              {entry.term_en}
            </span>
          </div>
          {entry.essence && (
            <p style={{
              color: '#444', fontSize: '0.875rem', lineHeight: 1.5, margin: '0 0 0.5rem',
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {entry.essence}
            </p>
          )}
          {audience && (
            <span className="audience-badge">
              <AudienceIcon id={audience.id} size={11} />
              {audience.label}
            </span>
          )}
        </div>
        <ChevronRight style={{ color: '#C7CFB7', width: 20, height: 20, flexShrink: 0, marginTop: 2 }} />
      </div>
    </Link>
  );
}

function EmptyBrowse({ onTermClick }: { onTermClick: (term: string) => void }) {
  return (
    <div style={{
      textAlign: 'center', padding: '3rem 1rem',
      border: '1.5px dashed #C7CFB7', borderRadius: '1rem',
    }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center', opacity: 0.35 }}>
        <svg viewBox="0 0 60 60" width="48" height="48">
          <circle cx="30" cy="30" r="28" fill="none" stroke="#09330D" strokeWidth="2.5" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI * 2) / 8;
            return <line key={i} x1={30 + 8 * Math.sin(a)} y1={30 - 8 * Math.cos(a)}
              x2={30 + 24 * Math.sin(a)} y2={30 - 24 * Math.cos(a)}
              stroke="#09330D" strokeWidth="2" strokeLinecap="round" />;
          })}
          <circle cx="30" cy="30" r="7" fill="#09330D" />
        </svg>
      </div>
      <p style={{ color: '#09330D', fontWeight: 600, marginBottom: '0.25rem' }}>
        法海初开，尚无词汇
      </p>
      <p style={{ color: '#9CBDA1', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        搜索佛法词汇，成为第一位提问的凡人
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
        {['无常', '般若', '涅槃', '因果', '菩提', '禅定'].map(term => (
          <button
            key={term}
            onClick={() => onTermClick(term)}
            style={{
              padding: '0.375rem 0.875rem',
              background: 'rgba(156,189,161,0.15)', border: '1px solid rgba(156,189,161,0.3)',
              borderRadius: '99px', fontSize: '0.875rem', color: '#09330D',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
}

const AUDIENCE_HOOKS: Record<string, string> = {
  student:      '在压力与迷茫中，找到努力的真正意义',
  worker:       '在日复一日的拼搏里，看见更深的自己',
  homemaker:    '在付出与牺牲之间，重新找回内心的位置',
  boss:         '在孤独的决策重压下，寻得一份从容',
  entrepreneur: '在浪尖与低谷之间，看清什么才是真正重要的',
  elder:        '在回望来路时，让心真正安定下来',
};

function AboutSection() {
  return (
    <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

      {/* Hook — sage-tinted, bold emotional headline */}
      <div style={{
        background: 'rgba(156,189,161,0.13)',
        border: '1px solid rgba(156,189,161,0.25)',
        borderRadius: '1rem',
        padding: '1.75rem 1.5rem',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 160, height: 160,
          borderRadius: '50%', border: '1px solid rgba(9,51,13,0.07)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: -65, right: -65, width: 230, height: 230,
          borderRadius: '50%', border: '1px solid rgba(9,51,13,0.04)', pointerEvents: 'none',
        }} />
        <p style={{
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(1.75rem, 6.5vw, 2.25rem)',
          fontWeight: 700, lineHeight: 1.45,
          color: '#09330D', margin: '0 0 1.25rem',
          position: 'relative', letterSpacing: '-0.01em',
        }}>
          智慧本无门槛。<br />是语言，<br />把你挡在了门外。
        </p>
        <p style={{
          fontSize: '0.925rem', lineHeight: 1.9,
          color: '#3a3a3a', margin: 0,
          position: 'relative',
        }}>
          千年来，佛法从未只属于学者或出家人。是那些专有词汇，让它看起来像是「别人的事」。凡人问佛不是要你去学佛——而是让古老智慧以你的身份、你的处境开口，帮你听懂一直属于你的东西。
        </p>
      </div>

      {/* Steps — white card, benefit-led */}
      <div style={{
        background: 'white', borderRadius: '1rem',
        border: '1.5px solid #C7CFB7', padding: '1.5rem',
      }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9CBDA1', letterSpacing: '0.15em', margin: '0 0 1.375rem' }}>
          找到你的那扇门
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 1.25rem' }}>
          {([
            { num: '一', title: '投石入水', desc: '挑选一个让你困惑、或是曾在心头盘旋的佛学词汇。文字不仅是符号，它是唤醒你内在觉性的第一声回响。' },
            { num: '二', title: '坦诚相见', desc: '告诉佛陀你的身份与处境。无论你是谁，智慧从不居高临下，它只会以最契合你当下人生的面貌现身。' },
            { num: '三', title: '借光照见', desc: '听懂，不是逻辑的理解，而是生命的共鸣。让古老的经文成为一盏灯，照亮你此时此刻正在经历的酸甜苦辣。' },
          ] as const).map((step, i) => (
            <div key={i}>
              <div style={{
                fontFamily: 'Georgia, serif', fontSize: '5rem', fontWeight: 700,
                color: '#9CBDA1', lineHeight: 0.9, marginBottom: '0.625rem',
              }}>
                {step.num}
              </div>
              <div style={{ fontWeight: 700, color: '#09330D', fontSize: '0.9rem', marginBottom: '0.375rem', lineHeight: 1.3 }}>
                {step.title}
              </div>
              <div style={{ color: '#555', fontSize: '0.78rem', lineHeight: 1.65 }}>
                {step.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audiences — dark green, editorial grid */}
      <div style={{
        background: '#09330D', borderRadius: '1rem',
        padding: '2rem 1.75rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', bottom: -70, right: -70, width: 280, height: 280,
          borderRadius: '50%', border: '1px solid rgba(156,189,161,0.12)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -110, right: -110, width: 400, height: 400,
          borderRadius: '50%', border: '1px solid rgba(156,189,161,0.06)', pointerEvents: 'none',
        }} />
        <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(156,189,161,0.55)', letterSpacing: '0.18em', margin: '0 0 1.75rem', position: 'relative' }}>
          你的那扇门，一直在等你
        </p>
        <div style={{ position: 'relative' }}>
          {([[0, 1], [2, 3], [4, 5]] as const).map((indices, rowIdx) => (
            <div key={rowIdx} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              borderTop: '1px solid rgba(156,189,161,0.2)',
            }}>
              {indices.map((idx, colIdx) => {
                const a = AUDIENCES[idx];
                return (
                  <div key={a.id} style={{
                    padding: '1.5rem 0',
                    paddingRight: colIdx === 0 ? '1.25rem' : 0,
                    paddingLeft: colIdx === 1 ? '1.25rem' : 0,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                      <span style={{ color: '#C9A76D', display: 'flex', flexShrink: 0 }}>
                        <AudienceIcon id={a.id} size={14} />
                      </span>
                      <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#F7F7E8' }}>
                        {a.label}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.875rem', lineHeight: 1.75,
                      color: 'rgba(199,207,183,0.7)', margin: 0,
                    }}>
                      {AUDIENCE_HOOKS[a.id]}
                    </p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
