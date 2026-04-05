"use client";

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";
import { Roboto } from 'next/font/google';

// Load Roboto for Material UI style
const roboto = Roboto({ weight: ['300', '400', '500', '700'], subsets: ['latin'] });

export default function Dashboard() {
  const { data: session } = useSession();
  const [isMounted, setIsMounted] = useState(false);
  const [mode, setMode] = useState<'manual' | 'live'>('manual');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- Helpers ---
  const getTodayDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const getFirstDayOfMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const formatDateForQuery = (val: string) => {
    if (!val) return "";
    const [y, m, d] = val.split('-');
    return `${d}-${m}-${y}`;
  };

  // --- State ---
  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [goals, setGoals] = useState([
    { title: 'Project #1', date: getTodayDate(), color: '#90caf9' } // Material Dark Blue 200 default
  ]);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // --- Logic ---
  useEffect(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    
    if (mode === 'live') {
      setGeneratedUrl(`${origin}/api/og?source=google`);
      return;
    }

    const params = new URLSearchParams();
    params.append("startDate", formatDateForQuery(startDate));

    goals.forEach((g, i) => {
      if (g.title) {
        params.append(`goal[${i}][title]`, g.title);
        params.append(`goal[${i}][goalDate]`, formatDateForQuery(g.date));
        params.append(`goal[${i}][goalColor]`, encodeURIComponent(g.color));
      }
    });

    setGeneratedUrl(`${origin}/api/og?${params.toString()}`);
  }, [startDate, goals, mode]);

  const addGoal = () => {
    setGoals([...goals, { title: '', date: getTodayDate(), color: '#ce93d8' }]); // Material Dark Purple 200
  };

  const removeGoal = (index: number) => {
    // Only remove if there's more than one goal left
    if (goals.length > 1) {
      setGoals(goals.filter((_, i) => i !== index));
    }
  };

  const updateGoal = (index: number, field: string, value: string) => {
    const newGoals = [...goals];
    (newGoals[index] as any)[field] = value;
    setGoals(newGoals);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  if (!isMounted) {
    return <main className={`${roboto.className} min-h-screen bg-[#121212] flex justify-center`} />;
  }

  return (
    <main className={`${roboto.className} min-h-screen bg-[#121212] text-gray-100 p-4 md:p-8 flex justify-center`}>
      <div className="w-full max-w-4xl bg-[#1e1e1e] p-6 md:p-10 rounded-xl shadow-2xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-medium text-gray-50 tracking-wide">Builder</h1>
            <div className="flex bg-[#262626] rounded-lg p-1 shadow-inner">
              <button 
                onClick={() => setMode('manual')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'manual' ? 'bg-[#1e1e1e] text-[#90caf9] shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Manual Setup
              </button>
              <button 
                onClick={() => setMode('live')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'live' ? 'bg-[#1e1e1e] text-[#ce93d8] shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Live Google
              </button>
            </div>
          </div>
          <div>
            {session ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 hidden sm:inline">{session.user?.email}</span>
                <button onClick={() => signOut()} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 transition-colors text-sm">Sign Out</button>
              </div>
            ) : (
              <button onClick={() => signIn('google')} className="px-4 py-2 bg-[#90caf9] text-[#121212] font-medium rounded-md hover:bg-[#64b5f6] transition-colors text-sm">Sign in with Google</button>
            )}
          </div>
        </div>

        {mode === 'manual' ? (
          <>
            {/* Start Date */}
        <div className="mb-10">
          <label className="block text-sm font-medium text-gray-400 mb-2">Projects Start</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-[#121212] border border-gray-700 text-gray-100 rounded-md p-3 outline-none focus:border-[#90caf9] focus:ring-1 focus:ring-[#90caf9] transition-all shadow-sm"
          />
        </div>

        {/* Goals List */}
        <div className="space-y-4 mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">Projects</label>
          {goals.map((goal, index) => (
            <div key={index} className="grid grid-cols-12 gap-4 bg-[#262626] p-4 rounded-lg shadow-sm items-center transition-shadow hover:shadow-md">
              <div className="col-span-12 sm:col-span-5 relative">
                <input
                  type="text"
                  placeholder="Title"
                  value={goal.title}
                  onChange={(e) => updateGoal(index, 'title', e.target.value)}
                  className="w-full bg-transparent border-b-2 border-gray-600 p-2 outline-none focus:border-[#90caf9] text-base text-gray-100 placeholder-gray-500 transition-colors"
                />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <input
                  type="date"
                  value={goal.date}
                  onChange={(e) => updateGoal(index, 'date', e.target.value)}
                  className="w-full bg-transparent border-b-2 border-gray-600 p-2 outline-none text-sm text-gray-100 focus:border-[#90caf9] transition-colors"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="color"
                  value={goal.color}
                  onChange={(e) => updateGoal(index, 'color', e.target.value)}
                  className="w-full h-10 bg-transparent cursor-pointer rounded-md overflow-hidden p-0 border-0"
                />
              </div>
              <div className="col-span-2 sm:col-span-2 flex justify-end">
                <button
                  onClick={() => removeGoal(index)}
                  className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:bg-red-900/40 hover:text-red-400 transition-colors text-xl"
                  title="Remove Project"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addGoal}
          className="w-full py-3 bg-[#90caf9]/10 text-[#90caf9] font-medium rounded-md hover:bg-[#90caf9]/20 transition-colors flex items-center justify-center gap-2 mb-10 shadow-sm uppercase text-sm tracking-wider"
        >
          <span className="text-xl leading-none">+</span> Add New Project
        </button>
          </>
        ) : (
          <div className="mb-10 p-8 bg-[#262626] rounded-xl border border-[#333333] text-center shadow-inner">
            {session ? (
              <div className="text-gray-300">
                <p className="mb-3 text-lg font-medium text-[#ce93d8]">Your image URL is now permanently linked to your Google Tasks.</p>
                <p className="text-sm text-gray-400">Every time the URL is loaded, it will securely fetch your active tasks and automatically update the preview!</p>
              </div>
            ) : (
              <div className="text-[#ffb74d]">
                <p className="mb-2 font-medium text-lg">Authentication Required</p>
                <p className="text-sm">Please sign in with Google above to use Live Mode.</p>
              </div>
            )}
          </div>
        )}

        {/* Shared Link Output */}
        <div className="bg-[#121212] p-6 rounded-lg shadow-inner">
          <label className="block text-sm font-medium text-gray-400 mb-3">Dynamic Image URL</label>
          <div className="bg-[#1a1a1a] p-4 rounded-md font-mono text-[12px] text-gray-300 break-all mb-6 leading-relaxed shadow-inner">
            {generatedUrl}
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={copyToClipboard}
              className={`flex-1 py-3 px-4 rounded-md font-medium text-sm transition-all shadow-sm uppercase tracking-wider ${copied ? 'bg-[#81c784] text-[#121212] hover:bg-[#66bb6a]' : 'bg-[#90caf9] text-[#121212] hover:bg-[#64b5f6] hover:shadow-md'}`}
            >
              {copied ? '✓ Copied' : 'Copy Link'}
            </button>
            <a
              href={generatedUrl}
              target="_blank"
              className="py-3 px-6 flex items-center justify-center bg-[#1e1e1e] text-[#90caf9] rounded-md hover:bg-[#262626] transition-colors shadow-sm uppercase font-medium text-sm tracking-wider"
              title="Preview Image"
            >
              Preview
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}