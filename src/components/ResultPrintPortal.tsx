import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, FileSpreadsheet, Check } from 'lucide-react';
import { EvaluationState, Teacher, RegisteredStudent } from '../types';
import { findStudentIdKey, findBirthdateKey, findFeedbackKey, isScoreColumn, matchesStudentId, findTotalScoreKey, isMetadataOrNonScoreHeader, parseClassNumber } from '../utils';
import { cleanAndFormatHeaderName } from '../utils/pdfExtractor';
import { parseNcsHeaderDetails, cleanAndFormatNcsUnitName } from './StudentPdfViewer';

interface ResultPrintPortalProps {
  myEvaluations: EvaluationState[];
  signatures: Record<string, string>;
  loggedTeacher: Teacher;
  subjectMaxScores: Record<string, string>;
  onClose: () => void;
  allStudents?: RegisteredStudent[];
}

export default function ResultPrintPortal({
  myEvaluations,
  signatures,
  loggedTeacher,
  subjectMaxScores,
  onClose,
  allStudents = []
}: ResultPrintPortalProps) {
  // Unique subjects list
  const uniqueSubjects = Array.from(new Set(myEvaluations.map(e => e.subject).filter(Boolean))) as string[];
  const [selectedSubject, setSelectedSubject] = useState(uniqueSubjects[0] || '');

  // Filter evaluations list for selected subject
  const evalsForSubject = myEvaluations.filter(e => e.subject === selectedSubject);

  const normalizeStudentId = (val: string, targetGradeClass?: string): string => {
    const cleaned = val.trim();
    if (!cleaned) return '';

    // 1. If it's already a 5-digit number, return it.
    const onlyDigits = cleaned.replace(/\D/g, '');
    if (onlyDigits.length === 5) {
      return onlyDigits;
    }

    // 2. If it is in a "Class/Number" format like "7/10" or "7-10", parse it
    const classNumInfo = parseClassNumber(cleaned);
    if (classNumInfo && targetGradeClass) {
      const tgtDigits = targetGradeClass.replace(/\D/g, '');
      if (tgtDigits.length >= 3) {
        const grade = tgtDigits.substring(0, 1);
        const cls = classNumInfo.classVal.padStart(2, '0');
        const num = classNumInfo.numberVal.padStart(2, '0');
        return `${grade}${cls}${num}`;
      }
    }

    // 3. If it's just a number (e.g., "1" or "10") representing the student number,
    // and we have a targetGradeClass (e.g., "107" or "107반")
    if (onlyDigits.length > 0 && onlyDigits.length <= 2 && targetGradeClass) {
      const tgtDigits = targetGradeClass.replace(/\D/g, '');
      if (tgtDigits.length >= 3) {
        const gradeClassPart = tgtDigits.substring(0, 3); // e.g. "107"
        const numPart = onlyDigits.padStart(2, '0');
        return `${gradeClassPart}${numPart}`;
      }
    }

    return onlyDigits || cleaned;
  };

  const extractGradeClass = (studentIdStr: string, targetGradeClass?: string): { gradeClass: string; sortKey: number } => {
    const normalized = normalizeStudentId(studentIdStr, targetGradeClass);
    const digits = normalized.replace(/\D/g, '');
    if (digits.length === 5) {
      const grade = parseInt(digits.substring(0, 1), 10);
      const cls = parseInt(digits.substring(1, 3), 10);
      return { gradeClass: `${grade}학년 ${cls}반`, sortKey: grade * 100 + cls };
    } else if (digits.length === 4) {
      const grade = parseInt(digits.substring(0, 1), 10);
      const cls = parseInt(digits.substring(1, 2), 10);
      return { gradeClass: `${grade}학년 ${cls}반`, sortKey: grade * 100 + cls };
    } else if (targetGradeClass && targetGradeClass.replace(/\D/g, '').length >= 3) {
      const tgtDigits = targetGradeClass.replace(/\D/g, '');
      const grade = parseInt(tgtDigits.substring(0, 1), 10);
      const cls = parseInt(tgtDigits.substring(1), 10);
      return { gradeClass: `${grade}학년 ${cls}반`, sortKey: grade * 100 + cls };
    } else {
      const part = studentIdStr.trim().substring(0, Math.min(3, studentIdStr.length));
      return { gradeClass: part ? `${part}그룹` : '기타', sortKey: 9999 };
    }
  };

  // Find unique class cohorts for selected subject
  const [uniqueClasses, setUniqueClasses] = useState<{ gradeClass: string; sortKey: number }[]>([]);
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    const classMap = new Map<string, { gradeClass: string; sortKey: number }>();
    evalsForSubject.forEach(ev => {
      const sIdKey = findStudentIdKey(ev.headers);
      if (!sIdKey) return;
      ev.rows.forEach(r => {
        const val = String(r[sIdKey] || '').trim();
        if (val) {
          const info = extractGradeClass(val, ev.targetGradeClass);
          classMap.set(info.gradeClass, info);
        }
      });
    });

    const list = Array.from(classMap.values())
      .filter(item => !item.gradeClass.includes('그룹') && item.gradeClass !== '기타')
      .sort((a, b) => a.sortKey - b.sortKey);
    setUniqueClasses(list);
    if (list.length > 0) {
      if (!list.some(item => item.gradeClass === selectedClass)) {
        setSelectedClass(list[0].gradeClass);
      }
    } else {
      setSelectedClass('');
    }
  }, [selectedSubject, myEvaluations]);

  // Evaluations matching subject sorted by round
  const sortedEvals = [...evalsForSubject].sort((a, b) => {
    const aNum = parseInt(a.round?.replace(/\D/g, '') || '0', 10);
    const bNum = parseInt(b.round?.replace(/\D/g, '') || '0', 10);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return (a.round || '').localeCompare(b.round || '');
  });

  const getScoreValue = (ev: EvaluationState, rId: string) => {
    const sIdKey = findStudentIdKey(ev.headers);
    if (!sIdKey) return null;
    const r = ev.rows.find(row => {
      const val = String(row[sIdKey] || '').trim();
      const fullStudentId = normalizeStudentId(val, ev.targetGradeClass);
      return matchesStudentId(rId, fullStudentId) || matchesStudentId(rId, val);
    });
    if (!r) return null;

    const feedbackKeys = findFeedbackKey(ev.headers);
    const totalScoreKey = findTotalScoreKey(ev.headers, r, feedbackKeys);

    if (!totalScoreKey) return null;
    const rawVal = parseFloat(String(r[totalScoreKey] || '0').trim());
    return isNaN(rawVal) ? 0 : rawVal;
  };

  // Compile unique roster of students in the selected class cohort
  const [students, setStudents] = useState<{ studentId: string; studentName: string }[]>([]);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      return;
    }

    const studentMap = new Map<string, { studentId: string; studentName: string }>();
    evalsForSubject.forEach(ev => {
      const sIdKey = findStudentIdKey(ev.headers);
      const sNameKey = ev.headers.find(h => 
        String(h).includes('이름') || 
        String(h).includes('성명') || 
        String(h).toLowerCase() === 'name'
      );
      if (!sIdKey) return;
      ev.rows.forEach(r => {
        const idVal = String(r[sIdKey] || '').trim();
        if (idVal && extractGradeClass(idVal, ev.targetGradeClass).gradeClass === selectedClass) {
          const fullStudentId = normalizeStudentId(idVal, ev.targetGradeClass);

          const masterStudent = (allStudents || []).find(s => matchesStudentId(fullStudentId, s.studentId));
          const nameVal = masterStudent 
            ? masterStudent.name 
            : (sNameKey ? String(r[sNameKey] || '').trim() : '');

          studentMap.set(fullStudentId, {
            studentId: fullStudentId,
            studentName: nameVal || `학생 (${idVal})`
          });
        }
      });
    });

    const sortedList = Array.from(studentMap.values()).sort((a, b) => {
      return a.studentId.localeCompare(b.studentId, undefined, { numeric: true, sensitivity: 'base' });
    });
    setStudents(sortedList);
  }, [selectedSubject, selectedClass, myEvaluations, allStudents]);

  const handlePrint = () => {
    window.print();
  };

  const calculateStudentNcsFinalScore = (headers: string[], row: any, fallbackScore: string): string => {
    if (!headers || !row) return fallbackScore;
    const hasNcsHeader = headers.some(h => h.startsWith('[') && h.includes(']'));
    if (!hasNcsHeader) return fallbackScore;

    const ncsGroups: {
      unitName: string;
      percentage: string;
      scores: { areaName: string; score: string }[];
    }[] = [];

    headers.forEach(h => {
      if (isMetadataOrNonScoreHeader(h)) return;

      let scoreVal = String(row[h] !== undefined ? row[h] : '0').trim();
      if (/^\d+\.00$/.test(scoreVal)) {
        scoreVal = parseFloat(scoreVal).toString();
      } else if (/^\d+\.\d+$/.test(scoreVal)) {
        const parsedFloat = parseFloat(scoreVal);
        if (!isNaN(parsedFloat)) {
          scoreVal = parsedFloat.toString();
        }
      }

      const details = parseNcsHeaderDetails(h);
      if (details.isNcs) {
        const isFinal = details.unitName.includes('최종') || details.unitName.includes('결과');
        if (!isFinal) {
          let group = ncsGroups.find(g => g.unitName === details.unitName);
          if (!group) {
            group = {
              unitName: details.unitName,
              percentage: details.percentage,
              scores: []
            };
            ncsGroups.push(group);
          }
          group.scores.push({
            areaName: details.subHeader,
            score: scoreVal
          });
        }
      }
    });

    if (ncsGroups.length === 0) return fallbackScore;

    let calculatedFinalScore = 0;
    let hasValidUnitScore = false;
    ncsGroups.forEach(group => {
      let unitRawScore = 0;
      const hapgeItem = group.scores.find(s => s.areaName.trim() === '합계');
      if (hapgeItem) {
        unitRawScore = parseFloat(hapgeItem.score) || 0;
        hasValidUnitScore = true;
      } else {
        const nonHapgeScores = group.scores.filter(s => s.areaName.trim() !== '합계');
        unitRawScore = nonHapgeScores.reduce((sum, s) => sum + (parseFloat(s.score) || 0), 0);
        if (nonHapgeScores.length > 0) {
          hasValidUnitScore = true;
        }
      }
      const pctVal = parseFloat(group.percentage.replace(/%/g, '')) || 0;
      calculatedFinalScore += unitRawScore * (pctVal / 100);
    });

    if (!hasValidUnitScore) return fallbackScore;

    const formattedFinalScore = Number.isInteger(calculatedFinalScore) 
      ? calculatedFinalScore.toString() 
      : parseFloat(calculatedFinalScore.toFixed(2)).toString();

    return formattedFinalScore;
  };

  const niceEval = evalsForSubject.find(e => e.uploadType === 'pdf' || e.uploadType === 'test_excel_sign');
  const isNiceMode = !!niceEval;

  const niceScoreHeaders = isNiceMode && niceEval ? (niceEval.headers || []).filter(h => {
    const hCleaned = cleanAndFormatHeaderName(h);
    if (isMetadataOrNonScoreHeader(h)) return false;
    const isTotal = [
      '합계', '총점', '총합', '원점수', '합계점수', '득점계'
    ].some(k => hCleaned.replace(/\s+/g, '').includes(k)) || 
    hCleaned.trim() === '계' || hCleaned.trim() === '합' || hCleaned.trim() === '총';
    return !isTotal;
  }) : [];

  const niceTotalHeader = isNiceMode && niceEval ? (niceEval.headers || []).find(h => {
    const hCleaned = cleanAndFormatHeaderName(h);
    const isTotal = [
      '합계', '총점', '총합', '원점수', '합계점수', '득점계'
    ].some(k => hCleaned.replace(/\s+/g, '').includes(k)) || 
    hCleaned.trim() === '계' || hCleaned.trim() === '합' || hCleaned.trim() === '총';
    return isTotal;
  }) : undefined;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 print:static print:bg-white print:overflow-visible print:p-0 print-portal-container">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-0 print:static print:w-full">
        
        {/* Controls Header Area */}
        <div className="bg-indigo-950 px-6 py-4 flex items-center justify-between text-white print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <Printer size={20} className="text-amber-400 stroke-[2.5]" />
            <h2 className="text-base sm:text-lg font-black tracking-tight font-sans">수행평가 일람표 출력</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-xl transition text-slate-350 hover:text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Configuration Area */}
        <div className="bg-slate-50 border-b border-slate-200 p-5 shrink-0 print:hidden flex flex-col md:flex-row items-stretch md:items-center gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {/* Subject Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">출력 평가 과목</label>
              <select 
                value={selectedSubject} 
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-650 min-w-[150px]"
              >
                {uniqueSubjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {/* Class Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">필터링 학급 (반)</label>
              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-650 min-w-[150px]"
                disabled={uniqueClasses.length === 0}
              >
                {uniqueClasses.map(item => (
                  <option key={item.gradeClass} value={item.gradeClass}>{item.gradeClass}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handlePrint}
            disabled={students.length === 0 || !isNiceMode}
            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-extrabold text-white transition cursor-pointer shadow-sm ${
              students.length > 0 && isNiceMode
                ? 'bg-amber-500 hover:bg-amber-600 active:scale-98' 
                : 'bg-slate-300 cursor-not-allowed opacity-50'
            }`}
          >
            <Printer size={15} /> 인쇄하기
          </button>
        </div>

        {/* Live print preview page frame and actual printable element */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0 print:overflow-visible">
          {students.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs italic">
              선택한 과목 및 학급에 대한 등록 성적 학적이 매칭되지 않습니다.
            </div>
          ) : !isNiceMode ? (
            <div className="bg-white max-w-2xl mx-auto rounded-2xl border border-rose-200 p-8 sm:p-10 shadow-sm text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-600">
                <FileSpreadsheet size={32} className="stroke-[2.25]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 font-sans tracking-tight">
                  2단계 나이스 엑셀 파일 미등록 안내 ⚠️
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed break-keep">
                  선택한 과목 <span className="text-rose-600 font-extrabold">[{selectedSubject}]</span>은 2단계 [나이스 확인용 EXCEL 파일]이 업로드되지 않았습니다.
                </p>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto break-keep">
                  최종 서명 일람표는 서명패드가 활성화되는 2단계 나이스 종합 파일을 기준으로 출력할 수 있습니다. 관리자 화면에서 해당 과목의 2단계 나이스 종합 엑셀 자료를 업로드해주시기 바랍니다.
                </p>
              </div>
              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3.5 max-w-md mx-auto">
                <span className="text-[11px] text-rose-800 font-bold block">
                  💡 1단계 영역별 점수 입력 단계에서는 인쇄 기능이 제한됩니다.
                </span>
              </div>
            </div>
          ) : (
            /* Printable Form Page Container: Forces clean 1-sheet layout styles on prints */
            <div 
              id="printable-score-confirmation-sheet" 
              className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs max-w-4xl mx-auto border border-slate-300/80 print:shadow-none print:border-0 print:p-0 print:max-w-none print:w-full"
            >
              
              {/* Printed Heading */}
              <div className="border-b-4 border-double border-slate-800 pb-3 text-center space-y-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">수행평가 영역별 결과 및 서명 확인 제출표</h1>
                <div className="flex justify-between items-center text-xs font-bold text-slate-600 font-mono">
                  <span>교과목명: {selectedSubject}</span>
                  <span>학급: {selectedClass}</span>
                  <span>담당교사: {loggedTeacher.name} 선생님</span>
                </div>
              </div>

              {/* Roster Sheet Data Table */}
              <div className="mt-6 overflow-x-auto print:overflow-visible">
                <table className="w-full text-left border-collapse border border-slate-800 text-[11px] sm:text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-800 text-slate-900 font-black font-sans">
                      <th className="border border-slate-800 px-3 py-2 text-center w-16">순번</th>
                      <th className="border border-slate-800 px-3 py-2 text-center w-28">학번</th>
                      <th className="border border-slate-800 px-3 py-2 text-center w-24">성명</th>
                      
                      {!isNiceMode ? (
                        // Mode A: Excel rounds
                        sortedEvals.map((ev, idx) => {
                          const maxScoreNum = parseFloat(ev.maxScore || '100') || 100;
                          const rateNum = parseFloat(ev.reflectRate || '100') || 100;
                          const reflectedMax = Number((maxScoreNum * (rateNum / 100)).toFixed(2)).toString();
                          return (
                            <th key={ev.id || idx} className="border border-slate-800 px-2 py-2.5 text-center min-w-[90px] max-w-[120px]">
                              <div className="flex flex-col items-center justify-center gap-1.5 leading-tight">
                                {ev.evaluationDetailName && (
                                  <span className="block text-[11px] font-black text-slate-800 break-words whitespace-normal text-center" title={ev.evaluationDetailName}>
                                    {ev.evaluationDetailName}
                                  </span>
                                )}
                                <span className="block text-[9.5px] text-indigo-950 font-black bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                                  만점 {reflectedMax}점
                                </span>
                              </div>
                            </th>
                          );
                        })
                      ) : (
                        // Mode B: Nice Excel areas (2단계 나이스 종합 엑셀)
                        niceScoreHeaders.map((h, idx) => {
                          const details = parseNcsHeaderDetails(h);
                          const hCleaned = cleanAndFormatHeaderName(details.subHeader);
                          
                          // Format cleanly as Title and max score
                          let title = hCleaned;
                          let maxScoreText = '';
                          const match = hCleaned.match(/^([\s\S]+?)\s*\(([\s\S]+?)\)$/);
                          if (match) {
                            title = match[1].trim();
                            maxScoreText = match[2].trim();
                          }

                          let unitLabel = '';
                          if (details.isNcs) {
                            const unitIndexMatch = details.unitName.match(/능력단위\s*(\d+)/i);
                            const uIndex = unitIndexMatch ? parseInt(unitIndexMatch[1], 10) : (idx + 1);
                            unitLabel = cleanAndFormatNcsUnitName(details.unitName, uIndex);
                          }

                          return (
                            <th key={idx} className="border border-slate-800 px-2 py-2 text-center min-w-[90px] max-w-[120px]">
                              <div className="flex flex-col items-center justify-center gap-0.5 leading-tight">
                                {unitLabel && (
                                  <span className="block text-[8.5px] font-black text-rose-650 tracking-tight mb-0.5 whitespace-nowrap bg-rose-50 border border-rose-100 px-1 py-0.2 rounded">
                                    {unitLabel}
                                  </span>
                                )}
                                <span className="block text-[10.5px] font-extrabold text-slate-850 break-words whitespace-normal text-center">
                                  {title}
                                </span>
                                {maxScoreText && (
                                  <span className="block text-[9px] text-indigo-950 font-black bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.2 mt-0.5">
                                    {maxScoreText}
                                  </span>
                                )}
                              </div>
                            </th>
                          );
                        })
                      )}

                      <th className="border border-slate-800 px-3 py-2 text-center w-24">산출총점</th>
                      <th className="border border-slate-800 px-3 py-2 text-center w-36">확인 서명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, sIdx) => {
                      const studentIdKey = niceEval ? findStudentIdKey(niceEval.headers || []) : undefined;
                      const niceRow = niceEval && studentIdKey 
                        ? niceEval.rows.find(row => {
                            const val = String(row[studentIdKey] || '').trim();
                            let fullStudentId = val;
                            if (val.replace(/\D/g, '').length <= 2 && niceEval.targetGradeClass && niceEval.targetGradeClass.replace(/\D/g, '').length >= 3) {
                              const tgtDigits = niceEval.targetGradeClass.replace(/\D/g, '');
                              const numPart = val.replace(/\D/g, '').padStart(2, '0');
                              fullStudentId = tgtDigits + numPart;
                            }
                            return matchesStudentId(student.studentId, fullStudentId) || matchesStudentId(student.studentId, val);
                          })
                        : null;

                      // Calculate overall integrated reflected total score (Mode A / Mode B)
                      let displayedReflectedObtained = '';
                      let courseMaxScore = 0;

                      if (!isNiceMode) {
                        let reflectedObtainedSum = 0;
                        let totalReflectedMax = 0;

                        sortedEvals.forEach(ev => {
                          const sVal = getScoreValue(ev, student.studentId);
                          if (sVal !== null) {
                            const maxScoreNum = parseFloat(ev.maxScore || '100') || 100;
                            const rateNum = parseFloat(ev.reflectRate || '100') || 100;
                            reflectedObtainedSum += sVal * (rateNum / 100);
                            totalReflectedMax += maxScoreNum * (rateNum / 100);
                          }
                        });

                        const customSettingKey = `${loggedTeacher.code.trim()}_${selectedSubject.trim()}`;
                        const customMaxStr = subjectMaxScores[customSettingKey] || '';
                        displayedReflectedObtained = Number(reflectedObtainedSum.toFixed(2)).toString();
                        courseMaxScore = customMaxStr ? parseFloat(customMaxStr) : totalReflectedMax;
                      } else {
                        // 2단계 나이스 종합 엑셀 Mode
                        const rawTotalVal = niceRow && niceTotalHeader ? String(niceRow[niceTotalHeader] || '0').trim() : '0';
                        const totalNum = parseFloat(rawTotalVal);
                        const fallbackVal = isNaN(totalNum) ? rawTotalVal : totalNum.toString();

                        displayedReflectedObtained = calculateStudentNcsFinalScore(
                          niceEval?.headers || [],
                          niceRow,
                          fallbackVal
                        );

                        // Parse max score of total header
                        let totalMaxVal = 100;
                        let isTotalExplicit = false;
                        if (niceTotalHeader) {
                          const maxMatch = niceTotalHeader.match(/만점\s*([\d.]+)/) || niceTotalHeader.match(/배점\s*([\d.]+)/) || niceTotalHeader.match(/만점\s*(\d+)/) || niceTotalHeader.match(/\((\d+)점\)/) || niceTotalHeader.match(/\(([\d.]+)점\)/);
                          if (maxMatch && maxMatch[1]) {
                            totalMaxVal = parseFloat(maxMatch[1]);
                            isTotalExplicit = true;
                          } else {
                            const numMatch = niceTotalHeader.match(/\(\s*([\d.]+)\s*\)?/) || niceTotalHeader.match(/\[\s*([\d.]+)\s*\]?/);
                            if (numMatch && numMatch[1]) {
                              totalMaxVal = parseFloat(numMatch[1]);
                              isTotalExplicit = true;
                            }
                          }
                        }

                        // Parse max score from each individual area/score header and sum them up as fallback
                        let sumOfAreasMaxScore = 0;
                        niceScoreHeaders.forEach(h => {
                          let areaMax = 0;
                          const maxMatch = h.match(/만점\s*([\d.]+)/) || h.match(/배점\s*([\d.]+)/) || h.match(/만점\s*(\d+)/) || h.match(/\((\d+)점\)/) || h.match(/\(([\d.]+)점\)/);
                          if (maxMatch && maxMatch[1]) {
                            areaMax = parseFloat(maxMatch[1]);
                          } else {
                            const numMatch = h.match(/\(\s*([\d.]+)\s*\)?/) || h.match(/\[\s*([\d.]+)\s*\]?/);
                            if (numMatch && numMatch[1]) {
                              areaMax = parseFloat(numMatch[1]);
                            }
                          }
                          sumOfAreasMaxScore += areaMax;
                        });

                        if ((!isTotalExplicit || totalMaxVal === 100 || totalMaxVal === 0) && sumOfAreasMaxScore > 0) {
                          totalMaxVal = sumOfAreasMaxScore;
                        }

                        courseMaxScore = totalMaxVal;
                      }

                      // Query student signature URL from Firestore signals with robust ID matching
                      const teacherKey = loggedTeacher.code.trim();
                      const subjectKey = selectedSubject.trim();
                      const printStudentId = student.studentId.trim();

                      let studentSigUrl = '';
                      const foundSigKey = Object.keys(signatures).find(key => {
                        const parts = key.split('_');
                        if (parts.length >= 3) {
                          const [sigTeacher, sigSubject, sigStudent] = parts;
                          return sigTeacher.trim() === teacherKey && 
                                 sigSubject.trim() === subjectKey && 
                                 matchesStudentId(sigStudent, printStudentId);
                        }
                        return false;
                      });
                      if (foundSigKey) {
                        studentSigUrl = signatures[foundSigKey];
                      }

                      return (
                        <tr key={student.studentId} className="border-b border-slate-800 hover:bg-slate-50 text-slate-800 font-medium">
                          <td className="border border-slate-800 px-3 py-1.5 text-center font-mono">{sIdx + 1}</td>
                          <td className="border border-slate-800 px-3 py-1.5 text-center font-mono font-black">{student.studentId}</td>
                          <td className="border border-slate-800 px-3 py-1.5 text-center truncate">{student.studentName || '미입력'}</td>

                          {/* Individual evaluation rounds / areas */}
                          {!isNiceMode ? (
                            sortedEvals.map(ev => {
                              const val = getScoreValue(ev, student.studentId);
                              const rateNum = parseFloat(ev.reflectRate || '100') || 100;
                              const reflectedVal = val !== null ? val * (rateNum / 100) : null;
                              const displayedVal = reflectedVal !== null 
                                ? Number(reflectedVal.toFixed(2)).toString() 
                                : '-';

                              return (
                                <td key={ev.id} className="border border-slate-800 px-2 py-1.5 text-center font-mono text-[12px]">
                                  <span className="font-extrabold text-slate-900">{displayedVal}</span>
                                </td>
                              );
                            })
                          ) : (
                            niceScoreHeaders.map((h, hIdx) => {
                              const scoreVal = niceRow ? String(niceRow[h] || '0').trim() : '-';
                              let displayedVal = scoreVal;
                              if (/^\d+\.00$/.test(scoreVal)) {
                                displayedVal = parseFloat(scoreVal).toString();
                              } else if (/^\d+\.\d+$/.test(scoreVal)) {
                                const parsedFloat = parseFloat(scoreVal);
                                if (!isNaN(parsedFloat)) {
                                  displayedVal = parsedFloat.toString();
                                }
                              }

                              return (
                                <td key={hIdx} className="border border-slate-800 px-2 py-1.5 text-center font-mono text-[12px]">
                                  <span className="font-extrabold text-slate-900">{displayedVal}</span>
                                </td>
                              );
                            })
                          )}

                          {/* Cumulative total score */}
                          <td className="border border-slate-800 px-3 py-1.5 text-center font-sans font-black bg-slate-50/50">
                            {displayedReflectedObtained}
                            <span className="text-[10px] text-slate-400 font-normal"> / {courseMaxScore}</span>
                          </td>

                          {/* Delineated Signature col */}
                          <td className="border border-slate-800 px-2 py-1 text-center bg-slate-50/20 w-36">
                            {studentSigUrl ? (
                              <div className="flex items-center justify-center p-0.5" title="제출 완료">
                                <img src={studentSigUrl} alt="서명" className="h-[34px] max-w-[120px] object-contain block print:h-[34px]" referrerPolicy="no-referrer" />
                              </div>
                            ) : (
                              <div className="text-[9px] text-slate-350 border border-dashed border-slate-300 rounded-sm py-1 font-bold print:border-0 print:p-0 print:text-transparent">
                                 미서명
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Printable footer area */}
              <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-450 leading-relaxed gap-2 print:border-slate-800">
                <span>※ 본 성적 일람표는 {new Date().toLocaleDateString('ko-KR')} 일자로 출력되었습니다.</span>
                <span className="font-bold border-b border-slate-800 pb-0.5 text-slate-700">담당 교사 서명: __________________ (인)</span>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
