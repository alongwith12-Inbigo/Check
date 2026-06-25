import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, FileSpreadsheet, Check } from 'lucide-react';
import { EvaluationState, Teacher, RegisteredStudent } from '../types';
import { findStudentIdKey, findBirthdateKey, findFeedbackKey, isScoreColumn, matchesStudentId, findTotalScoreKey, isMetadataOrNonScoreHeader, parseClassNumber } from '../utils';
import { cleanAndFormatHeaderName } from '../utils/pdfExtractor';
import { parseNcsHeaderDetails, cleanAndFormatNcsUnitName } from './StudentPdfViewer';

function getEunNeun(text: string): string {
  if (!text) return '은';
  const cleanText = text.trim().replace(/[\s\)\}\]]+$/, '');
  if (cleanText.length === 0) return '은';
  const lastChar = cleanText.charAt(cleanText.length - 1);
  const code = lastChar.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) {
    const hasBatchim = (code - 0xAC00) % 28 !== 0;
    return hasBatchim ? '은' : '는';
  }
  return '은';
}

function romanizeHangul(text: string): string {
  const CHOSEONG = [
    'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'
  ];
  const JUNGSEONG = [
    'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'
  ];
  const JONGSEONG = [
    '', 'k', 'kk', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'
  ];

  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const offset = code - 0xAC00;
      const cho = Math.floor(offset / 588);
      const jung = Math.floor((offset % 588) / 28);
      const jong = offset % 28;
      result += CHOSEONG[cho] + JUNGSEONG[jung] + JONGSEONG[jong];
    } else {
      result += text.charAt(i).toLowerCase();
    }
  }
  return result;
}

function getConsonantSkeleton(r: string): string {
  return r.toLowerCase()
    .replace(/ph/g, 'p')
    .replace(/th/g, 't')
    .replace(/ch/g, 'c')
    .replace(/sh/g, 's')
    .replace(/ck/g, 'k')
    .replace(/[aeiouy]/g, '') // remove vowels
    .replace(/r/g, 'l')
    .replace(/z/g, 'j')
    .replace(/f/g, 'p')
    .replace(/v/g, 'b')
    .replace(/w/g, '')
    .replace(/h/g, '')
    .replace(/x/g, 'ks')
    .replace(/[^a-z0-9]/g, '');
}

function cleanAndNormalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

function areNamesLooselyMatching(name1: string, name2: string): boolean {
  const n1 = cleanAndNormalizeName(name1);
  const n2 = cleanAndNormalizeName(name2);
  if (!n1 || !n2) return false;

  // 1. Exact cleaned match or standard substring match
  if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;

  // 2. Romanized & Sound-alike match for English/Korean phonetic similarities
  const isN1Korean = /[가-힣]/.test(name1);
  const isN2Korean = /[가-힣]/.test(name2);

  const r1 = isN1Korean ? romanizeHangul(n1) : n1;
  const r2 = isN2Korean ? romanizeHangul(n2) : n2;

  const r1Clean = r1.replace(/[^a-z0-9]/g, '');
  const r2Clean = r2.replace(/[^a-z0-9]/g, '');

  if (r1Clean === r2Clean || r1Clean.includes(r2Clean) || r2Clean.includes(r1Clean)) return true;

  // Compare consonant skeletons for highly robust phonetic matching
  const sk1 = getConsonantSkeleton(r1);
  const sk2 = getConsonantSkeleton(r2);

  if (sk1 && sk2) {
    if (sk1 === sk2 || sk1.includes(sk2) || sk2.includes(sk1)) return true;
    
    // Check for sharing a prefix of at least 3 consonants
    if (sk1.length >= 3 && sk2.length >= 3 && (sk1.startsWith(sk2.substring(0, 3)) || sk2.startsWith(sk1.substring(0, 3)))) {
      return true;
    }
  }

  return false;
}

