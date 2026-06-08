import React from 'react';
import { 
  ArrowLeft, 
  Printer, 
  Award,
  BookmarkCheck,
  MessageSquare,
  ClipboardCheck
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

  // Identify student's identity variables
  const identityKeys = headers.filter(h => {
    const norm = String(h).toLowerCase();
    // Keep name and ID, but exclude birthdate completely for display
    return (norm.includes('이름') || norm.includes('성명') || norm === studentIdKey) && norm !== birthdateKey;
  });

  // Score metrics (sub-scores)
  const scoreKeys = headers.filter(h => {
    if (h === studentIdKey || h === birthdateKey || feedbackKeys.includes(h)) return false;
    // Exclude name and identity columns
    if (String(h).includes('이름') || String(h).includes('성명')) return false;
    return isScoreColumn(h, studentData[h]);
  });

  const handlePrint = () => {
    window.print();
  };

  const studentName = studentData['이름'] || studentData['성명'] || '';
  const studentIdVal = studentIdKey ? studentData[studentIdKey] : '';

  // 1. Identify total score column (e.g. 합계, 총점)
  const totalScoreKey = scoreKeys.find(h => {
    const norm = String(h).replace(/\s+/g, '').toLowerCase();
    return norm.includes('합계') || norm.includes('총점') || norm.includes('총합') || norm.includes('최종') || norm.includes('합산');
  }) || scoreKeys[scoreKeys.length - 1]; // defaults to last score column if not found

  // Score keys for the list, excluding the total score key to avoid duplicate columns
  const subScoreKeys = scoreKeys.filter(k => k !== totalScoreKey);

  // Checks if any feedback actually exists and has been entered
  const hasAnyFeedback = feedbackKeys.some(key => {
    const feedbackVal = studentData[key];
    return feedbackVal !== undefined && feedbackVal !== null && String(feedbackVal).trim() !== '';
  });

  return (
    <div id="student-result-container" className="w-full max-w-2xl mx-auto space-y-6 pb-12 animate-fadeIn print:shadow-none print:border-0 print:p-0">
      
      {/* Top action bar */}
      <div className="flex justify-between items-center print:hidden px-2">
        <button 
          onClick={onBack}
          className="group flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 transition cursor-pointer"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition" /> 뒤로 가기
        </button>
        
        <button 
          onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border border-slate-350 rounded-xl bg-white hover:bg-slate-50 transition cursor-pointer"
        >
          <Printer size={14} /> 인쇄 / PDF 저장
        </button>
      </div>

      {/* Main Grade Card */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden print:border-0 print:shadow-none">
        
        {/* Banner - Prominent Title Layout */}
        <div className="bg-indigo-900 text-white p-6 sm:p-8 relative overflow-hidden text-center sm:text-left">
          <div className="absolute top-0 right-0 p-4 opacity-5 print:hidden">
            <Award size={100} className="stroke-[1.5]" />
          </div>

          {/* Title - Largest Text Element */}
          <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-snug font-sans text-amber-300">
            {evaluationState.subject || '과목'} ({evaluationState.round || '1'}차) 수행평가: {evaluationState.evaluationDetailName || '종합 평가'}
          </h1>

          {/* Student Identity Display - Prominent Name and ID */}
          <div className="mt-4 pt-3 border-t border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-left">
              <span className="text-indigo-200 text-xs font-bold uppercase tracking-wider block">조회 대상 학생 정보</span>
              <div className="text-lg sm:text-xl font-extrabold flex items-baseline gap-3 mt-1 text-white">
                <span>학번: <strong className="font-black text-amber-200">{studentIdVal}</strong></span>
                <span>이름: <strong className="font-black text-amber-200">{studentName}</strong></span>
              </div>
            </div>
            {evaluationState.maxScore && (
              <span className="text-xs sm:text-sm bg-indigo-950/60 border border-indigo-700 font-extrabold px-3 py-1.5 rounded-xl text-yellow-400 self-start sm:self-center">
                {evaluationState.maxScore}점 만점 기준
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Card Body */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Section 1: All Sub-scores structured on a single horizontal row */}
          {subScoreKeys.length > 0 && (
            <div className="space-y-2">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                세부 영역별 평가 점수
              </span>
              
              {/* Force elements onto a single row with flex-nowrap on screen, wrapping if extremely tiny */}
              <div className="flex flex-row flex-wrap sm:flex-nowrap gap-2 justify-stretch items-center w-full">
                {subScoreKeys.map(key => {
                  const val = studentData[key];
                  return (
                    <div 
                      key={key} 
                      className="flex-1 min-w-[75px] bg-slate-50 border border-slate-200 rounded-xl p-3 text-center transition-all hover:border-slate-350"
                    >
                      <span className="block text-[10px] font-black text-slate-500 truncate" title={key}>
                        {key}
                      </span>
                      <span className="block text-sm sm:text-base font-black text-slate-800 mt-1 font-mono">
                        {val !== undefined && val !== null ? String(val) : '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Core Final Total Score display banner (Requested syntax format) */}
          {totalScoreKey && (
            <div className="bg-indigo-50/70 border-2 border-indigo-150 rounded-2xl p-5 shadow-xs text-center transition-all">
              <div className="inline-block px-3 py-1 bg-white border border-indigo-200/55 rounded-full text-[10px] font-black text-indigo-800 uppercase tracking-wider mb-2.5">
                최종 합산 점수
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-normal">
                {evaluationState.subject || '과목'} {' '}
                {evaluationState.round || '1'}차 수행평가{' '}
                {evaluationState.maxScore ? `(${evaluationState.maxScore}점 만점)` : ''} : {' '}
                <span className="text-xl sm:text-2xl font-black text-indigo-900 font-sans ml-1">
                  {studentData[totalScoreKey] || '0'}점
                </span>
              </h3>
            </div>
          )}

          {/* Section 3: Teacher Comments - Render ONLY if completed/written by teacher */}
          {hasAnyFeedback ? (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-650 uppercase tracking-widest flex items-center gap-1.5">
                <MessageSquare size={14} className="text-slate-400" />
                이름, 평가 결과 및 피드백
              </h3>

              <div className="space-y-4">
                {feedbackKeys.map(key => {
                  const feedbackVal = studentData[key];
                  if (feedbackVal === undefined || feedbackVal === null || String(feedbackVal).trim() === '') return null;

                  return (
                    <div 
                      key={key} 
                      className="bg-indigo-50/40 rounded-2xl p-5 border border-indigo-100 relative overflow-hidden"
                    >
                      <div className="pb-2.5 justify-between flex items-center border-b border-indigo-100/50 mb-3.5 text-indigo-950">
                        <span className="text-[11px] font-black tracking-tight text-indigo-800 bg-white border border-indigo-100 px-2.5 py-1 rounded-md inline-block">
                          🎯 {key}
                        </span>
                        <span className="text-[10px] text-indigo-600/70 font-bold print:hidden">
                          개별 비공개 열람 보증
                        </span>
                      </div>
                      
                      <p className="text-xs sm:text-sm text-slate-705 leading-relaxed font-semibold whitespace-pre-wrap">
                        {String(feedbackVal)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

        </div>

        {/* Footer info message */}
        <div className="bg-slate-50 p-4 border-t border-slate-150 text-center text-[10px] sm:text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2 print:hidden">
          <span>※ 본 조회 서비스의 성적 데이터 소유권은 교과 담당 선생님께 귀속되어 있습니다.</span>
          <span className="font-mono text-slate-500">인쇄 혹은 화면 캡처본을 활용해 성적 문의 시 근거로 제출해 주세요.</span>
        </div>
      </div>
    </div>
  );
}
