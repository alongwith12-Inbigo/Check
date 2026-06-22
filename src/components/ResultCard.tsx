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
  Info,
  FileText,
  Download,
  Key,
  Lock,
  CheckCircle
} from 'lucide-react';
import { StudentSession, EvaluationState, Teacher, StudentResultItem, RegisteredStudent } from '../types';
import { findStudentIdKey, findBirthdateKey, findFeedbackKey, isScoreColumn, matchesStudentId, findTotalScoreKey, findNameKey, findGradeKey, findClassKey, findNumberKey, findClassNumberKey, parseClassNumber, extractGradeFromTarget } from '../utils';
import SignatureCanvas from './SignatureCanvas';
import StudentPdfViewer from './StudentPdfViewer';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface ResultCardProps {
  sessionData: StudentSession;
  onBack: () => void;
  subjectMaxScores?: Record<string, string>;
  subjectCompletionStates?: Record<string, boolean>;
  signatures?: Record<string, string>;
  teacherSettings?: Record<string, boolean>;
  onSaveSignature?: (subject: string, studentId: string, studentName: string, signatureDataUrl: string, teacherCode: string) => void | Promise<void>;
  onDeleteSignature?: (subject: string, studentId: string, teacherCode: string) => void | Promise<void>;
  allEvaluations: EvaluationState[];
  teachers: Teacher[];
  allStudents?: RegisteredStudent[];
}

