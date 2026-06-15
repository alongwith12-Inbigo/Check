import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Printer, 
  Award,
  BookOpen,
  MessageSquare,
  ClipboardCheck,
  Calendar,
  Layers,
  Percent,
  Info
} from 'lucide-react';
import { StudentSession } from '../types';
import { findStudentIdKey, findBirthdateKey, findFeedbackKey, isScoreColumn } from '../utils';
import SignatureCanvas from './SignatureCanvas';

interface ResultCardProps {
  sessionData: StudentSession;
  onBack: () => void;
  subjectMaxScores?: Record<string, string>;
  signatures?: Record<string, string>;
  signatureEnabled?: boolean;
  onSaveSignature?: (subject: string, studentId: string, studentName: string, signatureDataUrl: string) => void | Promise<void>;
  onDeleteSignature?: (subject: string, studentId: string) => void | Promise<void>;
}

export default function ResultCard({ 
  sessionData, 
  onBack, 
  subjectMaxScores = {},
  signatures = {},
  signatureEnabled = false,
  onSaveSignature,
  onDeleteSignature
}: ResultCardProps) {
  const { studentName, studentId, teacherName, results, teacherCode } = sessionData;
  const [isSavingSig, setIsSavingSig] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  // Sort evaluations in ascending order of round (1차 -> 2차 -> ... -> n차)
  const sortedResults = [...results].sort((a, b) => {
    const aNum = parseInt(a.round.replace(/\D/g, ''), 10);
    const bNum = parseInt(b.round.replace(/\D/g, ''), 10);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    if (!isNaN(aNum)) return -1;
    if (!isNaN(bNum)) return 1;
    return a.round.localeCompare(b.round);
  });

  // Calculate cumulative aggregates
  let aggregateRawObtained = 0;
  let aggregateRawMax = 0;
  let aggregateReflectedObtained = 0;
  let aggregateReflectedMax = 0;

  sortedResults.forEach(item => {
    const studentIdKey = findStudentIdKey(item.headers);
    const birthdateKey = findBirthdateKey(item.headers);
    const feedbackKeys = findFeedbackKey(item.headers);

    const scoreKeys = item.headers.filter(h => {
      if (h === studentIdKey || h === birthdateKey || feedbackKeys.includes(h)) return false;
      if (String(h).includes('이름') || String(h).includes('성명')) return false;
      return isScoreColumn(h, item.row[h]);
    });

    const totalScoreKey = scoreKeys.find(h => {
      const norm = String(h).replace(/\s+/g, '').toLowerCase();
      return norm.includes('합계') || norm.includes('총점') || norm.includes('총합') || norm.includes('최종') || norm.includes('합산');
    }) || scoreKeys[scoreKeys.length - 1];

    if (totalScoreKey) {
      const rawScoreVal = parseFloat(String(item.row[totalScoreKey] || '0').trim());
      const computedTotalScore = isNaN(rawScoreVal) ? 0 : rawScoreVal;
      const maxScoreNum = parseFloat(item.maxScore || '100') || 100;
      const rateNum = parseFloat(item.reflectRate || '100') || 100;

      aggregateRawObtained += computedTotalScore;
      aggregateRawMax += maxScoreNum;

      aggregateReflectedObtained += computedTotalScore * (rateNum / 100);
      aggregateReflectedMax += maxScoreNum * (rateNum / 100);
    }
  });

  const formattedAggregateReflectedObtained = Number(aggregateReflectedObtained.toFixed(2)).toString();
  const formattedAggregateRawObtained = Number(aggregateRawObtained.toFixed(2)).toString();

  // Find overall subject's performance max score
  const sampleResult = sortedResults[0];
  const tCode = (teacherCode || sampleResult?.teacherCode || '').trim();
  const subjName = (sampleResult?.subject || '').trim();
  const settingKey = `${tCode}_${subjName}`;
  const customMaxScoreStr = subjectMaxScores[settingKey] || '';
  const courseMaxScore = customMaxScoreStr ? parseFloat(customMaxScoreStr) : aggregateReflectedMax;

  // Compute stats across all evaluations
  const totalEvalsCount = sortedResults.length;

  return (
    <div id="student-result-container" className="w-full max-w-3xl mx-auto space-y-6 pb-12 animate-fadeIn print:shadow-none print:border-0 print:p-0">
      
      {/* Top action bar */}
      <div className="flex justify-between items-center print:hidden px-2">
        <button 
          onClick={onBack}
          className="group flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 transition cursor-pointer"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition" /> 뒤로 가기
        </button>       
        
      </div>

      {/* Main Student identity overview banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6 print:border print:border-slate-300 print:text-black print:bg-white">
        <div className="absolute top-0 right-0 p-4 opacity-5 print:hidden">
          <Award size={120} className="stroke-[1.5]" />
        </div>

        <div className="space-y-2 relative z-10">
          <span className="bg-amber-400 text-slate-950 text-[10px] md:text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full inline-flex items-center gap-1">
            🏫 수행평가 결과 조회
          </span>
          <h1 className="text-xl sm:text-2.5xl font-black tracking-tight leading-snug font-sans">
            {teacherName} 선생님 담당 교과 성적표
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 font-semibold print:text-slate-700">
            <span className="flex items-center gap-1"><Layers size={13} /> 등록된 수행평가 수: <strong>{totalEvalsCount}개</strong></span>
          </div>
        </div>

        <div className="bg-white/10 border border-white/10 p-4 sm:p-5 rounded-2xl min-w-[200px] text-center md:text-left relative z-10 print:border-slate-300 print:bg-slate-50">
          <span className="text-[10px] text-slate-300 font-black tracking-wider uppercase block print:text-slate-500">점수 조회 학생</span>
          <div className="text-base sm:text-lg font-extrabold text-white mt-1 flex flex-col gap-0.5 print:text-black">
            <span>학번 : <strong className="font-black text-amber-300 print:text-indigo-900">{studentId}</strong></span>
            <span>성명 : <strong className="font-black text-amber-300 print:text-indigo-900">{studentName}</strong></span>
          </div>
        </div>
      </div>

      {/* Grid: Listing evaluations card details */}
      <div className="space-y-6">
        {sortedResults.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 font-medium">
            <Info className="mx-auto text-slate-400 mb-2.5" size={32} />
            선택한 {teacherName} 선생님님이 업로드하신 {studentName} ({studentId}) 학생의 수행평가 점수 정보가 아직 등록되지 않았습니다.
          </div>
        )}
        {sortedResults.map((item, index) => {
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
                    영역 만점: {maxScore}점
                  </span>
                )}
              </div>

              {/* Dynamic Card Body for metrics */}
              <div className="p-6 sm:p-7 space-y-6">
                
                {/* 1. Sub-scores visual metric cards row */}
                {subScoreKeys.length > 0 && (
                  <div className="space-y-2">
                    <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      영역별 세부 점수
                    </span>
                    
                    <div className="flex flex-row flex-nowrap gap-1.5 sm:gap-2 justify-stretch items-center w-full overflow-x-auto pb-1 scrollbar-none">
                      {subScoreKeys.map(key => {
                        const val = row[key];
                        
                        // Parse brackets or parentheses at the end of the key (e.g. "함수 활용 (6점)" or "함수 활용[6점]")
                        const formatKey = (str: string) => {
                          const match = str.match(/^([\s\S]+?)\s*([\(\[][^()\[\]]+[\)\]])$/);
                          if (match) {
                            return {
                              title: match[1].trim(),
                              scoreLimit: match[2].trim()
                            };
                          }
                          return { title: str, scoreLimit: null };
                        };

                        const { title, scoreLimit } = formatKey(key);

                        return (
                          <div 
                            key={key} 
                            className="flex-1 min-w-[65px] sm:min-w-[80px] bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center transition-colors hover:border-slate-300 print:bg-white print:border-slate-200 flex flex-col justify-between"
                          >
                            <div>
                              <span className="block text-[9.5px] sm:text-[10.5px] font-bold text-slate-500 leading-tight break-keep" title={key}>
                                {title}
                              </span>
                              {scoreLimit && (
                                <span className="block text-[8.5px] sm:text-[9.5px] font-semibold text-slate-400 mt-0.5 leading-none break-keep">
                                  {scoreLimit}
                                </span>
                              )}
                            </div>
                            <span className="block text-xs sm:text-base font-black text-slate-800 mt-1.5 font-mono">
                              {val !== undefined && val !== null ? String(val) : '-'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Total Sum Score large horizontal highlight banner */}
                {totalScoreKey && (() => {
                  const rawScoreVal = parseFloat(String(row[totalScoreKey] || '0').trim());
                  const computedTotalScore = isNaN(rawScoreVal) ? 0 : rawScoreVal;
                  const maxScoreNum = parseFloat(maxScore || '100') || 100;
                  const rateNum = parseFloat(item.reflectRate || '100') || 100;

                  const reflectedValue = computedTotalScore * (rateNum / 100);
                  const reflectedMaxScore = maxScoreNum * (rateNum / 100);
                  const calculationFormula = `원점수 ${computedTotalScore}점 × ${rateNum}%`;

                  const formattedReflectedValue = Number(reflectedValue.toFixed(2)).toString();
                  const formattedReflectedMaxScore = Number(reflectedMaxScore.toFixed(2)).toString();

                  return (
                    <div className="space-y-3">
                      {/* Box 1: 영역 합산 점수 */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center print:bg-white print:border-slate-300">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-slate-200 border border-slate-350 rounded font-black px-2 py-0.5 text-slate-700">
                              영역 합산 점수
                            </span>
                          </div>
                          <h4 className="text-xs font-black text-slate-800 mt-1">
                            {subject} {String(round).endsWith('차') ? round : `${round}차`} 취득 원점수
                          </h4>
                        </div>
                        <div className="text-right">
                          <span className="text-xl sm:text-2xl font-black text-slate-800 font-mono">
                            {computedTotalScore}
                          </span>
                          <span className="text-xs text-slate-400 font-bold ml-1">
                            / {maxScoreNum} 점 만점
                          </span>
                        </div>
                      </div>

                      {/* Box 2: 실제 성적 반영 점수 */}
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex justify-between items-center print:bg-white print:border-slate-300">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-indigo-100 border border-indigo-200 rounded font-black px-2 py-0.5 text-indigo-850">
                              실제 성적 반영 점수
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              (반영 비율: {rateNum}%)
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium font-mono">
                            성적 반영 공식 : <span className="font-bold text-indigo-900">{calculationFormula} = {formattedReflectedValue}점 (영역 만점: {maxScoreNum}점 × {rateNum}% = {formattedReflectedMaxScore}점 만점)</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl sm:text-3xl font-black text-indigo-950 font-sans tracking-tight">
                            {formattedReflectedValue}
                          </span>
                          <span className="text-xs text-slate-400 font-bold ml-1">
                            / {formattedReflectedMaxScore} 점 만점
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Personalized Teacher's comments and Feedback markup bubble */}
                {hasAnyFeedback ? (
                  <div className="space-y-3 pt-1">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare size={13} className="text-slate-400" />
                      선생님의 피드백
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
                    등록된 피드백 의견이 없습니다.
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>

      {/* Cumulative Final Report Section */}
      <div className="bg-indigo-50/50 border border-indigo-150 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xs print:bg-white print:text-black print:border-2 print:border-slate-800 space-y-5">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none print:hidden">
          <Award size={140} className="stroke-[1.5] text-indigo-500" />
        </div>

        <div className="flex items-center gap-2.5 relative z-10">
          <div className="p-2 bg-indigo-100 text-indigo-950 rounded-xl print:bg-slate-200 print:text-black">
            <Award size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-indigo-950 print:text-black leading-tight">
              {subjName ? `${subjName} 수행평가 총점` : '수행평가 최종 총점'}
            </h2>
          </div>
        </div>

        <div className="relative z-10">
          {/* Reflected Real Score Sum Box */}
          <div className="bg-white border border-indigo-100/70 rounded-2xl p-5 sm:p-6 print:bg-slate-50 print:border-slate-200">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
              <div className="text-center sm:text-left space-y-1">
                <span className="text-[10.5px] font-extrabold text-indigo-850 uppercase tracking-widest block">
                  👑 실제 최종 성적 반영 총점
                </span>
                <p className="text-[11px] text-slate-500 leading-normal font-semibold">
                  각 영역별 만점과 실제 성적 반영 비율(%)을 가중 계산하여 종합한 최종 수행평가 성적 누적 점수입니다.
                </p>
              </div>
              <div className="text-center sm:text-right shrink-0">
                <span className="text-4xl sm:text-5xl font-black text-indigo-950 font-sans tracking-tight">
                  {formattedAggregateReflectedObtained}
                </span>
                <span className="text-sm font-bold text-slate-400 ml-1">
                  / {courseMaxScore} 점 만점
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Student Signature Block */}
      {signatureEnabled && (
        <div id="student-signature-block" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 print:border-2 print:border-slate-850">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            ✒️ 수행평가 결과 확인 학생 최종 서명
          </h3>
          <p className="text-[11px] text-slate-500 leading-normal">
            본인의 수행평가 총점과 상세 세부 성적을 직접 정확히 확인하였으며, 이에 서명합니다.
          </p>

          {(() => {
            const signatureKey = `${tCode}_${subjName}_${studentId.trim()}`;
            const savedSignature = signatures[signatureKey] || '';

            if (savedSignature) {
              return (
                <div className="bg-emerald-50/50 border border-emerald-250 rounded-2xl p-4 flex flex-col items-center justify-center gap-2.5">
                  <div className="text-xs font-black text-emerald-850 flex items-center gap-1">
                    🎉 학생 확인 서명이 완료되었습니다 (제출 완료)
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3 max-w-[220px] overflow-hidden flex items-center justify-center shadow-xs">
                    <img src={savedSignature} alt="학생 서명" className="h-14 object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-mono font-bold">서명 제출 일시 기록됨</span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm("제출한 서명을 삭제하고 다시 새롭게 서명하시겠습니까?")) {
                          if (onDeleteSignature) {
                            await onDeleteSignature(subjName, studentId);
                          }
                        }
                      }}
                      className="mt-1 text-[11px] font-black text-red-500 hover:text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg px-2.5 py-1.5 transition cursor-pointer shadow-2xs active:scale-95"
                    >
                      🗑️ 서명 삭제 후 다시 작성하기
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <SignatureCanvas 
                onSave={async (dataUrl) => {
                  if (onSaveSignature) {
                    setIsSavingSig(true);
                    try {
                      await onSaveSignature(subjName, studentId, studentName, dataUrl);
                    } finally {
                      setIsSavingSig(false);
                    }
                  }
                }}
                isLoading={isSavingSig}
              />
            );
          })()}
        </div>
      )}

      {/* Safety Legal Notice trustfooter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-3 print:hidden">
        <span>※ 본 조회 서비스의 성적 데이터 소유권과 관리 권한은 담당 교과 선생님께 있습니다.</span>        
      </div>

    </div>
  );
}
