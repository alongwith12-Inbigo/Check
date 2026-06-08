import React from 'react';
import { 
  ArrowLeft, 
  Printer, 
  Award,
  BookOpen,
  MessageSquare,
  ClipboardCheck,
  Calendar,
  Layers,
  Percent
} from 'lucide-react';
import { StudentSession } from '../types';
import { findStudentIdKey, findBirthdateKey, findFeedbackKey, isScoreColumn } from '../utils';

interface ResultCardProps {
  sessionData: StudentSession;
  onBack: () => void;
}

export default function ResultCard({ sessionData, onBack }: ResultCardProps) {
  const { studentName, studentId, teacherName, results } = sessionData;

  const handlePrint = () => {
    window.print();
  };

  // Compute stats across all evaluations
  const totalEvalsCount = results.length;

  return (
    <div id="student-result-container" className="w-full max-w-3xl mx-auto space-y-6 pb-12 animate-fadeIn print:shadow-none print:border-0 print:p-0">
      
      {/* Top action bar */}
      <div className="flex justify-between items-center print:hidden px-2">
        <button 
          onClick={onBack}
          className="group flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 transition cursor-pointer"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition" /> 뒤로 가기 (선생님 선택 화면)
        </button>
        
        <button 
          onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 border border-slate-350 rounded-xl bg-white hover:bg-slate-50 transition cursor-pointer shadow-xs"
        >
          <Printer size={14} /> 종합 성적표 인쇄 / PDF 저장
        </button>
      </div>

      {/* Main Student identity overview banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6 print:border print:border-slate-300 print:text-black print:bg-white">
        <div className="absolute top-0 right-0 p-4 opacity-5 print:hidden">
          <Award size={120} className="stroke-[1.5]" />
        </div>

        <div className="space-y-2 relative z-10">
          <span className="bg-amber-400 text-slate-950 text-[10px] md:text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full inline-flex items-center gap-1">
            🏫 수행평가 평가 결과 종합 분석 통보서
          </span>
          <h1 className="text-xl sm:text-2.5xl font-black tracking-tight leading-snug font-sans">
            {teacherName} 선생님 담당 교과 성적표
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 font-semibold print:text-slate-700">
            <span className="flex items-center gap-1"><Layers size={13} /> 등록 수행평가 수: <strong>{totalEvalsCount}개</strong></span>
          </div>
        </div>

        <div className="bg-white/10 border border-white/10 p-4 sm:p-5 rounded-2xl min-w-[200px] text-center md:text-left relative z-10 print:border-slate-300 print:bg-slate-50">
          <span className="text-[10px] text-slate-300 font-black tracking-wider uppercase block print:text-slate-500">인증 조회 정규 수신자</span>
          <div className="text-base sm:text-lg font-extrabold text-white mt-1 flex flex-col gap-0.5 print:text-black">
            <span>학번 : <strong className="font-black text-amber-300 print:text-indigo-900">{studentId}</strong></span>
            <span>성명 : <strong className="font-black text-amber-300 print:text-indigo-900">{studentName}</strong></span>
          </div>
        </div>
      </div>

      {/* Grid: Listing evaluations card details */}
      <div className="space-y-6">
        {results.map((item, index) => {
          const { headers, row, evaluationTitle, subject, round, evaluationDetailName, maxScore } = item;
          
          const studentIdKey = findStudentIdKey(headers);
          const birthdateKey = findBirthdateKey(headers);
          const feedbackKeys = findFeedbackKey(headers);

          // Score metrics (sub-scores)
          const scoreKeys = headers.filter(h => {
            if (h === studentIdKey || h === birthdateKey || feedbackKeys.includes(h)) return false;
            if (String(h).includes('이름') || String(h).includes('성명')) return false;
            return isScoreColumn(h, row[h]);
          });

          // Identify total score column (e.g. 합계, 총점)
          const totalScoreKey = scoreKeys.find(h => {
            const norm = String(h).replace(/\s+/g, '').toLowerCase();
            return norm.includes('합계') || norm.includes('총점') || norm.includes('총합') || norm.includes('최종') || norm.includes('합산');
          }) || scoreKeys[scoreKeys.length - 1]; // defaults to last score column if not found

          // Score keys for the list, excluding the total score key to avoid duplicate columns
          const subScoreKeys = scoreKeys.filter(k => k !== totalScoreKey);

          // Checks if any feedback actually exists and has been entered
          const hasAnyFeedback = feedbackKeys.some(key => {
            const feedbackVal = row[key];
            return feedbackVal !== undefined && feedbackVal !== null && String(feedbackVal).trim() !== '';
          });

          return (
            <div 
              key={item.evaluationId} 
              className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden print:border print:border-slate-350 print:shadow-none break-inside-avoid-page"
            >
              {/* Header Title Section for individual evaluations */}
              <div className="bg-slate-50 border-b border-slate-150 p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:bg-slate-100">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-900 rounded-xl mt-0.5 print:bg-slate-200">
                    <ClipboardCheck size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase print:bg-white">
                      평가 {index + 1}
                    </span>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 mt-1">
                      {subject} ({round}차) 수행평가 : {evaluationDetailName}
                    </h2>
                  </div>
                </div>

                {maxScore && (
                  <span className="text-[11px] bg-slate-200/60 border border-slate-300 font-bold px-3 py-1 rounded-xl text-slate-700 font-mono self-start sm:self-center">
                    만점 기준: {maxScore}점
                  </span>
                )}
              </div>

              {/* Dynamic Card Body for metrics */}
              <div className="p-6 sm:p-7 space-y-6">
                
                {/* 1. Sub-scores visual metric cards row */}
                {subScoreKeys.length > 0 && (
                  <div className="space-y-2">
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      영역별 세부 채점 점수
                    </span>
                    
                    <div className="flex flex-row flex-nowrap gap-1.5 sm:gap-2 justify-stretch items-center w-full overflow-x-auto pb-1 scrollbar-none">
                      {subScoreKeys.map(key => {
                        const val = row[key];
                        return (
                          <div 
                            key={key} 
                            className="flex-1 min-w-[65px] sm:min-w-[80px] bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center transition-colors hover:border-slate-300 print:bg-white print:border-slate-200"
                          >
                            <span className="block text-[9.5px] sm:text-[10.5px] font-bold text-slate-500 truncate" title={key}>
                              {key}
                            </span>
                            <span className="block text-xs sm:text-base font-black text-slate-800 mt-0.5 font-mono">
                              {val !== undefined && val !== null ? String(val) : '-'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Total Sum Score large horizontal highlight banner */}
                {totalScoreKey && (
                  <div className="bg-indigo-50/55 border border-indigo-100 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 print:bg-slate-50 print:border-slate-200">
                    <div className="text-center sm:text-left space-y-0.5">
                      <span className="text-[10px] bg-white border border-indigo-150 rounded-md font-bold px-2 py-0.5 text-indigo-850 inline-block">
                        합산 평가
                      </span>
                      <h4 className="text-sm sm:text-base font-extrabold text-slate-900 mt-1">
                        {subject} {String(round).endsWith('차') ? round : `${round}차`} 수행평가
                      </h4>
                    </div>
                    
                    <div className="text-center sm:text-right">
                      <span className="text-2.5xl sm:text-3xl font-black text-indigo-950 font-sans tracking-tight">
                        {row[totalScoreKey] || '0'}
                      </span>
                      <span className="text-xs text-slate-400 font-bold ml-1">
                        / {maxScore || '100'} 점
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Personalized Teacher's comments and Feedback markup bubble */}
                {hasAnyFeedback ? (
                  <div className="space-y-3 pt-1">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare size={13} className="text-slate-400" />
                      담당 선생님의 지도 성취 결과 및 개별 코멘트
                    </h3>

                    <div className="space-y-3">
                      {feedbackKeys.map(key => {
                        const feedbackVal = row[key];
                        if (feedbackVal === undefined || feedbackVal === null || String(feedbackVal).trim() === '') return null;

                        return (
                          <div 
                            key={key} 
                            className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 relative overflow-hidden print:bg-white print:border-slate-250"
                          >
                            <span className="text-[10px] font-black text-indigo-805 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md inline-block print:bg-slate-100">
                              🎯 {key}
                            </span>
                            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-semibold mt-3 whitespace-pre-wrap">
                              {String(feedbackVal)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl text-center text-[10px] font-semibold text-slate-400 italic">
                    등록된 상세 서술형 피드백 의견이 없습니다.
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>

      {/* Safety Legal Notice trustfooter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-3 print:hidden">
        <span>※ 본 조회 서비스의 성적 데이터 소유권과 관리 권한은 본교 담당 교과 선생님께 있습니다.</span>
        <span className="font-mono text-slate-500">인쇄하거나 화면을 캡처하여 증빙 및 이의 제기 시 제출해 주십시오.</span>
      </div>

    </div>
  );
}