export default function ResultCard({ 
  sessionData, 
  onBack, 
  subjectMaxScores = {},
  subjectCompletionStates = {},
  signatures = {},
  teacherSettings = {},
  onSaveSignature,
  onDeleteSignature,
  allEvaluations,
  teachers,
  allStudents = []
}: ResultCardProps) {
  const { studentId } = sessionData;
  const [isSavingSig, setIsSavingSig] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [showSavedFeedbackModal, setShowSavedFeedbackModal] = useState(false);

  // Dynamic overlay state to replace iframe-unsafe window.confirm
  const [deleteSignatureModal, setDeleteSignatureModal] = useState<{
    subject: string;
    studentId: string;
  } | null>(null);

  // States for password changing
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  // Robust student name resolution
  const resolvedStudent = allStudents.find(s => matchesStudentId(studentId, s.studentId));
  
  let evaluationMatchedName = '';
  for (const ev of allEvaluations) {
    const idKey = findStudentIdKey(ev.headers);
    if (!idKey) continue;
    const row = ev.rows.find(r => matchesStudentId(studentId, r[idKey]));
    if (row) {
      const nKey = ev.headers.find(h => {
        const norm = String(h).replace(/\s+/g, '').toLowerCase();
        return norm.includes('이름') || norm.includes('성명') || norm.includes('학생명') || norm.includes('학생') || norm === 'name';
      });
      if (nKey && row[nKey]) {
        evaluationMatchedName = String(row[nKey]).trim();
        break;
      }
    }
  }

  const studentName = resolvedStudent 
    ? resolvedStudent.name 
    : (sessionData.studentName || evaluationMatchedName || `학생 (${studentId})`);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    const cleanPassword = newPassword.trim();
    if (!cleanPassword) {
      setPasswordError('새 비밀번호를 입력해 주세요.');
      return;
    }

    if (cleanPassword !== confirmPassword.trim()) {
      setPasswordError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      const docRef = doc(db, 'students', studentId);
      await setDoc(docRef, {
        studentId: studentId,
        name: studentName,
        birthdate: sessionData.birthdate,
        password: cleanPassword,
        isPasswordChanged: true
      }, { merge: true });

      setPasswordSuccess('비밀번호가 성공적으로 변경되었습니다. 다음 로그인부터는 설정한 비밀번호를 사용해 주세요.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setPasswordSuccess('');
      }, 2500);
    } catch (err) {
      setPasswordError('비밀번호 변경 중 에러가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      console.error(err);
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const studentGradeClass = studentId.replace(/\D/g, '').slice(0, 3);

  // Determine if teacher entered evaluation for this student's grade/class
  const getTeacherGradeClassMatch = (evalItem: EvaluationState, targetGradeClass: string) => {
    if (evalItem.uploadType === 'pdf') {
      const targetClasses = String(evalItem.targetGradeClass || '')
        .split(',')
        .map(c => c.trim().replace(/\D/g, ''))
        .filter(Boolean);
      const cleanTargetClass = targetGradeClass.replace(/\D/g, '');
      return targetClasses.length === 0 || targetClasses.includes(cleanTargetClass);
    }

    const studentIdKey = findStudentIdKey(evalItem.headers);
    if (!studentIdKey) return false;
    return evalItem.rows.some(row => {
      const rawId = String(row[studentIdKey] || '').replace(/\D/g, '');
      return rawId.startsWith(targetGradeClass);
    });
  };

  const matchedTeachers = teachers.filter(t => {
    const teacherEvals = allEvaluations.filter(e => e.teacherCode === t.code);
    return teacherEvals.some(ev => getTeacherGradeClassMatch(ev, studentGradeClass));
  });

  // State to hold the chosen teacher code
  const [selectedTeacherCode, setSelectedTeacherCode] = useState<string>(() => {
    return matchedTeachers[0]?.code || '';
  });

  // Keep selected teacher code in sync if list updates
  React.useEffect(() => {
    if (matchedTeachers.length > 0) {
      if (!matchedTeachers.some(t => t.code === selectedTeacherCode)) {
        setSelectedTeacherCode(matchedTeachers[0].code);
      }
    } else {
      setSelectedTeacherCode('');
    }
  }, [matchedTeachers, selectedTeacherCode]);

  const activeTeacher = matchedTeachers.find(t => t.code === selectedTeacherCode);
  const teacherName = activeTeacher ? activeTeacher.name : '교과 담당';
  const teacherCode = selectedTeacherCode;

  // Dynamically compute the results for this student from the chosen teacher
  const activeTeacherEvaluations = allEvaluations.filter(e => e.teacherCode === selectedTeacherCode);
  
  const results: StudentResultItem[] = [];
  activeTeacherEvaluations.forEach(evalItem => {
    // If it's PDF Summary Type
    if (evalItem.uploadType === 'pdf') {
      const targetClasses = String(evalItem.targetGradeClass || '')
        .split(',')
        .map(c => c.trim().replace(/\D/g, ''))
        .filter(Boolean);

      const cleanStudentClass = studentGradeClass.replace(/\D/g, '');
      const isClassMatched = targetClasses.length === 0 || targetClasses.includes(cleanStudentClass);

      if (isClassMatched) {
        const studentIdKey = findStudentIdKey(evalItem.headers || []);
        let foundRow: any = {};
        if (studentIdKey && evalItem.rows && evalItem.rows.length > 0) {
          foundRow = evalItem.rows.find(row => matchesStudentId(studentId, row[studentIdKey])) || {};
        }

        results.push({
          evaluationId: evalItem.id || '',
          evaluationTitle: evalItem.title,
          subject: evalItem.subject || '과목',
          round: evalItem.round || '1',
          evaluationDetailName: evalItem.evaluationDetailName || '전체 결과 통지',
          maxScore: evalItem.maxScore || '100',
          reflectRate: evalItem.reflectRate || '105', // Default reflection placeholder
          headers: evalItem.headers || [],
          row: foundRow,
          teacherCode: evalItem.teacherCode || '',
          uploadType: 'pdf',
          pdfBase64: evalItem.pdfBase64 || '',
          pdfFileName: evalItem.pdfFileName || '',
          targetGradeClass: evalItem.targetGradeClass || ''
        });
      }
      return;
    }

    // Default Excel Type
    const studentIdKey = findStudentIdKey(evalItem.headers);
    if (!studentIdKey) return;

    const foundRow = evalItem.rows.find(row => matchesStudentId(studentId, row[studentIdKey]));
    if (foundRow) {
      results.push({
        evaluationId: evalItem.id || '',
        evaluationTitle: evalItem.title,
        subject: evalItem.subject || '과목',
        round: evalItem.round || '1',
        evaluationDetailName: evalItem.evaluationDetailName || '종합 수행평가',
        maxScore: evalItem.maxScore || '',
        reflectRate: evalItem.reflectRate || '100',
        headers: evalItem.headers,
        row: foundRow,
        teacherCode: evalItem.teacherCode || '',
        uploadType: 'excel'
      });
    }
  });

  const signatureEnabled = results.some(r => r.uploadType === 'pdf');

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
    if (item.uploadType === 'pdf') return;

    const feedbackKeys = findFeedbackKey(item.headers);
    const totalScoreKey = findTotalScoreKey(item.headers, item.row, feedbackKeys);

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
  const isSubjectCompleted = !!subjectCompletionStates[settingKey];

  // Compute stats across all evaluations
  const totalEvalsCount = sortedResults.length;

  return (
    <div id="student-result-container" className="w-full max-w-3xl mx-auto space-y-6 pb-12 animate-fadeIn print:shadow-none print:border-0 print:p-0">
      
      {/* Floating success banner */}
      {showSavedFeedback && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white font-extrabold px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3.5 z-[100] border border-emerald-500 animate-bounce text-xs shrink-0 select-none">
          <span className="text-base">🎉</span>
          <div className="flex flex-col">
            <span className="font-extrabold text-white text-[12.5px]">서명 저장 완료!</span>
            <span className="text-[10px] text-emerald-105 font-medium">수행평가 성적 확인 서명이 저장되었습니다.</span>
          </div>
        </div>
      )}
      
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center print:hidden gap-3 px-2 bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="group flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 transition cursor-pointer shrink-0"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition" /> 뒤로 가기
          </button>

          <button 
            onClick={() => setIsChangePasswordOpen(true)}
            className="flex items-center gap-1.5 text-xs font-black text-amber-970 hover:text-amber-950 transition-all shrink-0 bg-amber-400 hover:bg-amber-500 border border-amber-300 px-4 py-2.5 rounded-xl hover:scale-[1.02] shadow-sm cursor-pointer"
          >
            <Key size={14} className="text-amber-950 animate-pulse" /> 비밀번호 변경하기 🔑
          </button>
        </div>

        {matchedTeachers.length > 0 ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-black text-indigo-950 shrink-0 select-none">
              📘 과목 선생님 :
            </span>
            <select
              value={selectedTeacherCode}
              onChange={(e) => setSelectedTeacherCode(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 w-full sm:w-auto min-w-[200px]"
            >
              {matchedTeachers.map((tea) => {
                const teaEvalsCount = allEvaluations.filter(e => e.teacherCode === tea.code && (
                  e.uploadType === 'pdf' 
                  ? (() => {
                      const targetClasses = String(e.targetGradeClass || '')
                        .split(',')
                        .map(c => c.trim().replace(/\D/g, ''))
                        .filter(Boolean);
                      return targetClasses.length === 0 || targetClasses.includes(studentGradeClass.replace(/\D/g, ''));
                    })()
                  : e.rows.some(r => {
                      const studentIdKey = findStudentIdKey(e.headers);
                      return studentIdKey && matchesStudentId(studentId, r[studentIdKey]);
                    })
                )).length;
                return (
                  <option key={tea.code} value={tea.code}>
                    [{tea.code}] {tea.name} 선생님 ({teaEvalsCount}개 영역)
                  </option>
                );
              })}
            </select>
          </div>
        ) : (
          <span className="text-xs text-rose-500 font-extrabold bg-rose-50/50 px-3 py-1.5 rounded-xl border border-rose-150 select-none">
            ⚠️ 해당 학년반에 등록된 교과 수행평가가 존재하지 않습니다.
          </span>
        )}
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
          <span className="text-[10px] text-slate-300 font-black tracking-wider uppercase block print:text-slate-500 font-sans">점수 조회 학생</span>
          <div className="text-base sm:text-lg font-extrabold text-white mt-1 flex flex-col gap-0.5 print:text-black">
            <span>학번 : <strong className="font-black text-amber-300 print:text-indigo-900">{studentId}</strong></span>
            <span>성명 : <strong className="font-black text-amber-300 print:text-indigo-900">{studentName}</strong></span>
          </div>
        </div>
      </div>

      {/* Visual Division: Part 1 and Part 2 */}
      <div className="space-y-10">
        
        {/* ==========================================
            [PART 1]: 영역별 구체적인 점수 및 피드백 (Excel 자료)
           ========================================== */}
        <div id="part1-excel-feedback-section" className="space-y-4">
          <div className="border-l-4 border-indigo-600 pl-3.5 py-1 bg-indigo-50/30 rounded-r-2xl pr-4 flex items-center justify-between gap-3 shadow-3xs">
            <div>
              <h2 className="text-xs sm:text-sm font-black text-indigo-950 flex items-center gap-1.5">
                <BookOpen size={15} className="text-indigo-600" />
                Part 1. 수행평가 영역별 상세 점수 및 피드백 (Excel 자료)
              </h2>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                왜 점수가 감점되었는지, 어떤 평가를 받았는지 상세 세부 내역과 정보교과 선생님의 개별 피드백을 안내합니다.
              </p>
            </div>
            <span className="text-[9px] font-black bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded border border-indigo-200 shrink-0 select-none">문항별 상세분석용</span>
          </div>

          <div className="space-y-5">
            {(() => {
              const excelResults = sortedResults.filter(item => item.uploadType !== 'pdf');
              if (excelResults.length === 0) {
                return (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs font-semibold shadow-xxs">
                    <Info className="mx-auto text-slate-300 mb-1.5" size={24} />
                    아직 등록된 수행평가 영역별 세부 엑셀 성적이나 피드백 데이터가 없습니다.
                  </div>
                );
              }

              return excelResults.map((item, index) => {
                const { headers, row, evaluationTitle, subject, round, evaluationDetailName, maxScore } = item;
                const formattedRound = round
                  ? (round.endsWith('차') || round.endsWith('차수') ? round : `${round}차`)
                  : '';
                
                const feedbackKeys = findFeedbackKey(headers);
                const totalScoreKey = findTotalScoreKey(headers, row, feedbackKeys);
                
                const studentIdKey = findStudentIdKey(headers);
                const birthdateKey = findBirthdateKey(headers);
                const nameKey = findNameKey(headers);
                const gradeKey = findGradeKey(headers);
                const classKey = findClassKey(headers);
                const numberKey = findNumberKey(headers);

                // Score metrics (sub-scores)
                const scoreKeys = headers.filter(h => {
                  if (h === studentIdKey || h === birthdateKey || h === nameKey || h === gradeKey || h === classKey || h === numberKey || feedbackKeys.includes(h)) return false;
                  return isScoreColumn(h, row[h]);
                });

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
                          <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md uppercase print:bg-white">
                            수행영역 {index + 1}
                          </span>
                          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 mt-1">
                            {subject} 수행평가 : {evaluationDetailName}
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
                            영역별 세부 채점 내역
                          </span>
                          
                          <div className="flex flex-wrap gap-2 sm:gap-2.5 w-full justify-start items-stretch">
                            {subScoreKeys.map(key => {
                              const val = row[key];
                              
                              const formatKey = (val: any) => {
                                const str = String(val || '');
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

                              const itemWidthClass = 
                                subScoreKeys.length === 1 ? "w-full" :
                                subScoreKeys.length === 2 ? "w-[calc(50%-4px)] sm:w-[calc(50%-6px)]" :
                                subScoreKeys.length === 3 ? "w-[calc(50%-4px)] sm:w-[calc(33.33%-7px)]" :
                                "w-[calc(50%-4px)] sm:w-[calc(25%-8px)]";

                              return (
                                <div 
                                  key={key} 
                                  className={`${itemWidthClass} min-w-[100px] bg-slate-50/70 border border-slate-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3.5 text-center transition-colors hover:border-slate-300 print:bg-white print:border-slate-200 flex flex-col justify-between shadow-xs shrink-0 grow`}
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

                        if (rateNum === 100) {
                          return (
                            <div className="space-y-3">
                              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex justify-between items-center print:bg-white print:border-slate-350">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-indigo-100 border border-indigo-200 rounded font-black px-2 py-0.5 text-indigo-900">
                                      수행평가 반영 점수 (100% 반영)
                                    </span>
                                  </div>
                                  <h4 className="text-xs font-black text-slate-800 mt-1">
                                    {subject} {formattedRound ? `${formattedRound} ` : ''}수행 점수
                                  </h4>
                                </div>
                                <div className="text-right">
                                  <span className="text-2xl sm:text-3xl font-black text-indigo-950 font-sans tracking-tight">
                                    {computedTotalScore}
                                  </span>
                                  <span className="text-xs text-slate-400 font-bold ml-1">
                                    / {maxScoreNum} 점 만점
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {/* Box 1: 영역 합산 점수 */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center print:bg-white print:border-slate-300">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] bg-slate-200 border border-slate-300 rounded font-black px-2 py-0.5 text-slate-700">
                                    영역 합산 원점수
                                  </span>
                                </div>
                                <h4 className="text-xs font-black text-slate-800 mt-1">
                                  {subject} {formattedRound ? `${formattedRound} ` : ''}수행 원점수
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
                            선생님의 개별 맞춤 지도 피드백
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
                          등록된 선생님의 상세 의견 피드백이 없습니다.
                        </div>
                      )}

                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Cumulative Final Report Section (Moved to the end of Part 1) */}
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
                  <div className="text-center sm:text-right shrink-0 flex flex-col items-center sm:items-end gap-1.5">
                    <div className="flex items-baseline gap-1 justify-center sm:justify-end">
                      <span className="text-4xl sm:text-5xl font-black text-indigo-950 font-sans tracking-tight">
                        {formattedAggregateReflectedObtained}
                      </span>
                      <span className="text-sm font-bold text-slate-400">
                        / {courseMaxScore} 점 만점
                      </span>
                    </div>
                    {!isSubjectCompleted && (
                      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold bg-amber-50 text-amber-800 border border-amber-250/70 px-2.5 py-1 rounded-lg select-none">
                        <span>⚠️</span> 전체 영역 입력 전
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==========================================
            [PART 2]: 나이스 최종 입력 점수 확인 (PDF 자료)
           ========================================== */}
        <div id="part2-pdf-neis-section" className="space-y-4">
          <div className="border-l-4 border-rose-600 pl-3.5 py-1 bg-rose-50/30 rounded-r-2xl pr-4 flex items-center justify-between gap-3 shadow-3xs">
            <div>
              <h2 className="text-xs sm:text-sm font-black text-rose-950 flex items-center gap-1.5">
                <FileText size={15} className="text-rose-600" />
                Part 2. 나이스 최종 입력 점수 확인용 성적표 (PDF 자료)
              </h2>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                나이스(NEIS) 확인용
              </p>
            </div>
            <span className="text-[9px] font-black bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded border border-rose-200 shrink-0 select-none">나이스 확정용</span>
          </div>

          <div className="space-y-5">
            {(() => {
              const pdfResults = sortedResults.filter(item => item.uploadType === 'pdf');
              if (pdfResults.length === 0) {
                return (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs font-semibold shadow-xxs">
                    <Info className="mx-auto text-slate-300 mb-1.5" size={24} />
                    나이스 PDF 파일(최종 성적 확인용)이 아직 등록되지 않았습니다.
                  </div>
                );
              }

              return pdfResults.map((item) => {
                return (
                  <StudentPdfViewer 
                    key={item.evaluationId}
                    pdfBase64={item.pdfBase64 || ''}
                    studentId={studentId}
                    studentName={studentName}
                    headers={item.headers}
                    row={item.row}
                  />
                );
              });
            })()}
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
            본인의 수행평가 영역별 점수와 총점을 확인하였으며, 이에 서명합니다.
          </p>

          {(() => {
            const teacherKey = tCode.trim();
            const subjectKey = subjName.trim();
            const cardStudentId = studentId.trim();

            let savedSignature = '';
            const foundSigKey = Object.keys(signatures).find(key => {
              const parts = key.split('_');
              if (parts.length >= 3) {
                const [sigTeacher, sigSubject, sigStudent] = parts;
                return sigTeacher.trim() === teacherKey && 
                       sigSubject.trim() === subjectKey && 
                       matchesStudentId(sigStudent, cardStudentId);
              }
              return false;
            });
            if (foundSigKey) {
              savedSignature = signatures[foundSigKey];
            }

            if (savedSignature) {
              return (
                <div className="bg-emerald-50/50 border border-emerald-250 rounded-2xl p-4 flex flex-col items-center justify-center gap-2.5">
                  <div className="text-xs font-black text-emerald-850 flex items-center gap-1">
                    🎉 확인 서명이 제출 완료
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3 max-w-[220px] overflow-hidden flex items-center justify-center shadow-xs">
                    <img src={savedSignature} alt="학생 서명" className="h-14 object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-mono font-bold">서명 제출 일시 기록됨</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteSignatureModal({ subject: subjName, studentId });
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
                      await onSaveSignature(subjName, studentId, studentName, dataUrl, teacherCode);
                      setShowSavedFeedback(true);
                      setShowSavedFeedbackModal(true);
                      setTimeout(() => setShowSavedFeedback(false), 4500);
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

      {isChangePasswordOpen && (
        <div id="password-change-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn print:hidden">
          <div className="bg-white border border-slate-200 shadow-xl rounded-2xl max-w-sm w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-indigo-900 text-white px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-extrabold flex items-center gap-1.5">
                <Key size={16} className="text-amber-400" /> 비밀번호 변경
              </span>
              <button 
                type="button"
                onClick={() => {
                  setIsChangePasswordOpen(false);
                  setPasswordError('');
                  setPasswordSuccess('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="text-white/70 hover:text-white cursor-pointer text-xs font-bold"
              >
                닫기
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handlePasswordChange} className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-1">
                <span className="text-[10px] text-indigo-900 font-extrabold block">로그인 중인 학생</span>
                <p className="text-xs font-bold text-slate-800">
                  {studentName} ({studentId})
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1" htmlFor="new-password">
                  새 비밀번호 입력
                </label>
                <input 
                  id="new-password"
                  type="password"
                  placeholder="새로운 비밀번호"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1" htmlFor="confirm-password">
                  새 비밀번호 확인
                </label>
                <input 
                  id="confirm-password"
                  type="password"
                  placeholder="새 비밀번호 다시 입력"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold text-slate-800"
                />
              </div>

              {passwordError && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-150 whitespace-pre-line leading-relaxed">
                  ⚠️ {passwordError}
                </p>
              )}

              {passwordSuccess && (
                <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-150 leading-relaxed">
                  ✅ {passwordSuccess}
                </p>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => {
                    setIsChangePasswordOpen(false);
                    setPasswordError('');
                    setPasswordSuccess('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  disabled={isPasswordSubmitting}
                  className="px-4 py-2 bg-indigo-900 border border-indigo-900 text-white hover:bg-indigo-950 rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {isPasswordSubmitting ? '변경 중...' : '변경하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Signature Confirmation Modal */}
      {deleteSignatureModal && (
        <div id="delete-signature-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn select-none print:hidden">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-sm w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <span className="text-lg">⚠️</span>
              <span className="text-sm font-black tracking-tight">제출 서명 삭제 확인</span>
            </div>
            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              제출한 서명을 삭제하고 다시 작성하시겠습니까? {"\n"}
              이 작업은 취소할 수 없으며 즉시 삭제됩니다.
            </p>
            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl">
              <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-tight">교과목</span>
              <span className="text-xs font-black text-slate-800 block truncate">{deleteSignatureModal.subject}</span>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteSignatureModal(null)}
                className="px-3.5 py-2 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl text-xs transition duration-150 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { subject, studentId } = deleteSignatureModal;
                  setDeleteSignatureModal(null);
                  if (onDeleteSignature) {
                    await onDeleteSignature(subject, studentId, teacherCode);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 border border-rose-500 text-white font-extrabold rounded-xl text-xs transition duration-150 cursor-pointer shadow-xs hover:scale-[1.02]"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Student Signature Saved Confirmation Modal */}
      {showSavedFeedbackModal && (
        <div id="signature-saved-success-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn select-none print:hidden">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-3xl max-w-sm w-full overflow-hidden p-6 text-center flex flex-col items-center space-y-4">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-100 animate-bounce">
              <CheckCircle size={28} className="stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900">서명 제출 완료</h3>
              <p className="text-[11px] text-slate-500 font-bold leading-normal">
                학번 <span className="text-indigo-950 font-black">{studentId}</span> {studentName} 서명이 성공적으로 기록되었습니다.
              </p>
            </div>
            <div className="w-full bg-slate-50 border border-slate-150 rounded-xl p-3 text-center text-[10px] text-slate-500 font-bold leading-relaxed">
              교과 담당 선생님께도 서명이 제출되었습니다. 🔒
            </div>
            <button
              type="button"
              onClick={() => setShowSavedFeedbackModal(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 hover:shadow-md text-white font-extrabold rounded-xl text-xs transition duration-150 cursor-pointer shadow-xs active:scale-98"
            >
              확인하였습니다
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
