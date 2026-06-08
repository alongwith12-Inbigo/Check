import React from 'react';
import { 
  ArrowLeft, 
  Award, 
  HelpCircle, 
  ClipboardCheck, 
  Flame, 
  User, 
  MessageSquare, 
  Printer, 
  BookmarkCheck,
  TrendingUp
} from 'lucide-react';
import { EvaluationState } from '../types';
import { findStudentIdKey, findBirthdateKey, findFeedbackKey, isScoreColumn } from '../utils';

interface ResultCardProps {
  evaluationState: EvaluationState;
  studentData: Record<string, any>;
  onBack: () => void;
}

export default function ResultCard({ evaluationState, studentData, onBack }: ResultCardProps) {
  const { headers } = evaluationState;

  const studentIdKey = findStudentIdKey(headers);
  const birthdateKey = findBirthdateKey(headers);
  const feedbackKeys = findFeedbackKey(headers);

  // Identify student's identity variables (Academic columns: 학번, 이름, 학과 등)
  const identityKeys = headers.filter(h => {
    const norm = String(h).toLowerCase();
    return norm.includes('이름') || norm.includes('성명') || norm === studentIdKey || norm === birthdateKey;
  });

  // Score metrics
  const scoreKeys = headers.filter(h => {
    if (identityKeys.includes(h) || feedbackKeys.includes(h)) return false;
    return isScoreColumn(h, studentData[h]);
  });

  // Other columns (regular properties)
  const generalKeys = headers.filter(h => {
    return !identityKeys.includes(h) && !feedbackKeys.includes(h) && !scoreKeys.includes(h);
  });

  const handlePrint = () => {
    window.print();
  };

  const studentName = studentData['이름'] || studentData['성명'] || '';
  const studentIdVal = studentIdKey ? studentData[studentIdKey] : '';

  return (
    <div id="student-result-container" className="w-full max-w-3xl mx-auto space-y-6 pb-12 animate-fadeIn print:shadow-none print:border-0 print:p-0">
      
      {/* Top action bar */}
      <div className="flex justify-between items-center print:hidden px-2">
        <button 
          onClick={onBack}
          className="group flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition" /> 뒤로 가기
        </button>
        
        <button 
          onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 transition cursor-pointer"
        >
          <Printer size={14} /> 인쇄 / PDF 저장
        </button>
      </div>

      {/* Main Grade Card */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden print:border-0 print:shadow-none">
        
        {/* Banner with student detail context */}
        <div className="bg-indigo-900 text-white p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 print:hidden text-white">
            <Award size={100} className="stroke-[1.5]" />
          </div>
          <p className="text-amber-400 text-xs font-extrabold uppercase tracking-widest">{evaluationState.title || '성적 조회 결과'}</p>
          
          <div className="flex items-center gap-3.5 mt-3">
            <div className="p-2.5 bg-white/10 border border-white/10 rounded-xl flex items-center justify-center text-white shrink-0">
              <User size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-extrabold font-sans flex items-center gap-2 tracking-tight text-white">
                {studentName ? `${studentName} 학생의` : '귀하의'} 상세 조회 내역
              </h2>
              {/* Identity tag badges row */}
              <div className="flex flex-wrap gap-2 mt-2">
                {identityKeys.map(key => {
                  const val = studentData[key];
                  if (val === undefined || val === null || val === '') return null;
                  return (
                    <span key={key} className="bg-indigo-950/50 border border-indigo-800/80 text-indigo-200 text-[11px] px-3 py-0.5 rounded-full font-mono font-medium">
                      {key}: <strong className="text-white font-bold">{String(val)}</strong>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Card Body */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Section 1: Scores (Hanging / Highlighting) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp size={14} className="text-slate-400" />
              평가 및 점수 지표 (실시간 강조 영역)
            </h3>
            
            {scoreKeys.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 text-slate-500 text-xs rounded-xl italic">
                표시할 세부 점수 항목이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {scoreKeys.map(key => {
                  const scoreVal = studentData[key];
                  // Let's check if the score is actually a number, so we can stylize further
                  const isNum = !isNaN(Number(scoreVal)) && scoreVal !== '';
                  const numVal = isNum ? Number(scoreVal) : null;

                  return (
                    <div 
                      key={key} 
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden transition-all hover:scale-[1.01]"
                    >
                      {/* Interactive score visual decoration inside */}
                      <div className="absolute top-1 right-2 opacity-[0.03] text-indigo-900">
                        <Flame size={44} />
                      </div>
                      
                      <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 truncate" title={key}>
                        {key}
                      </span>
                      
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-3xl font-black font-sans text-slate-800 leading-none">
                          {scoreVal !== undefined && scoreVal !== null ? String(scoreVal) : '-'}
                        </span>
                        {isNum && <span className="text-xs text-slate-400 font-semibold ml-0.5">점</span>}
                      </div>

                      {/* Display small indicator for outstanding score (e.g. 90+ or perfect) */}
                      {numVal !== null && numVal >= 90 && (
                        <span className="absolute bottom-2 right-2 bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase tracking-wider">
                          최우수
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: General Evaluation Attributes */}
          {generalKeys.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <BookmarkCheck size={14} className="text-slate-400" />
                기타 등급 및 판정 속성
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {generalKeys.map(key => {
                  const val = studentData[key];
                  return (
                    <div key={key} className="bg-slate-50 border border-slate-250 p-4 rounded-xl">
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">{key}</span>
                      <span className="text-sm font-extrabold text-slate-800">{val !== undefined && val !== null ? String(val) : '-'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Primary Feedback & Reason Broad Placement (GIGANTIC card at bottom) */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare size={14} className="text-slate-400" />
              선생님의 맞춤형 종합 코멘트 및 피드백 (사유 영역)
            </h3>

            {feedbackKeys.length === 0 ? (
              <div className="p-4 bg-slate-50 text-slate-400 text-xs border border-slate-200 rounded-xl flex items-center gap-1.5">
                <ClipboardCheck size={16} /> 등록된 개별 교사 코멘트가 존재하지 않습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {feedbackKeys.map(key => {
                  const feedbackVal = studentData[key];
                  if (feedbackVal === undefined || feedbackVal === null || feedbackVal === '') return null;

                  return (
                    <div 
                      key={key} 
                      className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100 relative overflow-hidden"
                    >
                      <div className="pb-3 justify-between flex items-center border-b border-indigo-100/50 mb-4 text-indigo-900">
                        <span className="text-xs font-extrabold tracking-wider text-indigo-700 bg-white border border-indigo-100 px-3 py-1 rounded-md inline-block">
                          🎯 세부 {key} 내역
                        </span>
                        <span className="text-[10px] text-indigo-500/80 font-bold print:hidden flex items-center gap-1">
                          개별 비공개 열람 보증
                        </span>
                      </div>
                      
                      {/* Quoted block layout with generous reading size */}
                      <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                        {String(feedbackVal)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer info message */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2 print:hidden">
          <span>※ 본 조회 서비스의 성적 데이터 소유권은 교과 담당 선생님께 귀속되어 있습니다.</span>
          <span className="font-mono text-slate-500">인쇄 혹은 화면 캡처본을 활용해 성적 이의신청 시 근거로 제출해 주세요.</span>
        </div>
      </div>
    </div>
  );
}
