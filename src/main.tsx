import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Link, Navigate, NavLink, Route, BrowserRouter, Routes, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import './styles.css';

const basePath = '/proved/';

type PetRecord = {
  id: string;
  pet_name?: string;
  name?: string;
  weight?: number;
  recorded_at?: string;
  created_at?: string;
};

function restoreGitHubPagesPath() {
  const params = new URLSearchParams(window.location.search);
  const redirectedPath = params.get('p');
  if (!redirectedPath) return;
  const cleanParams = new URLSearchParams(window.location.search);
  cleanParams.delete('p');
  const query = cleanParams.toString();
  window.history.replaceState(null, '', `${basePath}${redirectedPath.replace(/^\//, '')}${query ? `?${query}` : ''}${window.location.hash}`);
}

restoreGitHubPagesPath();

function App() {
  return (
    <BrowserRouter basename="/proved">
      <Layout />
    </BrowserRouter>
  );
}

function Layout() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="logo">P</span>
          <span>Proved</span>
        </Link>
        <nav>
          <NavLink to="/cat/calculator">고양이 계산기</NavLink>
          <NavLink to="/cat/food-finder">사료 찾기</NavLink>
          <NavLink to="/dog/calculator">강아지</NavLink>
          <NavLink to="/records">체중 기록</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cat/calculator" element={<CatCalculator />} />
          <Route path="/cat/food-finder" element={<FoodFinder />} />
          <Route path="/dog/calculator" element={<ComingSoon />} />
          <Route path="/records" element={<Records />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Home() {
  return (
    <section className="hero">
      <p className="eyebrow">Proved 통합 서비스</p>
      <h1>반려동물 식단과 기록을 한곳에서 관리하세요.</h1>
      <p>ProvedCat의 고양이 급여 계산, 사료 후보 찾기, 로그인 기반 체중 기록을 유지하면서 Proved 통합 주소로 이전했습니다.</p>
      <div className="cards">
        <Feature to="/cat/calculator" title="고양이 급여 계산기" text="현재 체중과 상태에 맞춰 하루 권장 칼로리를 계산합니다." />
        <Feature to="/cat/food-finder" title="고양이 사료 후보 찾기" text="Supabase에 저장된 기존 고양이 사료 데이터를 조회합니다." />
        <Feature to="/dog/calculator" title="강아지 급여 계산기" text="ProvedDog 계산 로직은 준비 중입니다." />
        <Feature to="/records" title="체중 기록" text="로그인 후 반려동물 체중 변화를 확인합니다." />
      </div>
    </section>
  );
}

function Feature({ to, title, text }: { to: string; title: string; text: string }) {
  return <Link className="card" to={to}><h2>{title}</h2><p>{text}</p></Link>;
}

function CatCalculator() {
  const [weight, setWeight] = useState(4.5);
  const [factor, setFactor] = useState(1.2);
  const rer = weight > 0 ? 70 * Math.pow(weight, 0.75) : 0;
  const kcal = Math.round(rer * factor);

  return (
    <section className="panel">
      <h1>고양이 급여 계산기</h1>
      <p>기존 ProvedCat 방식의 RER × 생활계수 계산을 유지합니다.</p>
      <label>체중(kg)<input type="number" min="0" step="0.1" value={weight} onChange={(e) => setWeight(Number(e.target.value))} /></label>
      <label>상태<select value={factor} onChange={(e) => setFactor(Number(e.target.value))}>
        <option value="0.8">체중 감량</option><option value="1.2">중성화 성묘</option><option value="1.4">일반 성묘</option><option value="2.5">성장기/활동량 높음</option>
      </select></label>
      <div className="result">하루 권장량 <strong>{kcal}</strong> kcal</div>
    </section>
  );
}

function FoodFinder() {
  const [foods, setFoods] = useState<any[]>([]);
  const [message, setMessage] = useState('Supabase 데이터를 불러오는 중입니다.');

  useEffect(() => {
    if (!supabase) { setMessage('Supabase 환경변수를 설정하면 기존 고양이 사료 데이터를 조회합니다.'); return; }
    supabase.from('cat_foods').select('*').limit(12).then(({ data, error }) => {
      if (error) setMessage(`cat_foods 조회 실패: ${error.message}`);
      else { setFoods(data ?? []); setMessage(data?.length ? '' : '등록된 사료 후보가 없습니다.'); }
    });
  }, []);

  return <section className="panel"><h1>고양이 사료 후보 찾기</h1><p>기존 Supabase 프로젝트의 <code>cat_foods</code> 테이블을 조회합니다.</p>{message && <p className="notice">{message}</p>}<div className="list">{foods.map((food) => <article key={food.id ?? food.name} className="item"><h2>{food.name ?? food.product_name ?? '이름 없음'}</h2><p>{food.brand ?? food.maker ?? '브랜드 정보 없음'}</p></article>)}</div></section>;
}

function ComingSoon() {
  return <section className="panel"><h1>강아지 급여 계산기</h1><p className="notice">ProvedDog 계산 로직은 준비 중입니다.</p></section>;
}

function Records() {
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<PetRecord[]>([]);
  const [message, setMessage] = useState('로그인 후 체중 기록을 확인하세요.');
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabase) { setMessage('Supabase 환경변수가 필요합니다.'); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => setSession(current));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    supabase.from('pet_weight_records').select('*').order('recorded_at', { ascending: false }).limit(20).then(({ data, error }) => {
      if (error) setMessage(`pet_weight_records 조회 실패: ${error.message}`);
      else { setRecords(data ?? []); setMessage(data?.length ? '' : '체중 기록이 없습니다.'); }
    });
  }, [session]);

  const signIn = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${basePath}records` } });
  };

  const rows = useMemo(() => records.map((r) => ({ ...r, label: r.pet_name ?? r.name ?? '반려동물' })), [records]);

  return <section className="panel"><h1>반려동물 체중 기록</h1><p>기존 Supabase Auth 세션과 체중 기록 테이블을 사용합니다.</p>{!isSupabaseConfigured && <p className="notice">VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정해 주세요.</p>}{session ? <button onClick={() => supabase?.auth.signOut().then(() => navigate('/'))}>로그아웃</button> : <button onClick={signIn}>Google로 로그인</button>}{message && <p className="notice">{message}</p>}<div className="list">{rows.map((record) => <article className="item" key={record.id}><h2>{record.label}</h2><p>{record.weight ?? '-'} kg · {record.recorded_at ?? record.created_at ?? '날짜 없음'}</p></article>)}</div></section>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
