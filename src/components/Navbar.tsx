import React from 'react';
import { Settings, GraduationCap, ArrowLeft, Shield } from 'lucide-react';

interface NavbarProps {
  isAdminOpen: boolean;
  onToggleAdmin: () => void;
  evaluationTitle: string;
}

export default function Navbar({ isAdminOpen, onToggleAdmin, evaluationTitle }: NavbarProps) {
  return (
    <header className="bg-indigo-900 sticky top-0 z-50 print:hidden shadow-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-indigo-900 shadow-sm">
            <GraduationCap size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <span className="text-sm font-extrabold text-white block tracking-tight">EDU-Grade Viewer</span>
            <span className="text-[10px] text-indigo-200 font-bold block leading-none">수행평가 결과 조회 시스템</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdminOpen ? (
            <button 
              onClick={onToggleAdmin}
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 border border-white/20 rounded-full bg-white/10 hover:bg-white/20 text-white tracking-tight transition-colors shadow-sm cursor-pointer"
            >
              <ArrowLeft size={14} /> 학생 화면으로 가기
            </button>
          ) : (
            <button 
              onClick={onToggleAdmin}
              className="flex items-center gap-1.5 text-xs font-extrabold px-4 py-2 bg-amber-400 hover:bg-amber-500 text-indigo-950 rounded-full tracking-tight shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
              id="admin-mode-toggle"
            >
              <Shield size={14} className="text-indigo-900 fill-indigo-900/35 animate-pulse" />
              관리자 모드 (교사)
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