function findNiceRowForStudent(
  student: { studentId: string; studentName: string },
  rows: any[],
  headers: string[],
  selectedClass: string
): any {
  if (!rows || rows.length === 0) return null;
  const studentIdKey = findStudentIdKey(headers);
  const nameKey = headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized === '이름' || normalized === '성명' || normalized.includes('name') || normalized.includes('학생명');
  });
  const classKey = headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized === '반' || normalized.includes('class') || normalized === '학급';
  });
  const gradeKey = headers.find(h => {
    const normalized = String(h).replace(/\s+/g, '').toLowerCase();
    return normalized === '학년' || normalized.includes('grade') || normalized.includes('학년');
  });

  // Extract student details
  // e.g., "20401" -> grade = 2, class = 4, number = 1
  const studId = student.studentId.replace(/\D/g, '');
  let studGrade = 0;
  let studClass = 0;
  let studNum = 0;
  if (studId.length === 5) {
    studGrade = parseInt(studId.substring(0, 1), 10);
    studClass = parseInt(studId.substring(1, 3), 10);
    studNum = parseInt(studId.substring(3, 5), 10);
  } else if (selectedClass) {
    const classDigits = selectedClass.replace(/\D/g, '');
    if (classDigits.length >= 2) {
      studGrade = parseInt(classDigits.substring(0, 1), 10);
      studClass = parseInt(classDigits.substring(1), 10);
    }
  }

  // First pass: exact matches using matchesStudentId
  if (studentIdKey) {
    const found = rows.find(row => {
      const val = String(row[studentIdKey] || '').trim();
      return val && matchesStudentId(student.studentId, val);
    });
    if (found) return found;
  }

  // Second pass: match by student number + class confirmation
  for (const row of rows) {
    let matchesNum = false;
    if (studentIdKey) {
      const val = String(row[studentIdKey] || '').trim();
      const onlyDigits = val.replace(/\D/g, '');
      if (onlyDigits.length > 0 && onlyDigits.length <= 2) {
        const parsedRowNum = parseInt(onlyDigits, 10);
        if (parsedRowNum > 0 && parsedRowNum === studNum) {
          matchesNum = true;
        }
      }
    }

    // Verify if Grade & Class match for this row
    let gradeMatched = true;
    let classMatched = true;

    if (gradeKey) {
      const rowGradeVal = parseInt(String(row[gradeKey] || '').replace(/\D/g, ''), 10);
      if (!isNaN(rowGradeVal) && rowGradeVal !== studGrade) {
        gradeMatched = false;
      }
    }
    if (classKey) {
      const rowClassVal = parseInt(String(row[classKey] || '').replace(/\D/g, ''), 10);
      if (!isNaN(rowClassVal) && rowClassVal !== studClass) {
        classMatched = false;
      }
    }

    // If matches number, check if name also matches, or if no conflicting grade/class columns are present
    if (matchesNum && gradeMatched && classMatched) {
      if (nameKey) {
        const rowName = String(row[nameKey] || '').trim();
        const studName = student.studentName.trim();
        if (areNamesLooselyMatching(rowName, studName)) {
          return row;
        }
        // Robust fallback: if Grade & Class columns are both present and confirmed matched,
        // we can trust the unique Student Number match in the class even if names differ slightly (e.g. English vs Korean)
        if (gradeKey && classKey) {
          return row;
        }
      } else {
        return row;
      }
    }
  }

  // Third pass: match by Name within the same class context
  if (nameKey) {
    for (const row of rows) {
      const rowName = String(row[nameKey] || '').trim();
      const studName = student.studentName.trim();
      if (areNamesLooselyMatching(rowName, studName)) {
        let gradeMatched = true;
        let classMatched = true;

        if (gradeKey) {
          const rowGradeVal = parseInt(String(row[gradeKey] || '').replace(/\D/g, ''), 10);
          if (!isNaN(rowGradeVal) && rowGradeVal !== studGrade) {
            gradeMatched = false;
          }
        }
        if (classKey) {
          const rowClassVal = parseInt(String(row[classKey] || '').replace(/\D/g, ''), 10);
          if (!isNaN(rowClassVal) && rowClassVal !== studClass) {
            classMatched = false;
          }
        }

        if (gradeMatched && classMatched) {
          return row;
        }
      }
    }
  }

  // Loose fallback by Name only (if class columns not matched or missing)
  if (nameKey) {
    const studName = student.studentName.trim();
    const found = rows.find(row => {
      const rowName = String(row[nameKey] || '').trim();
      return areNamesLooselyMatching(rowName, studName);
    });
    if (found) return found;
  }

  return null;
}

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
    } else if (targetGradeClass && targetGradeClass.replace(/\D/g, '').length >= 3) {
      const tgtDigits = targetGradeClass.replace(/\D/g, '');
      const grade = parseInt(tgtDigits.substring(0, 1), 10);
      const cls = parseInt(tgtDigits.substring(1, 3), 10);
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

  // Helper to identify overall total columns
  const isOverallTotalHeader = (h: string): boolean => {
    const hClean = h.replace(/\s+/g, '').toLowerCase();
    const details = parseNcsHeaderDetails(h);
    
    // Terms that strongly signify a final/overall course total score, not a specific Capability Unit total
    const totalTerms = [
      '최종수행', '과목수행', '산출총점', '최종점수', '종합점수', '득점계', '원점수', '총점', '실득점', '성적'
    ];
    const hasTotalTerm = totalTerms.some(term => hClean.includes(term)) ||
      (details.isNcs && totalTerms.some(term => 
        details.unitName.replace(/\s+/g, '').toLowerCase().includes(term) || 
        details.subHeader.replace(/\s+/g, '').toLowerCase().includes(term)
      ));
                          
    if (hasTotalTerm) return true;
    
    // Plain total columns without a distinct Capability Unit, e.g. "합계", "총합"
    const isPlainTotal = ['합계', '총점', '총합', '계', '총', '득점'].some(term => 
      hClean === term || hClean === `[${term}]` || hClean.endsWith(`]${term}`)
    );
    if (isPlainTotal && (!details.isNcs || !details.unitName || 
        details.unitName.includes('최종') || details.unitName.includes('결과'))) {
      return true;
    }
    
    return false;
  };

  const isScoreHeader = (h: string) => {
    if (isMetadataOrNonScoreHeader(h)) return false;
    if (isOverallTotalHeader(h)) return false;
    return true;
  };

  // Filter actual score columns (including unit-specific "합계" columns if they belong to a unit)
  const niceScoreHeaders = isNiceMode && niceEval ? (niceEval.headers || []).filter(h => isScoreHeader(h)) : [];

  const niceTotalHeader = isNiceMode && niceEval ? (niceEval.headers || []).find(h => isOverallTotalHeader(h)) : undefined;

  interface NcsGroup {
    unitName: string;
    percentage: string;
    headers: string[];
  }

  const ncsGroups = useMemo<NcsGroup[]>(() => {
    if (!isNiceMode || !niceEval) return [];
    const groups: NcsGroup[] = [];
    niceScoreHeaders.forEach(h => {
      const details = parseNcsHeaderDetails(h);
      const groupName = details.isNcs ? details.unitName : '';
      const pct = details.isNcs ? details.percentage : '';
      
      let group = groups.find(g => g.unitName === groupName);
      if (!group) {
        group = {
          unitName: groupName,
          percentage: pct,
          headers: []
        };
        groups.push(group);
      }
      group.headers.push(h);
    });
    return groups;
  }, [isNiceMode, niceEval, niceScoreHeaders]);

  const isNcsMode = useMemo(() => {
    return isNiceMode && niceScoreHeaders.some(h => parseNcsHeaderDetails(h).isNcs);
  }, [isNiceMode, niceScoreHeaders]);

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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
            {/* Subject Selector */}
            <div className="space-y-1.5 flex-1 sm:flex-initial">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">출력 평가 과목</label>
              <select 
                value={selectedSubject} 
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-650 min-w-[150px] w-full"
              >
                {uniqueSubjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {/* Class Selector */}
            <div className="space-y-1.5 flex-1 sm:flex-initial">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">필터링 학급 (반)</label>
              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-650 min-w-[150px] w-full"
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
                  선택한 과목 <span className="text-rose-600 font-extrabold">[{selectedSubject}]</span>{getEunNeun(selectedSubject)} 2단계 [나이스 확인용 EXCEL 파일]이 업로드되지 않았습니다.
                </p>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto break-keep">
                  [2단계] 나이스 확인용 엑셀 파일을 업로드한 경우에만 출력이 가능합니다.
                </p>
              </div>
              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3.5 max-w-md mx-auto">
                <span className="text-[11px] text-rose-800 font-bold block">
                  💡 [1단계] 수행평가 영역별 점수만 입력한 경우는 인쇄 기능을 제공하지 않습니다.
                </span>
              </div>
            </div>
          ) : (
            /* Printable Form Page Container: Forces clean 1-sheet layout styles on prints */
            <div 
              id="printable-score-confirmation-sheet" 
              className="bg-white rounded-2xl p-4 sm:p-6 shadow-xs max-w-4xl mx-auto border border-slate-300/80 print:shadow-none print:border-0 print:p-0 print:max-w-none print:w-full print:text-[9.5px]"
            >
              
              {/* Printed Heading */}
              <div className="border-b-4 border-double border-slate-800 pb-2 text-center space-y-1.5">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">수행평가 영역별 결과 및 서명 확인 제출표</h1>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 font-mono print:text-[9.5px]">
                  <span>교과목명: {selectedSubject}</span>
                  <span>학급: {selectedClass}</span>
                  <span>담당교사: {loggedTeacher.name} 선생님</span>
                </div>
              </div>

              {/* Mobile Scroll Indicator Helper */}
              <div className="block sm:hidden text-right mb-1.5 print:hidden select-none">
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full animate-pulse">
                  ↔ 좌우로 스크롤하여 전체 내용을 확인하세요
                </span>
              </div>

              {/* Roster Sheet Data Table */}
              <div className="mt-4 overflow-x-auto print:overflow-visible border border-slate-200 sm:border-0 rounded-xl max-w-full">
                <table className="w-full text-left border-collapse border border-slate-800 text-[10px] sm:text-xs print:text-[8.5px] table-fixed min-w-[720px] sm:min-w-full">
                  <thead>
                    {isNiceMode && isNcsMode ? (
                      <>
                        {/* Row 1: Grouped Capability Units */}
                        <tr className="bg-slate-50 border-b border-slate-800 text-slate-900 font-black font-sans text-center">
                          <th rowSpan={2} className="border border-slate-800 px-1 py-1 text-center w-8 whitespace-nowrap print:w-6 print:text-[8.5px]">순번</th>
                          <th rowSpan={2} className="border border-slate-800 px-1 py-1 text-center w-16 whitespace-nowrap print:w-14 print:text-[8.5px]">학번</th>
                          <th rowSpan={2} className="border border-slate-800 px-1 py-1 text-center w-20 whitespace-nowrap print:w-18 print:text-[8.5px]">성명</th>
                          
                          {ncsGroups.map((group, gIdx) => {
                            const groupDisplayName = group.unitName || '평가 영역';
                            const cleanName = cleanAndFormatNcsUnitName(groupDisplayName, gIdx + 1);
                            const displayLabel = group.percentage 
                              ? `${cleanName} (${group.percentage})` 
                              : cleanName;
                              
                            return (
                              <th 
                                key={gIdx} 
                                colSpan={group.headers.length} 
                                className="border border-slate-800 px-1 py-1 text-center bg-slate-100/60 font-extrabold print:text-[8.5px]"
                              >
                                <span className="block text-[9px] print:text-[8.5px] text-slate-900 font-bold tracking-tight leading-none">
                                  {displayLabel}
                                </span>
                              </th>
                            );
                          })}
                          
                          <th rowSpan={2} className="border border-slate-800 px-1 py-1 text-center w-14 whitespace-nowrap print:w-12 print:text-[8.5px]">산출총점</th>
                          <th rowSpan={2} className="border border-slate-800 px-1 py-1 text-center w-24 whitespace-nowrap print:w-18 print:text-[8.5px]">확인 서명</th>
                          <th rowSpan={2} className="border border-slate-800 px-1 py-1 text-center min-w-[70px] w-auto whitespace-normal print:text-[8.5px]">비고</th>
                        </tr>
                        {/* Row 2: Sub-headers */}
                        <tr className="bg-slate-50 border-b border-slate-800 text-slate-900 font-bold font-sans text-center">
                          {ncsGroups.map((group) => 
                            group.headers.map((h, hIdx) => {
                              const details = parseNcsHeaderDetails(h);
                              const hCleaned = cleanAndFormatHeaderName(details.subHeader);
                              
                              let title = hCleaned;
                              let maxScoreText = '';
                              const match = hCleaned.match(/^([\s\S]+?)\s*\(([\s\S]+?)\)$/);
                              if (match) {
                                title = match[1].trim();
                                maxScoreText = match[2].trim();
                              }

                              const isHapge = title === '합계';

                              return (
                                <th 
                                  key={hIdx} 
                                  className={`border border-slate-800 px-1 py-0.5 text-center font-bold print:text-[8px] leading-tight ${
                                    isHapge ? 'bg-amber-50/60 text-amber-950 font-extrabold' : ''
                                  }`}
                                >
                                  <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="block text-[9px] print:text-[8px] text-slate-800">
                                      {title}
                                    </span>
                                    {maxScoreText && (
                                      <span className="block text-[8px] print:text-[7px] text-slate-500 font-normal mt-0.5 whitespace-nowrap">
                                        {maxScoreText}
                                      </span>
                                    )}
                                  </div>
                                </th>
                              );
                            })
                          )}
                        </tr>
                      </>
                    ) : (
                      <tr className="bg-slate-50 border-b border-slate-800 text-slate-900 font-black font-sans text-center">
                        <th className="border border-slate-800 px-1 py-1.5 text-center w-8 whitespace-nowrap print:w-6">순번</th>
                        <th className="border border-slate-800 px-1 py-1.5 text-center w-16 whitespace-nowrap print:w-14">학번</th>
                        <th className="border border-slate-800 px-1 py-1.5 text-center w-20 whitespace-nowrap print:w-18">성명</th>
                        {isNiceMode ? (
                          niceScoreHeaders.map((h, idx) => {
                            const details = parseNcsHeaderDetails(h);
                            const hCleaned = cleanAndFormatHeaderName(details.subHeader);
                            
                            let title = hCleaned;
                            let maxScoreText = '';
                            const match = hCleaned.match(/^([\s\S]+?)\s*\(([\s\S]+?)\)$/);
                            if (match) {
                              title = match[1].trim();
                              maxScoreText = match[2].trim();
                            }

                            return (
                              <th key={idx} className="border border-slate-800 px-1 py-1.5 text-center min-w-[60px] max-w-[100px] leading-tight print:text-[8.5px]">
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <span className="block text-[9.5px] print:text-[8px] font-black text-slate-800 break-words text-center">
                                    {title}
                                  </span>
                                  {maxScoreText && (
                                    <span className="block text-[8.5px] print:text-[7.5px] text-indigo-950 font-bold bg-indigo-50 border border-indigo-100 rounded px-1 mt-0.5 whitespace-nowrap">
                                      {maxScoreText}
                                    </span>
                                  )}
                                </div>
                              </th>
                            );
                          })
                        ) : (
                          sortedEvals.map((ev, idx) => {
                            const maxScoreNum = parseFloat(ev.maxScore || '100') || 100;
                            const rateNum = parseFloat(ev.reflectRate || '100') || 100;
                            const reflectedMax = Number((maxScoreNum * (rateNum / 100)).toFixed(2)).toString();
                            return (
                              <th key={ev.id || idx} className="border border-slate-800 px-1 py-1.5 text-center min-w-[60px] max-w-[100px] leading-tight print:text-[8.5px]">
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  {ev.evaluationDetailName && (
                                    <span className="block text-[9.5px] print:text-[8px] font-black text-slate-800 break-words text-center" title={ev.evaluationDetailName}>
                                      {ev.evaluationDetailName}
                                    </span>
                                  )}
                                  <span className="block text-[8.5px] print:text-[7.5px] text-indigo-950 font-bold bg-indigo-50 border border-indigo-100 rounded px-1 mt-0.5 whitespace-nowrap">
                                    만점 {reflectedMax}점
                                  </span>
                                </div>
                              </th>
                            );
                          })
                        )}
                        <th className="border border-slate-800 px-1 py-1.5 text-center w-14 whitespace-nowrap print:w-12">산출총점</th>
                        <th className="border border-slate-800 px-1 py-1.5 text-center w-24 whitespace-nowrap print:w-18">확인 서명</th>
                        <th className="border border-slate-800 px-1 py-1.5 text-center min-w-[70px] w-auto">비고</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {students.map((student, sIdx) => {
                      const studentIdKey = niceEval ? findStudentIdKey(niceEval.headers || []) : undefined;
                      const niceRow = niceEval 
                        ? findNiceRowForStudent(student, niceEval.rows || [], niceEval.headers || [], selectedClass)
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

                        // If computed or fallback total score is 0, but the sum of individual area scores is greater than 0, use the sum instead.
                        const finalObtainedNum = parseFloat(displayedReflectedObtained);
                        let sumOfAreasObtained = 0;
                        let hasNonZeroArea = false;
                        niceScoreHeaders.forEach(h => {
                          if (niceRow) {
                            const val = parseFloat(String(niceRow[h] || '0').trim());
                            if (!isNaN(val)) {
                              sumOfAreasObtained += val;
                              if (val > 0) hasNonZeroArea = true;
                            }
                          }
                        });

                        if ((isNaN(finalObtainedNum) || finalObtainedNum === 0) && hasNonZeroArea) {
                          displayedReflectedObtained = Number(sumOfAreasObtained.toFixed(2)).toString();
                        }

                        // Parse max score of total header
                        let totalMaxVal = 100;
                        let isTotalExplicit = false;
                        if (niceTotalHeader) {
                          const totalCleaned = cleanAndFormatHeaderName(niceTotalHeader);
                          const maxMatch = totalCleaned.match(/\(([\d.]+)점\)$/);
                          if (maxMatch && maxMatch[1]) {
                            totalMaxVal = parseFloat(maxMatch[1]);
                            isTotalExplicit = true;
                          } else {
                            const rawMatch = niceTotalHeader.match(/만점\s*([\d.]+)/) || niceTotalHeader.match(/배점\s*([\d.]+)/) || niceTotalHeader.match(/만점\s*(\d+)/) || niceTotalHeader.match(/\((\d+)점\)/) || niceTotalHeader.match(/\(([\d.]+)점\)/);
                            if (rawMatch && rawMatch[1]) {
                              totalMaxVal = parseFloat(rawMatch[1]);
                              isTotalExplicit = true;
                            }
                          }
                        }

                        // Parse max score from each individual area/score header and sum them up as fallback
                        let sumOfAreasMaxScore = 0;
                        niceScoreHeaders.forEach(h => {
                          const hCleaned = cleanAndFormatHeaderName(h);
                          const maxMatch = hCleaned.match(/\(([\d.]+)점\)$/);
                          let areaMax = 0;
                          if (maxMatch && maxMatch[1]) {
                            areaMax = parseFloat(maxMatch[1]);
                          } else {
                            const rawMatch = h.match(/만점\s*([\d.]+)/) || h.match(/배점\s*([\d.]+)/) || h.match(/\((\d+)점\)/) || h.match(/\(([\d.]+)점\)/);
                            if (rawMatch && rawMatch[1]) {
                              areaMax = parseFloat(rawMatch[1]);
                            }
                          }
                          sumOfAreasMaxScore += areaMax;
                        });

                        const customSettingKey = `${loggedTeacher.code.trim()}_${selectedSubject.trim()}`;
                        const customMaxStr = subjectMaxScores[customSettingKey] || '';
                        
                        if (customMaxStr) {
                          courseMaxScore = parseFloat(customMaxStr);
                        } else if (niceScoreHeaders.length === 1 && sumOfAreasMaxScore > 0) {
                          // If there's only one score header, its max score is the course max score
                          courseMaxScore = sumOfAreasMaxScore;
                        } else if ((!isTotalExplicit || totalMaxVal === 100 || totalMaxVal === 0) && sumOfAreasMaxScore > 0) {
                          // NCS Mode normally has 100 max overall, standard NICE modes fallback to sum of areas
                          courseMaxScore = isNcsMode ? 100 : sumOfAreasMaxScore;
                        } else {
                          courseMaxScore = totalMaxVal;
                        }
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
                                 sigSubject.replace(/\s+/g, '') === subjectKey.replace(/\s+/g, '') && 
                                 matchesStudentId(sigStudent, printStudentId);
                        }
                        return false;
                      });
                      if (foundSigKey) {
                        studentSigUrl = signatures[foundSigKey];
                      }

                      return (
                        <tr key={student.studentId} className="border-b border-slate-800 hover:bg-slate-50 text-slate-800 font-medium leading-normal">
                          <td className="border border-slate-800 px-1 py-1 text-center font-mono print:py-0.5">{sIdx + 1}</td>
                          <td className="border border-slate-800 px-1 py-1 text-center font-mono font-black print:py-0.5">{student.studentId}</td>
                          <td className="border border-slate-800 px-1 py-1 text-center truncate print:py-0.5">{student.studentName || '미입력'}</td>

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
                                <td key={ev.id} className="border border-slate-800 px-1 py-1 text-center font-mono text-[10.5px] print:text-[9px] print:py-0.5">
                                  <span className="font-extrabold text-slate-900">{displayedVal}</span>
                                </td>
                              );
                            })
                          ) : isNcsMode ? (
                            ncsGroups.map((group) => 
                              group.headers.map((h, hIdx) => {
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

                                const details = parseNcsHeaderDetails(h);
                                const isHapge = details.subHeader.trim() === '합계';

                                return (
                                  <td 
                                    key={hIdx} 
                                    className={`border border-slate-800 px-1 py-0.5 text-center font-mono text-[10.5px] print:text-[9px] print:py-0.5 ${
                                      isHapge ? 'bg-amber-50/10 text-amber-950 font-extrabold' : ''
                                    }`}
                                  >
                                    <span className="font-bold text-slate-900">{displayedVal}</span>
                                  </td>
                                );
                              })
                            )
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
                                <td key={hIdx} className="border border-slate-800 px-1 py-1 text-center font-mono text-[10.5px] print:text-[9px] print:py-0.5">
                                  <span className="font-bold text-slate-900">{displayedVal}</span>
                                </td>
                              );
                            })
                          )}

                          {/* Cumulative total score */}
                          <td className="border border-slate-800 px-1 py-1 text-center font-sans font-black bg-slate-50/50 print:py-0.5">
                            {displayedReflectedObtained}
                            <span className="text-[9px] print:text-[8px] text-slate-400 font-normal">/{courseMaxScore}</span>
                          </td>

                          {/* Delineated Signature col */}
                          <td className="border border-slate-800 px-1 py-1 text-center bg-slate-50/10 print:py-0.5">
                            <div className="flex items-center justify-center h-[26px] w-full">
                              {studentSigUrl ? (
                                <img src={studentSigUrl} alt="서명" className="h-[22px] max-w-[65px] object-contain block print:h-[22px]" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="text-[8px] text-slate-300 border border-dashed border-slate-200 rounded-sm py-0.5 px-1 font-bold print:border-0 print:p-0 print:text-transparent">
                                   미서명
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Remarks (비고) col */}
                          <td className="border border-slate-800 px-1 py-1 text-center text-[10px] print:text-[8px] text-slate-700 font-semibold truncate print:py-0.5">
                            {niceRow ? (String(niceRow['비고'] || niceRow['비고란'] || '').trim()) : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Printable footer area */}
              <div className="mt-4 pt-2 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[9px] text-slate-400 leading-relaxed gap-2 print:border-slate-800 print:text-[8.5px]">
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
