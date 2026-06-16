import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, FileSpreadsheet, Check } from 'lucide-react';
import { EvaluationState, Teacher, RegisteredStudent } from '../types';
import { findStudentIdKey, findBirthdateKey, findFeedbackKey, isScoreColumn, matchesStudentId } from '../utils';

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

  const extractGradeClass = (studentIdStr: string): { gradeClass: string; sortKey: number } => {
    const digits = studentIdStr.replace(/\D/g, '');
    if (digits.length === 5) {
      const grade = parseInt(digits.substring(0, 1), 10);
      const cls = parseInt(digits.substring(1, 3), 10);
      return { gradeClass: `${grade}학년 ${cls}반`, sortKey: grade * 100 + cls };
    } else if (digits.length === 4) {
      const grade = parseInt(digits.substring(0, 1), 10);
      const cls = parseInt(digits.substring(1, 2), 10);
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
          const info = extractGradeClass(val);
          classMap.set(info.gradeClass, info);
        }
      });
    });

    const list = Array.from(classMap.values()).sort((a, b) => a.sortKey - b.sortKey);
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
      const val = String(row[sIdKey] || '').trim().replace(/\D/g, '');
      const studentDigits = rId.replace(/\D/g, '');
      return val === studentDigits && val !== '';
    });
    if (!r) return null;

    const birthdateKey = findBirthdateKey(ev.headers);
    const feedbackKeys = findFeedbackKey(ev.headers);
    const scoreKeys = ev.headers.filter(h => {
      if (h === sIdKey || h === birthdateKey || feedbackKeys.includes(h)) return false;
      if (String(h).includes('이름') || String(h).includes('성명')) return false;
      return isScoreColumn(h, r[h]);
    });

    const totalScoreKey = scoreKeys.find(h => {
      const norm = String(h).replace(/\s+/g, '').toLowerCase();
      return norm.includes('합계') || norm.includes('총점') || norm.includes('총합') || norm.includes('최종') || norm.includes('합산');
    }) || scoreKeys[scoreKeys.length - 1];

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
        if (idVal && extractGradeClass(idVal).gradeClass === selectedClass) {
          const masterStudent = (allStudents || []).find(s => matchesStudentId(idVal, s.studentId));
          const nameVal = masterStudent 
            ? masterStudent.name 
            : (sNameKey ? String(r[sNameKey] || '').trim() : '');

          studentMap.set(idVal, {
            studentId: idVal,
            studentName: nameVal || `학생 (${idVal})`
          });
        }
      });
    });

    const sortedList = Array.from(studentMap.values()).sort((a, b) => {
      return a.studentId.localeCompare(b.studentId, undefined, { numeric: true, sensitivity: 'base' });
    });
    setStudents(sortedList);
  }, [selectedSubject, selectedClass, myEvaluations]);

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-4 print:static print:bg-white print:overflow-visible print:p-0 print-portal-container">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-0 print:static print:w-full">
        
        {/* Controls Header Area */}
        <div className="bg-indigo-950 px-6 py-4 flex items-center justify-between text-white print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <Printer size={20} className="text-amber-400 stroke-[2.5]" />
            <h2 className="text-base sm:text-lg font-black tracking-tight font-sans">학생 수행평가 점수 확인 출력 대기소</h2>
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
            disabled={students.length === 0}
            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-extrabold text-white transition cursor-pointer shadow-sm ${
              students.length > 0 
                ? 'bg-amber-500 hover:bg-amber-600 active:scale-98' 
                : 'bg-slate-300 cursor-not-allowed opacity-50'
            }`}
          >
            <Printer size={15} /> 인쇄하기 / PDF 저장 (1장 규격)
          </button>
        </div>

        {/* Live print preview page frame and actual printable element */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0 print:overflow-visible">
          {students.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs italic">
              선택한 과목 및 학급에 대한 등록 성적 학적이 매칭되지 않습니다.
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
                  <span>학급 분반: {selectedClass}</span>
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
                      
                      {/* Active evaluation headers matching rounds */}
                      {sortedEvals.map((ev, idx) => {
                        const maxScoreNum = parseFloat(ev.maxScore || '100') || 100;
                        const rateNum = parseFloat(ev.reflectRate || '100') || 100;
                        const reflectedMax = Number((maxScoreNum * (rateNum / 100)).toFixed(2)).toString();
                        return (
                          <th key={ev.id || idx} className="border border-slate-800 px-2 py-2 text-center">
                            <div className="leading-tight">
                              <span className="block font-black">{ev.round || `${idx + 1}차`}</span>
                              <span className="block text-[8px] text-slate-500 font-normal">반영{rateNum}%</span>
                              <span className="block text-[9px] text-indigo-900 font-bold mt-0.5">
                                만점 {reflectedMax}점
                              </span>
                            </div>
                          </th>
                        );
                      })}

                      <th className="border border-slate-800 px-3 py-2 text-center w-24">산출총점</th>
                      <th className="border border-slate-800 px-3 py-2 text-center w-36">확인 서명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, sIdx) => {
                      // Calculate overall integrated reflected total score
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
                      
                      const displayedReflectedObtained = customMaxStr 
                        ? Number(((reflectedObtainedSum / (totalReflectedMax || 1)) * (parseFloat(customMaxStr) || 100)).toFixed(2)).toString()
                        : Number(reflectedObtainedSum.toFixed(2)).toString();

                      const courseMaxScore = customMaxStr ? parseFloat(customMaxStr) : totalReflectedMax;

                      // Query student signature URL from Firestore signals
                      const signatureKey = `${loggedTeacher.code.trim()}_${selectedSubject.trim()}_${student.studentId.trim()}`;
                      const studentSigUrl = signatures[signatureKey];

                      return (
                        <tr key={student.studentId} className="border-b border-slate-800 hover:bg-slate-50 text-slate-800 font-medium">
                          <td className="border border-slate-800 px-3 py-1.5 text-center font-mono">{sIdx + 1}</td>
                          <td className="border border-slate-800 px-3 py-1.5 text-center font-mono font-black">{student.studentId}</td>
                          <td className="border border-slate-800 px-3 py-1.5 text-center truncate">{student.studentName || '미입력'}</td>

                          {/* Individual evaluation rounds */}
                          {sortedEvals.map(ev => {
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
                          })}

                          {/* Cumulative total score */}
                          <td className="border border-slate-800 px-3 py-1.5 text-center font-sans font-black bg-slate-50/50">
                            {displayedReflectedObtained}
                            <span className="text-[10px] text-slate-400 font-normal"> / {courseMaxScore}</span>
                          </td>

                          {/* Delineated Signature col */}
                          <td className="border border-slate-800 px-2 py-1 text-center bg-slate-50/20 w-36">
                            {studentSigUrl ? (
                              <div className="flex items-center justify-center p-0.5" title="제출 완료">
                                <img src={studentSigUrl} alt="서명" className="h-[21px] max-w-[120px] object-contain block" referrerPolicy="no-referrer" />
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
                <span>※ 본 성적 대리표는 {new Date().toLocaleDateString('ko-KR')} 일자로 시스템에서 출력되었습니다.</span>
                <span className="font-bold border-b border-slate-800 pb-0.5 text-slate-700">담임/담당교과교사 서명: __________________ (인)</span>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
