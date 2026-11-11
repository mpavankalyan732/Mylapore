'use client';
import { FormEvent, KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { rupees } from '@/lib/api';
import { SearchIcon } from './Icons';
import { useLang, useShop } from './Providers';

/** Header search with instant dish suggestions (keyboard: ↑ ↓ Enter Esc). Enter on free text opens the filtered menu. */
export default function SearchBox() {
  const { menu, openSheet } = useShop();
  const { pick, t } = useLang();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLFormElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 1) return [];
    return menu.flatMap((c) => c.items.map((i) => ({ i, cat: pick(c.names) })))
      .filter(({ i }) => Object.values(i.names).some((n) => n.toLowerCase().includes(s)) || Object.values(i.descriptions).some((n) => n.toLowerCase().includes(s)))
      .slice(0, 6);
  }, [q, menu, pick]);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const choose = (idx: number) => { openSheet(results[idx].i); setOpen(false); setQ(''); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (active >= 0 && results[active]) return choose(active);
    setOpen(false);
    router.push(q.trim() ? `/menu?q=${encodeURIComponent(q.trim())}` : '/menu');
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setActive(-1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(results.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
  };

  return (
    <form className="search" role="search" onSubmit={submit} ref={box}>
      <SearchIcon width={18} height={18} />
      <label className="sr-only" htmlFor="q">Search dishes</label>
      <input
        id="q" value={q} autoComplete="off" placeholder={t('search_ph')}
        role="combobox" aria-expanded={open && results.length > 0} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
      />
      {open && q.trim() && (
        <ul className="suggest" id={listId} role="listbox">
          {results.length === 0 && <li className="suggest-empty">No dishes match “{q}”</li>}
          {results.map(({ i, cat }, idx) => (
            <li key={i.id} id={`${listId}-${idx}`} role="option" aria-selected={idx === active}>
              <button type="button" className={idx === active ? 'on' : ''} onMouseEnter={() => setActive(idx)} onClick={() => choose(idx)}>
                <span className="s-img"><Image src={i.imageUrl} alt="" width={44} height={44} /></span>
                <span className="s-txt"><b>{pick(i.names)}</b><small>{cat}</small></span>
                <span className="s-price">{rupees(i.pricePaise)}</span>
              </button>
            </li>
          ))}
          {results.length > 0 && <li className="suggest-all"><button type="button" onClick={() => { setOpen(false); router.push(`/menu?q=${encodeURIComponent(q.trim())}`); }}>See all results for “{q}”</button></li>}
        </ul>
      )}
    </form>
  );
}
