import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Search,
  BookOpen,
  Info,
  Plus,
  Layers,
  Sparkles,
  CalendarDays,
  Key
} from 'lucide-react';
import { EvaluationState, Teacher, RegisteredStudent } from '../types';
import { 
  findStudentIdKey, 
  findBirthdateKey, 
  findFeedbackKey, 
  findGradeKey, 
  findClassKey, 
  findNumberKey, 
  findNameKey,
  findTotalScoreKey
} from '../utils';
import ResultPrintPortal from './ResultPrintPortal';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { extractDataFromPdf } from '../utils/pdfExtractor';

interface AdminDashboardProps {
  myEvaluations: EvaluationState[];
  activeEvaluationId: string;
  onSelectEvaluationId: (id: string) => void;
  onCreateEvaluation: (newState: EvaluationState) => Promise<string>;
  onUpdateEvaluation: (id: string, newState: EvaluationState) => Promise<void>;
  onDeleteEvaluation: (id: string) => Promise<void>;
  onClose: () => void;
  loggedTeacher: Teacher;
  onLogout: () => void;
  subjectMaxScores?: Record<string, string>;
  onUpdateSubjectMaxScore?: (subject: string, maxScore: string) => void | Promise<void>;
  subjectCompletionStates?: Record<string, boolean>;
  onUpdateSubjectCompletion?: (subject: string, completed: boolean) => void | Promise<void>;
  teacherSettings?: Record<string, boolean>;
  signatures?: Record<string, string>;
  onToggleSignature?: (enabled: boolean) => void | Promise<void>;
  allStudents?: RegisteredStudent[];
}

interface SubjectMaxScoreInputProps {
  subject: string;
  initialValue: string;
  onSave: (val: string) => void | Promise<void>;
}

function SubjectMaxScoreInput({ subject, initialValue, onSave }: SubjectMaxScoreInputProps) {
  const [val, setVal] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  const handleSave = async () => {
    if (val !== initialValue) {
      setIsSaving(true);
      setHasSaved(false);
      try {
        await onSave(val);
        setIsSaving(false);
        setHasSaved(true);
        setTimeout(() => setHasSaved(false), 2000);
      } catch (err) {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      <input
        type="text"
        placeholder="예: 30"
        value={val}
        onChange={(e) => {
          const onlyDigits = e.target.value.replace(/\D/g, '');
          setVal(onlyDigits);
        }}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSave();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-12 sm:w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-black text-xs text-indigo-900 font-mono bg-white focus:outline-none focus:border-indigo-500 transition-colors"
      />
      <span className="text-[10px] font-bold text-slate-400">점</span>
      
      {/* Visual Indicator of Save Success - Compacted to 0-width when idle */}
      {(isSaving || hasSaved) && (
        <div className="text-[10px] font-bold select-none animate-fadeIn ml-1 shrink-0">
          {isSaving && (
            <span className="text-amber-500 animate-pulse">
              ⌛
            </span>
          )}
          {hasSaved && !isSaving && (
            <span className="text-emerald-600 animate-bounce">
              ✅
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard({ 
  myEvaluations,
  activeEvaluationId,
  onSelectEvaluationId,
  onCreateEvaluation,
  onUpdateEvaluation,
  onDeleteEvaluation,
  onClose,
  loggedTeacher,
  onLogout,
  subjectMaxScores = {},
  onUpdateSubjectMaxScore = () => {},
  subjectCompletionStates = {},
  onUpdateSubjectCompletion = () => {},
  teacherSettings = {},
  signatures = {},
  onToggleSignature = () => {},
  allStudents = []
}: AdminDashboardProps) {
  const [errorMsg, setErrorMsg] = useState('');
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // 엑셀 샘플 템플릿 관리 상태
  const [sampleTemplate, setSampleTemplate] = useState<{ fileName: string; fileBase64: string; uploadedAt: string } | null>(null);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const templateFileInputRef = useRef<HTMLInputElement>(null);

  // Firestore에서 엑셀 샘플 파일 템플릿 로드
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const docRef = doc(db, 'systemConfig', 'excelTemplate');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSampleTemplate(docSnap.data() as any);
        }
      } catch (err) {
        console.error('Failed to load sample template:', err);
      }
    };
    loadTemplate();
  }, []);

  // 관리자가 새로운 엑셀 템플릿 업로드 처리
  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingTemplate(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const fileBase64 = event.target?.result as string;
        const templateData = {
          fileName: file.name,
          fileBase64,
          uploadedAt: new Date().toLocaleString('ko-KR')
        };

        const docRef = doc(db, 'systemConfig', 'excelTemplate');
        await setDoc(docRef, templateData, { merge: true });
        setSampleTemplate(templateData);
        alert('엑셀 샘플 파일 템플릿이 성공적으로 업로드 및 갱신되었습니다!');
      } catch (err) {
        console.error(err);
        alert('템플릿 업로드 중 에러가 발생했습니다.');
      } finally {
        setIsUploadingTemplate(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // 엑셀 양식 샘플 파일 다운로드
  const downloadSampleTemplate = () => {
    if (sampleTemplate && sampleTemplate.fileBase64) {
      const link = document.createElement('a');
      link.href = sampleTemplate.fileBase64;
      link.download = sampleTemplate.fileName || '수행평가_등록용_엑셀샘플.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Fallback: XLS로 기본 형식 엑셀 빌드하고 내리는 대단히 안전한 백업 로직!
      try {
        const headers = ['학년', '반', '번호', '이름', '수행체크(확인용)', '세부수치(확인용)', '해당영역 최종점수', '피드백내용'];
        const exampleRows = [
          { '학년': 1, '반': 3, '번호': 1, '이름': '홍길동', '수행체크(확인용)': 10, '세부수치(확인용)': 5, '해당영역 최종점수': 15, '피드백내용': '프로젝트 계획이 구체적이며 함수식을 이용한 빅데이터 분석 구성이 뛰어남.' },
          { '학년': 1, '반': 3, '번호': 2, '이름': '김철수', '수행체크(확인용)': 8, '세부수치(확인용)': 4, '해당영역 최종점수': 12, '피드백내용': '데이터 정제의 기초를 명확히 이해하고 있으나 시각화 분석 보충이 필요함.' }
        ];
        
        const ws = XLSX.utils.json_to_sheet(exampleRows, { header: headers });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '수행평가양식');
        
        XLSX.writeFile(wb, '수행평가_등록_권장양식_샘플.xlsx');
      } catch (err) {
        console.error('Fallback template download failed:', err);
        alert('샘플 파일 다운로드 중에 실패했습니다.');
      }
    }
  };

  // 엑셀 독립 등록 상태
  const [excelSubject, setExcelSubject] = useState('');
  const [excelRound, setExcelRound] = useState('');
  const [excelDetailName, setExcelDetailName] = useState('');
  const [excelMaxScore, setExcelMaxScore] = useState('');
  const [excelReflectRate, setExcelReflectRate] = useState('100');
  const [excelDragActive, setExcelDragActive] = useState(false);
  const [excelErrorMsg, setExcelErrorMsg] = useState('');
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  // PDF 독립 등록 상태
  const [pdfSubject, setPdfSubject] = useState('');
  const [pdfRound, setPdfRound] = useState('');
  const [pdfDetailName, setPdfDetailName] = useState('');
  const [pdfTargetGradeClass, setPdfTargetGradeClass] = useState('');
  const [pdfDragActive, setPdfDragActive] = useState(false);
  const [pdfErrorMsg, setPdfErrorMsg] = useState('');
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

  // 엑셀 서명용 종합 등록 [테스트] 상태
  const [testExcelSubject, setTestExcelSubject] = useState('');
  const [testExcelRound, setTestExcelRound] = useState('1');
  const [testExcelDetailName, setTestExcelDetailName] = useState('종합 성적결과표');
  const [testExcelTargetGradeClass, setTestExcelTargetGradeClass] = useState('');
  const [testExcelDragActive, setTestExcelDragActive] = useState(false);
  const [testExcelErrorMsg, setTestExcelErrorMsg] = useState('');
  const testExcelFileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for Teacher's custom password change modal
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  // Custom State for confirm deletion inside iframe safely
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Active evaluation being edited
  const activeEval = myEvaluations.find(e => e.id === activeEvaluationId);

  // Text inputs (for editing activeEval)
  const [subjectInput, setSubjectInput] = useState('');
  const [roundInput, setRoundInput] = useState('');
  const [detailNameInput, setDetailNameInput] = useState('');
  const [maxScoreInput, setMaxScoreInput] = useState('');
  const [reflectRateInput, setReflectRateInput] = useState('100');
  
  // PDF target fields
  const [uploadType, setUploadType] = useState<'excel' | 'pdf'>('excel');
  const [pdfBase64, setPdfBase64] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');
  const [targetGradeClass, setTargetGradeClass] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [localScores, setLocalScores] = useState<Record<string, string>>({});

  // Sync inputs when active evaluation changes
  useEffect(() => {
    if (activeEval) {
      setSubjectInput(activeEval.subject || '');
      setRoundInput(activeEval.round || '');
      setDetailNameInput(activeEval.evaluationDetailName || '');
      setMaxScoreInput(activeEval.maxScore || '');
      setReflectRateInput(activeEval.reflectRate || '100');
      setUploadType(activeEval.uploadType || 'excel');
      setPdfBase64(activeEval.pdfBase64 || '');
      setPdfFileName(activeEval.pdfFileName || '');
      setTargetGradeClass(activeEval.targetGradeClass || '');
    } else {
      setSubjectInput('');
      setRoundInput('');
      setDetailNameInput('');
      setMaxScoreInput('');
      setReflectRateInput('100');
      setUploadType('excel');
      setPdfBase64('');
      setPdfFileName('');
      setTargetGradeClass('');
    }
    setErrorMsg('');
  }, [activeEvaluationId, activeEval]);

  const downloadActiveEvalPdf = () => {
    if (!activeEval || !activeEval.pdfBase64) return;
    try {
      let cleanBase64 = activeEval.pdfBase64;
      if (cleanBase64.includes(',')) {
        cleanBase64 = cleanBase64.split(',')[1];
      }
      
      const byteCharacters = atob(cleanBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = activeEval.pdfFileName || `[성적통지표]_${activeEval.subject || '평가물'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('PDF 다운로드 실패:', err);
      alert('PDF 파일 다운로드 도중 오류가 발생했습니다: ' + (err.message || err));
    }
  };

  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [pdfExtractError, setPdfExtractError] = useState<string | null>(null);
  const [lastOcrError, setLastOcrError] = useState<string | null>(null);
  
  // Track which evaluation IDs have already run automated extraction during the mount session
  const automatedExtractionsRef = useRef<Record<string, boolean>>({});

  const extractPdfOrImage = async (
    base64: string,
    subject: string,
    tgtClass: string
  ): Promise<{
    extractedPdf: { headers: string[]; rows: any[] } | null;
    error: string | null;
  }> => {
    let ocrError: string | null = null;
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pdfBase64: base64,
          subject: subject,
          targetGradeClass: tgtClass
        })
      });

      const responseText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        throw new Error(`AI 서버가 올바른 JSON 형식을 반환하지 않았습니다. (HTTP 상태 코드: ${res.status}, 응답 일부: ${responseText.trim().substring(0, 150)})`);
      }

      if (res.ok && data && data.success) {
        setLastOcrError(null);
        return {
          extractedPdf: {
            headers: data.headers,
            rows: data.rows
          },
          error: null
        };
      } else {
        ocrError = data?.error || `서버 에러가 발생했습니다 (HTTP 상태 코드: ${res.status})`;
        console.warn('Backend Gemini AI OCR returned unsuccessful response, falling back to local client parser...', ocrError);
      }
    } catch (err: any) {
      ocrError = err?.message || '네트워크 요청 실패';
      console.error('OCR API request failed, falling back to local client parser...', err);
    }
    setLastOcrError(ocrError);
    const localParsed = await extractDataFromPdf(base64, tgtClass);
    return {
      extractedPdf: localParsed,
      error: ocrError
    };
  };

  useEffect(() => {
    if (
      activeEvaluationId &&
      activeEval && 
      activeEval.uploadType === 'pdf' && 
      (!activeEval.rows || activeEval.rows.length === 0) && 
      activeEval.pdfBase64
    ) {
      // Prevent running extraction multiple times for the same evaluation ID in this mount session
      if (automatedExtractionsRef.current[activeEvaluationId]) {
        return;
      }
      automatedExtractionsRef.current[activeEvaluationId] = true;

      let active = true;
      const autoExtract = async () => {
        setIsExtractingPdf(true);
        setPdfExtractError(null);
        try {
          const { extractedPdf, error } = await extractPdfOrImage(
            activeEval.pdfBase64!,
            activeEval.subject || '',
            activeEval.targetGradeClass || ''
          );
 
          if (active) {
            if (extractedPdf && extractedPdf.rows.length > 0) {
              await onUpdateEvaluation(activeEval.id!, {
                ...activeEval,
                headers: extractedPdf.headers,
                rows: extractedPdf.rows
              });
            } else {
              let detailMsg = 'PDF 파일에서 학생별 성적 자료(반, 번호, 이름 및 각 평가항목)를 자동으로 분석하고 매칭하지 못했습니다. PDF 양식 및 문형 텍스트 구조를 확인하십시오.';
              if (error) {
                detailMsg += `\n(참고 - AI 엔진 안내: ${error})`;
              } else {
                detailMsg += '\n(참고 - 로컬 클라이언트 파서: 매칭 요건을 만족하는 유효 학번 행이 검출되지 않았습니다.)';
              }
              setPdfExtractError(detailMsg);
            }
          }
        } catch (err: any) {
          console.error('Dynamic on-the-fly PDF extraction failed:', err);
          if (active) {
            setPdfExtractError('PDF 추출 도중 분석 엔진에 에러가 발생했습니다: ' + (err.message || err));
          }
        } finally {
          setIsExtractingPdf(false);
        }
      };
      autoExtract();
      return () => {
        active = false;
      };
    }
  }, [activeEvaluationId, activeEval?.id, activeEval?.rows?.length]);

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
      const docRef = doc(db, 'teachers', loggedTeacher.code);
      await setDoc(docRef, {
        code: loggedTeacher.code,
        name: loggedTeacher.name,
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

  const propagateSplitChanges = (subject: string, round: string, detail: string, maxS: string, reflectR: string, tgtGC: string = '') => {
    if (!activeEval || !activeEvaluationId) return;

    let combinedTitle = '';
    const cleanSub = subject.trim();
    const cleanRnd = round.trim();
    const cleanDet = detail.trim();
    const cleanMax = maxS.trim();
    const cleanRef = reflectR.trim();
    const cleanTgtGC = tgtGC.trim();

    if (activeEval.uploadType === 'pdf') {
      combinedTitle = `📂 [PDF 전체점수] ${cleanSub} (${cleanRnd}차) ${cleanDet}`;
    } else {
      if (cleanSub && cleanRnd && cleanDet) {
        combinedTitle = `${cleanSub} (${cleanRnd}차) 수행평가: ${cleanDet}`;
      } else if (cleanSub || cleanRnd || cleanDet) {
        const parts = [];
        if (cleanSub) parts.push(cleanSub);
        if (cleanRnd) parts.push(`(${cleanRnd}차)`);
        if (cleanDet) parts.push(cleanDet);
        combinedTitle = parts.join(' ');
      } else {
        combinedTitle = '수행평가 결과';
      }
    }

    onUpdateEvaluation(activeEvaluationId, {
      ...activeEval,
      subject: cleanSub,
      round: cleanRnd,
      evaluationDetailName: cleanDet,
      maxScore: cleanMax,
      reflectRate: cleanRef,
      title: combinedTitle,
      targetGradeClass: cleanTgtGC
    });
  };

  const processPdfFile = async (file: File) => {
    setPdfErrorMsg('');
    const cleanTgtGC = pdfTargetGradeClass.trim();
    if (!cleanTgtGC) {
      setPdfErrorMsg(
        '⚠️ 대상 학년반 정보를 먼저 입력하십시오.\n' +
        '예: 1학년 1반 전체를 대상으로 하려면 "101"을 입력해야 매칭 조회가 가능합니다.'
      );
      return;
    }

    const defaultSubject = pdfSubject.trim();
    if (!defaultSubject) {
      setPdfErrorMsg('⚠️ 평가 과목명을 먼저 입력하십시오.');
      return;
    }

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
          const headersJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
          const cleanHeaders = (headersJson || []).filter(h => h && String(h).trim() !== "");

          if (cleanHeaders.length === 0 || rawRows.length === 0) {
            setPdfErrorMsg('엑셀 파일에 유효한 데이터가 존재하지 않습니다.');
            return;
          }

          let processedHeaders = [...cleanHeaders];
          let processedRows = [...rawRows];
          let studentIdKey = findStudentIdKey(cleanHeaders);

          if (!studentIdKey) {
            setPdfErrorMsg(
              `필수 열이 누락되어 업로드할 수 없습니다.\n학생 식별을 위해 엑셀 내에 '학번' 열이 포함되어야 합니다.`
            );
            return;
          }

          const defaultRound = pdfRound.trim() || '1';
          const defaultDetail = pdfDetailName.trim() || '수행평가 결과내역';
          const initialTitle = `📂 [최종확인] ${defaultSubject} (${defaultRound}차) ${defaultDetail}`;

          const newEvalMetadata: EvaluationState = {
            title: initialTitle,
            subject: defaultSubject,
            round: defaultRound,
            evaluationDetailName: defaultDetail,
            maxScore: '100', // Handled client side
            reflectRate: '100',
            headers: processedHeaders,
            rows: processedRows,
            uploadedAt: new Date().toLocaleString('ko-KR'),
            uploadType: 'pdf',
            pdfFileName: file.name,
            targetGradeClass: cleanTgtGC
          };

          const newId = await onCreateEvaluation(newEvalMetadata);
          onSelectEvaluationId(newId);
          setPdfErrorMsg('');
        } catch (err) {
          console.error(err);
          setPdfErrorMsg('엑셀 파일 분석 중 에러가 발생했습니다.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target?.result as string;
          if (!base64Data) {
            setPdfErrorMsg('PDF 데이터를 정상적으로 디코딩하지 못했습니다.');
            return;
          }

          const defaultRound = pdfRound.trim() || '1';
          const defaultDetail = pdfDetailName.trim() || '수행평가 결과안내';
          const initialTitle = `📂 [PDF 전체점수] ${defaultSubject} (${defaultRound}차) ${defaultDetail}`;

          let extractedHeaders: string[] = [];
          let extractedRows: any[] = [];
          try {
            const { extractedPdf } = await extractPdfOrImage(base64Data, defaultSubject, cleanTgtGC);
            if (extractedPdf && extractedPdf.rows.length > 0) {
              extractedHeaders = extractedPdf.headers;
              extractedRows = extractedPdf.rows;
            } else {
              console.warn('Could not extract any rows immediately during PDF upload. Will retry on selection.');
            }
          } catch (pdfErr) {
            console.error('Immediate PDF extraction failed:', pdfErr);
          }

          const newEvalMetadata: EvaluationState = {
            title: initialTitle,
            subject: defaultSubject,
            round: defaultRound,
            evaluationDetailName: defaultDetail,
            maxScore: '100',
            reflectRate: '105', // Default reflection placeholder
            headers: extractedHeaders,
            rows: extractedRows,
            uploadedAt: new Date().toLocaleString('ko-KR'),
            uploadType: 'pdf',
            pdfBase64: base64Data,
            pdfFileName: file.name,
            targetGradeClass: cleanTgtGC
          };

          const newId = await onCreateEvaluation(newEvalMetadata);
          onSelectEvaluationId(newId);
          setPdfErrorMsg('');
        } catch (err) {
          console.error(err);
          setPdfErrorMsg('PDF 파일 업로드 중 예기치 못한 에러가 발생했습니다.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const processExcelFile = async (file: File) => {
    setExcelErrorMsg('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
        const headersJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
        const cleanHeaders = (headersJson || []).filter(h => h && String(h).trim() !== "");

        if (cleanHeaders.length === 0 || rawRows.length === 0) {
          setExcelErrorMsg('엑셀 파일에 유효한 데이터가 존재하지 않습니다.');
          return;
        }

        let processedHeaders = [...cleanHeaders];
        let processedRows = [...rawRows];
        let studentIdKey = findStudentIdKey(cleanHeaders);

        if (!studentIdKey) {
          setExcelErrorMsg(
            `필수 열이 누락되어 업로드할 수 없습니다.\n학생 식별을 위해 엑셀 내에 '학번' 열이 포함되어야 합니다.\n\n` + 
            `감지된 열 목록: [${cleanHeaders.join(', ')}]`
          );
          return;
        }

        const defaultSubject = excelSubject.trim();
        if (!defaultSubject) {
          setExcelErrorMsg('⚠️ 평가 과목명을 먼저 입력하십시오.');
          return;
        }
        const defaultRound = excelRound.trim() || '1';
        const defaultDetail = excelDetailName.trim() || '수행평가';
        const defaultMax = excelMaxScore.trim() || '20';
        const defaultReflect = excelReflectRate.trim() || '100';
        const initialTitle = `${defaultSubject} (${defaultRound}차) 수행평가: ${defaultDetail}`;

        const newEvalMetadata: EvaluationState = {
          title: initialTitle,
          subject: defaultSubject,
          round: defaultRound,
          evaluationDetailName: defaultDetail,
          maxScore: defaultMax,
          reflectRate: defaultReflect,
          headers: processedHeaders,
          rows: processedRows,
          uploadedAt: new Date().toLocaleString('ko-KR'),
          uploadType: 'excel'
        };

        const newId = await onCreateEvaluation(newEvalMetadata);
        onSelectEvaluationId(newId);
        setExcelErrorMsg('');
      } catch (err) {
        console.error(err);
        setExcelErrorMsg('엑셀 파일을 파싱하는 과정에서 에러가 발생했습니다. 파일 형식을 다시 점검해 주십시오.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const processTestExcelFile = async (file: File) => {
    setTestExcelErrorMsg('');
    const cleanTgtGC = testExcelTargetGradeClass.trim();
    if (!cleanTgtGC) {
      setTestExcelErrorMsg(
        '⚠️ 대상 학년반 정보를 먼저 입력하십시오.\n' +
        '예: 1학년 7반 전체를 대상으로 하려면 "107"을 입력해야 매칭 조회가 가능합니다.'
      );
      return;
    }

    const defaultSubject = testExcelSubject.trim();
    if (!defaultSubject) {
      setTestExcelErrorMsg('⚠️ 평가 과목명을 먼저 입력하십시오.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
        const headersJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
        const cleanHeaders = (headersJson || []).filter(h => h && String(h).trim() !== "");

        if (cleanHeaders.length === 0 || rawRows.length === 0) {
          setTestExcelErrorMsg('엑셀 파일에 유효한 데이터가 존재하지 않습니다.');
          return;
        }

        let processedHeaders = [...cleanHeaders];
        let processedRows = [...rawRows];
        let studentIdKey = findStudentIdKey(cleanHeaders);

        if (!studentIdKey) {
          setTestExcelErrorMsg(
            `필수 열이 누락되어 업로드할 수 없습니다.\n학생 식별을 위해 엑셀 내에 학년/반/번호 연동용 '학번' 열이 포함되어야 합니다.\n\n` + 
            `감지된 열 목록: [${cleanHeaders.join(', ')}]`
          );
          return;
        }

        const defaultRound = testExcelRound.trim() || '1';
        const defaultDetail = testExcelDetailName.trim() || '수행평가 결과내용 [테스트]';
        const initialTitle = `📂 [테스트 엑셀서명] ${defaultSubject} (${defaultRound}차) ${defaultDetail}`;

        const newEvalMetadata: EvaluationState = {
          title: initialTitle,
          subject: defaultSubject,
          round: defaultRound,
          evaluationDetailName: defaultDetail,
          maxScore: '100',
          reflectRate: '100',
          headers: processedHeaders,
          rows: processedRows,
          uploadedAt: new Date().toLocaleString('ko-KR'),
          uploadType: 'test_excel_sign',
          pdfFileName: file.name,
          targetGradeClass: cleanTgtGC
        };

        const newId = await onCreateEvaluation(newEvalMetadata);
        onSelectEvaluationId(newId);
        setTestExcelErrorMsg('');
      } catch (err: any) {
        console.error(err);
        setTestExcelErrorMsg('엑셀 파일 분석 중 에러가 발생했습니다: ' + (err.message || ''));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleTestExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processTestExcelFile(file);
    }
  };

  const handleTestExcelDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setTestExcelDragActive(true);
    } else if (e.type === "dragleave") {
      setTestExcelDragActive(false);
    }
  };

  const handleTestExcelDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTestExcelDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isExcel) {
        setTestExcelErrorMsg('기타 형식은 허용되지 않습니다. 엑셀 파일만 업로드해 주세요.');
        return;
      }
      await processTestExcelFile(file);
    }
  };

  const triggerTestExcelFileInput = () => {
    testExcelFileInputRef.current?.click();
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processPdfFile(file);
    }
  };

  const handleExcelDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setExcelDragActive(true);
    } else if (e.type === "dragleave") {
      setExcelDragActive(false);
    }
  };

  const handlePdfDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setPdfDragActive(true);
    } else if (e.type === "dragleave") {
      setPdfDragActive(false);
    }
  };

  const handleExcelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExcelDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handlePdfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPdfDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processPdfFile(e.dataTransfer.files[0]);
    }
  };

  const triggerExcelFileInput = () => {
    excelFileInputRef.current?.click();
  };

  const triggerPdfFileInput = () => {
    pdfFileInputRef.current?.click();
  };

  const handleDeleteActive = (idToDelete: string) => {
    const item = myEvaluations.find(e => e.id === idToDelete);
    const itemTitle = item ? item.title : '선택한 파일';
    setDeleteConfirmModal({ id: idToDelete, title: itemTitle });
  };

  // Preview filtration
  const previewRows = activeEval ? activeEval.rows.filter(row => {
    if (!searchTerm) return true;
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }) : [];

  const studentIdKey = activeEval ? findStudentIdKey(activeEval.headers) : undefined;
  const birthdateKey = activeEval ? findBirthdateKey(activeEval.headers) : undefined;
  const feedbackKeys = activeEval ? findFeedbackKey(activeEval.headers) : [];

  return (
    <div id="admin-dashboard-layout" className="space-y-6 max-w-6xl mx-auto px-1 sm:px-4 pb-12">
      
      {/* Visual Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <span className="bg-emerald-55 text-emerald-850 border border-emerald-250 text-xs px-3 py-1 rounded-full font-bold inline-flex items-center gap-1 mb-1.5 shadow-sm">
            <CheckCircle2 size={12} className="text-emerald-700" /> [교사 ID: {loggedTeacher.code}] {loggedTeacher.name} 선생님
          </span>
          <h1 className="text-xl sm:text-2xl font-black font-sans tracking-tight text-slate-900">수행평가 다중 파일 관리 시스템</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => setIsChangePasswordOpen(true)}
            className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-amber-970 rounded-xl text-xs font-black shadow-xs transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-1 shrink-0"
          >
            <Key size={12} className="text-amber-950 animate-pulse" /> 비밀번호 변경하기 🔑
          </button>
          <button 
            onClick={() => setIsPrintOpen(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer flex items-center gap-1.5"
          >
            🖨️ 학생 수행평가 점수 확인 출력
          </button>
          <button 
            onClick={onLogout}
            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-red-600 bg-white hover:bg-red-50 transition cursor-pointer"
          >
            로그아웃
          </button>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
          >
            학생 조회용 화면보기
          </button>
        </div>
      </div>

      {/* Main Grid: Sidebar (List of Files) + Active Config (Excel Actions / Metadata Settings) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Column 1: Teacher's Uploaded Files Catalog */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1 pb-1.5 border-b border-slate-100 uppercase tracking-tight">
              <Layers size={14} className="text-slate-500" />
              등록된 수행평가 목록 ({myEvaluations.length}개)
            </h3>

            {myEvaluations.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic">
                등록된 성적 파일이 없습니다.<br/>새로운 엑셀 또는 PDF 파일을 업로드 하세요.
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Excel Evaluation List */}
                {(() => {
                  const excelEvaluations = myEvaluations.filter(e => e.uploadType !== 'pdf');
                  return (
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-black text-slate-500 uppercase tracking-tight flex items-center gap-1 border-b border-slate-100 pb-1">
                        📊 수행평가 영역별 EXCEL 파일 ({excelEvaluations.length}개)
                      </span>
                      {excelEvaluations.length === 0 ? (
                        <div className="py-3 text-center text-slate-450 text-[10.5px] italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          등록된 엑셀 파일이 없습니다.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                          {excelEvaluations.map((item) => {
                            const isActive = item.id === activeEvaluationId;
                            return (
                              <div 
                                key={item.id} 
                                className={`group p-2.5 rounded-xl border text-left cursor-pointer transition-all flex justify-between items-start gap-1 ${
                                  isActive 
                                    ? 'bg-indigo-50 border-indigo-300 shadow-xs' 
                                    : 'bg-white border-slate-200 hover:border-slate-350'
                                }`}
                                onClick={() => onSelectEvaluationId(item.id || '')}
                              >
                                <div className="space-y-0.5 overflow-hidden">
                                  <span className="block text-[11px] font-black text-slate-800 truncate" title={item.title}>
                                    {item.title}
                                  </span>
                                  <span className="block text-[9px] text-slate-400 font-mono">
                                    {item.uploadedAt || '시각 없음'}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteActive(item.id || '');
                                  }}
                                  className="p-1 bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition shrink-0 cursor-pointer"
                                  title="파일 삭제"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 2. PDF Evaluation List */}
                {(() => {
                  const pdfEvaluations = myEvaluations.filter(e => e.uploadType === 'pdf');
                  return (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <span className="block text-[10px] font-black text-amber-800 uppercase tracking-tight flex items-center gap-1 border-b border-amber-100 pb-1">
                        📄 나이스 확인용 PDF 파일 ({pdfEvaluations.length}개)
                      </span>
                      {pdfEvaluations.length === 0 ? (
                        <div className="py-3 text-center text-slate-450 text-[10.5px] italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          등록된 PDF 파일이 없습니다.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                          {pdfEvaluations.map((item) => {
                            const isActive = item.id === activeEvaluationId;
                            return (
                              <div 
                                key={item.id} 
                                className={`group p-2.5 rounded-xl border text-left cursor-pointer transition-all flex justify-between items-start gap-1 ${
                                  isActive 
                                    ? 'bg-amber-50/50 border-amber-350 shadow-xs' 
                                    : 'bg-white border-slate-200 hover:border-slate-350'
                                }`}
                                onClick={() => onSelectEvaluationId(item.id || '')}
                              >
                                <div className="space-y-0.5 overflow-hidden">
                                  <span className="block text-[11px] font-black text-slate-800 truncate" title={item.title}>
                                    {item.title}
                                  </span>
                                  <span className="block text-[9px] text-slate-400 font-mono">
                                    {item.uploadedAt || '시각 없음'}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteActive(item.id || '');
                                  }}
                                  className="p-1 bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition shrink-0 cursor-pointer"
                                  title="파일 삭제"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            
            <button
              onClick={() => onSelectEvaluationId('')}
              className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeEvaluationId === '' 
                  ? 'bg-indigo-900 text-white' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Plus size={14} /> 다른 수행평가 파일 등록
            </button>
          </div>

          {/* Subject Max Score Settings Card */}
          {(() => {
            const uniqueSubjects = Array.from(new Set(myEvaluations.map(e => e.subject).filter(Boolean))) as string[];
            if (uniqueSubjects.length === 0) return null;
            return (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-xs font-black text-slate-850 flex items-center gap-1.5 pb-2 border-b border-indigo-100 uppercase tracking-tight">
                  🎯 과목별 수행평가 최종 만점 설정
                </h3>
                <p className="text-[10px] text-slate-400 leading-normal">
                  교과목의 수행평가 총 만점을 기입해 주세요. 학생의 누적 결과표에 최종 반영 만점으로 표시됩니다.
                </p>
                <div className="space-y-2">
                  {uniqueSubjects.map(sub => {
                    const settingKey = `${loggedTeacher.code.trim()}_${sub.trim()}`;
                    const dbMaxScore = subjectMaxScores[settingKey] || '';
                    return (
                      <div key={sub} className="flex flex-col bg-slate-50 border border-slate-150 rounded-xl p-3 shadow-3xs space-y-2.5">
                        <div className="flex items-center justify-between gap-3 w-full">
                          {/* Left: Subject Name. Absolutely NO truncate or max-width restriction, fully wrapping */}
                          <div className="flex-1 min-w-0 pr-1">
                            <span className="text-xs font-black text-slate-800 break-words whitespace-normal leading-tight block" title={sub}>
                              {sub}
                            </span>
                          </div>
                          {/* Right: Score Input. Shrink-0 keeps it aligned exactly to the right edge */}
                          <div className="shrink-0 flex items-center justify-end">
                            <SubjectMaxScoreInput 
                              subject={sub}
                              initialValue={dbMaxScore}
                              onSave={async (newVal) => {
                                await onUpdateSubjectMaxScore(sub, newVal);
                              }}
                            />
                          </div>
                        </div>
                        
                        {/* Completion switch beautifully aligned under the inputs to prevent horizontal overflow */}
                        <div className="pt-2 border-t border-slate-200 flex justify-end">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none bg-white py-1 px-2.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 transition-all text-slate-650">
                            <input 
                              type="checkbox"
                              checked={!!subjectCompletionStates[settingKey]}
                              onChange={async (e) => {
                                await onUpdateSubjectCompletion(sub, e.target.checked);
                              }}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-900 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-[10px] font-extrabold text-slate-700">전체 영역 입력 완료</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Student Signature Configuration Card -> Replaced with Dual Registration Info Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-850 flex items-center gap-1.5 pb-2 border-b border-indigo-100 uppercase tracking-tight">
              ✍️ 이중 등록 및 서명 제출 안내
            </h3>
            <p className="text-[10px] text-slate-500 leading-normal">
              본 시스템은 <strong>서명 대장 출력</strong>을 위해 세분화된 영역별 자료와 최종 나이스 점수 자료를 모두 처리하는 <strong>이중 등록 방식</strong>으로 작동합니다:
            </p>
            <div className="space-y-1.5 my-1 bg-slate-50 border border-slate-150 rounded-xl p-3">
              <div className="flex items-start gap-1.5 text-[10px] text-slate-700 leading-relaxed">
                <span className="text-indigo-600 font-bold shrink-0">1단계</span>
                <span><strong>EXCEL 파일 등록:</strong> 수행평가 영역별 점수에 대해 구체적으로 피드백하기 위한 용도입니다. <strong>엑셀 샘플 파일</strong>을 활용해주세요.</span>
              </div>
              <div className="border-t border-slate-200/60 my-1"></div>
              <div className="flex items-start gap-1.5 text-[10px] text-slate-700 leading-relaxed">
                <span className="text-rose-600 font-bold shrink-0">2단계</span>
                <span><strong>PDF 파일 등록:</strong> 나이스에 입력한 점수를 학생들에게 확인받기 위한 용도입니다. <strong>학생 서명</strong>후 출력이 가능합니다.</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-450 leading-relaxed">
              💡 별도의 조작 없이 PDF가 업로드 되면 학생 화면에서 서명 패드가 자동 활성화됩니다. 학생들이 서명을 마친 결과는 상단의 <strong>'출력'</strong> 버튼을 클릭하여 1장으로 출력 가능합니다.
            </p>
          </div>
        </div>

        {/* Column 2 & 3: File Upload Area & Config controls */}
        <div className="lg:col-span-3 space-y-5">
          
          {/* New uploads or selected settings block */}
          {activeEvaluationId === '' || !activeEval ? (
            /* Upload layout state for entering new sheet -> 3-Column Responsive Layout */
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Card 1: Excel Upload (영역별 세부 성적 및 피드백) */}
              <div id="excel-upload-container" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="border-b border-indigo-100 pb-3 flex items-center justify-between">
                    <span className="bg-indigo-50 text-indigo-800 text-[10px] uppercase font-black px-2.5 py-1 rounded-md">수행 영역별 등록 단계</span>
                    <span className="text-[10px] text-slate-450 font-bold">1단계 (EXCEL 자료)</span>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      📊 영역별 수행평가 엑셀 등록
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                      수행영역별 학생 점수 및 서술형 피드백을 한번에 입력하는 엑셀 파일을 업로드합니다.
                    </p>
                  </div>

                  {/* 엑셀 샘플 파일 다운로드 및 관리자 업로드 바 */}
                  <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4.5 space-y-3.5 my-2.5 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 p-3.5 rounded-xl border border-amber-100">
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full uppercase tracking-wider">EXCEL 양식</span>
                        <p className="text-sm font-extrabold text-slate-800 tracking-tight leading-tight flex items-center gap-1.5 hover:text-amber-800 transition-colors">
                          세부 점수 안내용
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={downloadSampleTemplate}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 border border-amber-400 text-white rounded-xl text-xs font-black transition-all hover:scale-[1.02] cursor-pointer self-start sm:self-center shrink-0 shadow-sm"
                      >
                        <FileSpreadsheet size={13} /> {sampleTemplate ? '최신 샘플 다운로드' : 'EXCEL 샘플 다운로드'} 📥
                      </button>
                    </div>
                    
                    {/* 관리자를 위한 새로운 샘플 업로드 폼 (Base64) */}
                    <div className="pt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-600">
                      <span className="text-[10px] font-bold text-slate-500 leading-normal truncate max-w-[250px]">
                        {sampleTemplate ? `🔔 등록됨: ${sampleTemplate.fileName} (${sampleTemplate.uploadedAt})` : '📌 샘플 세팅 상태'}
                      </span>
                      <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                        <input
                          ref={templateFileInputRef}
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleTemplateUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => templateFileInputRef.current?.click()}
                          disabled={isUploadingTemplate}
                          className="text-[10px] font-black text-indigo-900 bg-white/90 hover:bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5 transition-all shadow-xxs cursor-pointer"
                        >
                          {isUploadingTemplate ? '⌛ 반영 설정 중...' : '⚙️ 샘플 교체'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Excel Specific Metadata Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="excel-subject-input" className="block text-[11px] font-bold text-slate-700 mb-1">평가 과목명</label>
                      <input 
                        id="excel-subject-input"
                        type="text"
                        value={excelSubject}
                        onChange={(e) => setExcelSubject(e.target.value)}
                        placeholder="예: 정보"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="excel-round-input" className="block text-[11px] font-bold text-slate-700 mb-1">평가 차시 (차)</label>
                      <input 
                        id="excel-round-input"
                        type="text"
                        value={excelRound}
                        onChange={(e) => setExcelRound(e.target.value)}
                        placeholder="예: 1"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-center font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="excel-detail-name-input" className="block text-[11px] font-bold text-slate-700 mb-1">수행평가 영역 상세명</label>
                    <input 
                      id="excel-detail-name-input"
                      type="text"
                      value={excelDetailName}
                      onChange={(e) => setExcelDetailName(e.target.value)}
                      placeholder="예: 빅데이터 분석 프로젝트"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="excel-max-score-input" className="block text-[11px] font-bold text-slate-700 mb-1">수행평가 만점</label>
                      <input 
                        id="excel-max-score-input"
                        type="text"
                        value={excelMaxScore}
                        onChange={(e) => setExcelMaxScore(e.target.value.replace(/\D/g, ''))}
                        placeholder="예: 20"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-center font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="excel-reflect-rate-input" className="block text-[11px] font-bold text-slate-700 mb-1">반영 비율 (%)</label>
                      <input 
                        id="excel-reflect-rate-input"
                        type="text"
                        value={excelReflectRate}
                        onChange={(e) => setExcelReflectRate(e.target.value.replace(/\D/g, ''))}
                        placeholder="예: 30"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-center font-mono focus:outline-none bg-indigo-50/55 text-indigo-950 font-bold"
                      />
                    </div>
                  </div>

                  {/* Excel File Drop Area */}
                  <div 
                    id="excel-drop-zone"
                    onDragEnter={handleExcelDrag}
                    onDragOver={handleExcelDrag}
                    onDragLeave={handleExcelDrag}
                    onDrop={handleExcelDrop}
                    onClick={triggerExcelFileInput}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${
                      excelDragActive 
                        ? 'border-indigo-600 bg-indigo-50/40' 
                        : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50/50'
                    }`}
                  >
                    <input 
                      ref={excelFileInputRef}
                      type="file" 
                      accept=".xlsx, .xls"
                      onChange={handleExcelFileChange}
                      className="hidden" 
                    />
                    <div className="p-2 bg-indigo-50 rounded-full mb-2 text-indigo-900">
                      <Upload size={16} className="stroke-[2.5]" />
                    </div>
                    <p className="text-xs font-black text-slate-700">여기에 EXCEL 파일을 끌어다놓거나 클릭하세요</p>
                    <p className="text-[10px] text-slate-450 mt-1">.xlsx, .xls 확장자만 업로드 가능합니다.</p>
                  </div>
                </div>

                {excelErrorMsg && (
                  <div id="excel-error-panel" className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-semibold mt-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span className="whitespace-pre-line">{excelErrorMsg}</span>
                  </div>
                )}
              </div>

              {/* Card 2: PDF Upload (나이스 종합 성적 & 학생 서명 확정) */}
              <div id="pdf-upload-container" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="border-b border-rose-100 pb-3 flex items-center justify-between">
                    <span className="bg-rose-50 text-rose-800 text-[10px] uppercase font-black px-2.5 py-1 rounded-md">최종 확인 및 서명 제출 단계</span>
                    <span className="text-[10px] text-rose-400 font-bold">2단계 (나이스 PDF 자료)</span>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      📄 나이스 최종 종합 PDF 등록
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                      최종 전체 종합 결과가 표기된 나이스 성적 PDF 파일을 업로드합니다. (업로드 시 자동으로 학생 서명 제출 활성화)
                    </p>
                  </div>

                  {/* PDF Specific Metadata Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="pdf-subject-input" className="block text-[11px] font-bold text-slate-700 mb-1">평가 과목명</label>
                      <input 
                        id="pdf-subject-input"
                        type="text"
                        value={pdfSubject}
                        onChange={(e) => setPdfSubject(e.target.value)}
                        placeholder="예: 정보"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="pdf-target-grade-class-input" className="block text-[11px] font-bold text-indigo-950 mb-1">👥 대상 학년반</label>
                      <input 
                        id="pdf-target-grade-class-input"
                        type="text"
                        value={pdfTargetGradeClass}
                        onChange={(e) => setPdfTargetGradeClass(e.target.value)}
                        placeholder="예: 107"
                        className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/10 text-indigo-950 font-black rounded-xl text-xs focus:outline-none text-center"
                      />
                    </div>
                  </div>

                  <div id="pdf-notifying-banner" className="bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-lg text-[10px] text-slate-600 leading-normal">
                    <span>💡 <strong>필독:</strong> <strong>대상 학년반</strong>(예: 1학년 7반은 107)을 정확히 입력해 주십시오. </span>
                  </div>

                  {/* PDF File Drop Area */}
                  <div 
                    id="pdf-drop-zone"
                    onDragEnter={handlePdfDrag}
                    onDragOver={handlePdfDrag}
                    onDragLeave={handlePdfDrag}
                    onDrop={handlePdfDrop}
                    onClick={triggerPdfFileInput}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${
                      pdfDragActive 
                        ? 'border-rose-600 bg-rose-50/40' 
                        : 'border-slate-300 hover:border-rose-500 hover:bg-slate-50/50'
                    }`}
                  >
                    <input 
                      ref={pdfFileInputRef}
                      type="file" 
                      accept=".pdf, .xlsx, .xls"
                      onChange={handlePdfFileChange}
                      className="hidden" 
                    />
                    <div className="p-2 bg-rose-50 rounded-full mb-2 text-rose-900">
                      <Upload size={16} className="stroke-[2.5]" />
                    </div>
                    <p className="text-xs font-black text-rose-950">여기에 PDF 파일을 끌어다놓거나 클릭하세요</p>
                    <p className="text-[10px] text-slate-450 mt-1">.pdf 확장자만 업로드 가능합니다.</p>
                  </div>
                </div>

                {pdfErrorMsg && (
                  <div id="pdf-error-panel" className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-semibold mt-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span className="whitespace-pre-line">{pdfErrorMsg}</span>
                  </div>
                )}
              </div>

              {/* Card 3: [TEST] Excel Upload for Final Sign-off */}
              <div id="test-excel-sign-container" className="bg-white p-5 rounded-2xl border border-emerald-250 bg-emerald-50/5 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="border-b border-emerald-100 pb-3 flex items-center justify-between">
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] uppercase font-black px-2.5 py-1 rounded-md">신규 시범 적용 공간</span>
                    <span className="text-[10px] text-emerald-600 font-bold">3단계 [테스트] 엑셀 최종종합 등록</span>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      📊 [테스트] 엑셀 종합 성적 & 서명 등록
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                      PDF 정밀인식 대신, 나이스 종합 엑셀 일람표를 바로 대조 등록하여 학생들에게 빠른 최종 확인 및 서명 카드를 제공합니다.
                    </p>
                  </div>

                  {/* Metadata Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="test-excel-subject-input" className="block text-[11px] font-bold text-slate-700 mb-1">평가 과목명</label>
                      <input 
                        id="test-excel-subject-input"
                        type="text"
                        value={testExcelSubject}
                        onChange={(e) => setTestExcelSubject(e.target.value)}
                        placeholder="예: 정보"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="test-excel-target-class-input" className="block text-[11px] font-bold text-emerald-950 mb-1">👥 대상 학년반</label>
                      <input 
                        id="test-excel-target-class-input"
                        type="text"
                        value={testExcelTargetGradeClass}
                        onChange={(e) => setTestExcelTargetGradeClass(e.target.value)}
                        placeholder="예: 107"
                        className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50 text-emerald-950 font-black rounded-xl text-xs focus:outline-none text-center"
                      />
                    </div>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-200/50 p-2.5 rounded-lg text-[10px] text-slate-600 leading-normal">
                    <span>💡 <strong>필독:</strong> <strong>대상 학년반</strong>(예: 107)을 정확하게 채워주세요. 이 반 소속 학생들에게 직접 매칭 성적 및 최종 학생 서명패드가 즉시 동작합니다.</span>
                  </div>

                  {/* Excel File Drop Area */}
                  <div 
                    id="test-excel-drop-zone"
                    onDragEnter={handleTestExcelDrag}
                    onDragOver={handleTestExcelDrag}
                    onDragLeave={handleTestExcelDrag}
                    onDrop={handleTestExcelDrop}
                    onClick={triggerTestExcelFileInput}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${
                      testExcelDragActive 
                        ? 'border-emerald-600 bg-emerald-100/40' 
                        : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30'
                    }`}
                  >
                    <input 
                      ref={testExcelFileInputRef}
                      type="file" 
                      accept=".xlsx, .xls"
                      onChange={handleTestExcelFileChange}
                      className="hidden" 
                    />
                    <div className="p-2 bg-emerald-100 rounded-full mb-2 text-emerald-900">
                      <Upload size={16} className="stroke-[2.5]" />
                    </div>
                    <p className="text-xs font-black text-emerald-950">여기에 대조용 EXCEL 파일을 끌어다놓거나 클릭하세요</p>
                    <p className="text-[10px] text-slate-450 mt-1">.xlsx, .xls 확장자만 업로드 가능합니다.</p>
                  </div>
                </div>

                {testExcelErrorMsg && (
                  <div id="test-excel-error-panel" className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-semibold mt-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span className="whitespace-pre-line">{testExcelErrorMsg}</span>
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* Selected evaluation active configurations panel */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Box A: Details & Metadata settings */}
              <div className="md:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100 uppercase tracking-tight">
                  <BookOpen size={14} className="text-slate-500" />
                  {activeEval.uploadType === 'pdf' || activeEval.uploadType === 'test_excel_sign' ? '최종 서명표 정보 편집' : '수행평가 등록 정보'}
                </h3>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="eval-subject-txt" className="block text-[10px] font-extrabold text-slate-500 mb-1">
                      1. 평가 과목명
                    </label>
                    <input 
                      id="eval-subject-txt"
                      type="text"
                      value={subjectInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSubjectInput(val);
                        propagateSplitChanges(val, roundInput, detailNameInput, maxScoreInput, reflectRateInput, targetGradeClass);
                      }}
                      placeholder="예: 정보 과학"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none font-semibold text-slate-800 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="eval-round-txt" className="block text-[10px] font-extrabold text-slate-500 mb-1">
                      2. 평가 차시 (n차)
                    </label>
                    <input 
                      id="eval-round-txt"
                      type="text"
                      value={roundInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const val = raw.replace(/차$/, '').trim();
                        setRoundInput(val);
                        propagateSplitChanges(subjectInput, val, detailNameInput, maxScoreInput, reflectRateInput, targetGradeClass);
                      }}
                      placeholder="예: 1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none font-semibold text-center font-mono text-slate-800 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="eval-detail-txt" className="block text-[10px] font-extrabold text-slate-500 mb-1">
                      3. 수행평가 이름
                    </label>
                    <input 
                      id="eval-detail-txt"
                      type="text"
                      value={detailNameInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDetailNameInput(val);
                        propagateSplitChanges(subjectInput, roundInput, val, maxScoreInput, reflectRateInput, targetGradeClass);
                      }}
                      placeholder="예: 알고리즘 설계"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none font-semibold text-slate-800 bg-slate-50"
                    />
                  </div>

                  {activeEval.uploadType === 'pdf' || activeEval.uploadType === 'test_excel_sign' ? (
                    <div>
                      <label htmlFor="eval-target-gc" className="block text-[10px] font-extrabold text-slate-500 mb-1">
                        4. 학년반
                      </label>
                      <input 
                        id="eval-target-gc"
                        type="text"
                        value={targetGradeClass}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTargetGradeClass(val);
                          propagateSplitChanges(subjectInput, roundInput, detailNameInput, maxScoreInput, reflectRateInput, val);
                        }}
                        placeholder="예: 101, 102"
                        className="w-full px-3 py-2 border border-indigo-200 rounded-xl text-xs focus:outline-none font-bold text-center text-slate-800 bg-indigo-50/40"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="eval-maxscore-txt" className="block text-[10px] font-extrabold text-slate-500 mb-1">
                          4. 수행평가 만점
                        </label>
                        <input 
                          id="eval-maxscore-txt"
                          type="text"
                          value={maxScoreInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setMaxScoreInput(val);
                            propagateSplitChanges(subjectInput, roundInput, detailNameInput, val, reflectRateInput, targetGradeClass);
                          }}
                          placeholder="예: 20"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none font-semibold text-center font-mono text-indigo-950 bg-indigo-50/40 border-indigo-250"
                        />
                      </div>

                      <div>
                        <label htmlFor="eval-reflectrate-txt" className="block text-[10px] font-extrabold text-slate-500 mb-1">
                          5. 실제 반영 비율 (%)
                        </label>
                        <input 
                          id="eval-reflectrate-txt"
                          type="text"
                          value={reflectRateInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setReflectRateInput(val);
                            propagateSplitChanges(subjectInput, roundInput, detailNameInput, maxScoreInput, val, targetGradeClass);
                          }}
                          placeholder="예: 30"
                          className="w-full px-3 py-2 border border-indigo-200 rounded-xl text-xs focus:outline-none font-bold text-center font-mono text-indigo-950 bg-indigo-50/55"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-450 space-y-1">
                  {activeEval.uploadType === 'pdf' || activeEval.uploadType === 'test_excel_sign' ? (
                    <>
                      <div className="flex justify-between">
                        <span>파일 형식:</span>
                        <strong className="text-emerald-700 font-bold">
                          {activeEval.uploadType === 'pdf' ? '나이스 PDF 자료' : '서명용 엑셀 자료 [테스트]'}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>허용 반 목록:</span>
                        <strong className="text-indigo-950 font-extrabold">{activeEval.targetGradeClass || '없음'}</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>학생 인원수:</span>
                        <strong className="text-slate-800 font-bold">{activeEval.rows.length}명</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>칼럼 정보:</span>
                        <strong className="text-slate-800 font-bold">{activeEval.headers.length}개</strong>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span>최종 업로드:</span>
                    <span className="font-mono text-slate-800 text-[9px] truncate max-w-[125px]">{activeEval.uploadedAt || '없음'}</span>
                  </div>
                </div>
              </div>

              {/* Box B: Table Data Selector Preview details */}
              <div className="md:col-span-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                <div className="justify-between flex items-center border-b border-slate-100 pb-1.5">
                  <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-600" />
                    실시간 동기화 상태 원격 점검
                  </h3>
                  <span className="text-[9px] bg-indigo-100 text-indigo-800 font-black px-1.5 py-0.5 rounded-md">
                    클라우드 보존 방식
                  </span>
                </div>

                {activeEval.uploadType === 'pdf' || activeEval.uploadType === 'test_excel_sign' ? (
                  <div className="space-y-4">
                    <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 text-[11px] text-slate-700 leading-relaxed font-semibold">
                      <p className="text-emerald-955 font-bold flex items-center gap-1 text-xs mb-1">
                        <CheckCircle2 size={14} className="text-emerald-700" />
                        안내: {activeEval.uploadType === 'pdf' ? '전체 성적 PDF 문서 보존' : '서명용 최종 엑셀 대조 점수 보존 [테스트]'}
                      </p>
                      <span>
                        {activeEval.uploadType === 'pdf'
                          ? '이 평가는 요약성적 PDF 업로드 방식으로 제공됩니다. 지정한 학년반 코드와 일치하는 학생들은 로그인 시 엑셀 점수 대신 이 PDF 파일을 모바일 및 PC 브라우저에서 편리하게 즉시 조회하거나 내려받을 수 있습니다.'
                          : '이 평가는 엑셀 서명용 등록 방식으로 제공됩니다. 지정한 학년반 코드와 일치하는 학생들은 로그인 시 복잡한 AI PDF 추출 대기 없이 이 엑셀 결과를 모바일 및 PC 화면에서 빠르게 1:1로 아주 간편하게 조회/서명할 수 있습니다.'
                        }
                      </span>
                    </div>

                    {activeEval.uploadType === 'pdf' ? (
                      <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-red-100 text-red-700 rounded-xl">
                            <BookOpen size={24} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800 truncate max-w-[200px] sm:max-w-xs" title={activeEval.pdfFileName}>
                              {activeEval.pdfFileName || '성적_결과통지표.pdf'}
                            </p>
                            <p className="text-[10px] text-slate-450 font-mono">대상 학년반: {activeEval.targetGradeClass || '미지정'}</p>
                          </div>
                        </div>
                        <button
                          onClick={downloadActiveEvalPdf}
                          className="px-3.5 py-1.5 bg-indigo-900 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          📥 파일 다운로드
                        </button>
                      </div>
                    ) : (
                      <div className="border border-emerald-250 rounded-xl p-4 bg-emerald-50/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                            <FileSpreadsheet size={24} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800 truncate max-w-[200px] sm:max-w-xs" title={activeEval.pdfFileName}>
                              {activeEval.pdfFileName || '종합_성적_대조표.xlsx'}
                            </p>
                            <p className="text-[10px] text-emerald-700 font-bold font-mono">대상 학년반: {activeEval.targetGradeClass || '미지정'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {isExtractingPdf && activeEval.uploadType === 'pdf' && (
                      <div className="p-3 bg-rose-50 text-rose-950 border border-rose-200/60 rounded-xl flex items-center gap-2.5 text-[11px] font-bold animate-pulse">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                        <span>AI OCR 복원 엔진이 일람표 문서의 표 구조와 점수를 분석하고 정밀 대조하는 중입니다...</span>
                      </div>
                    )}

                    {pdfExtractError && !isExtractingPdf && activeEval.uploadType === 'pdf' && (
                      <div className="p-4 bg-rose-50 border border-rose-150 rounded-xl flex items-start gap-2.5 text-[11px] text-rose-850 font-semibold leading-relaxed">
                        <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                        <div className="space-y-1">
                          <p className="font-extrabold">{pdfExtractError}</p>
                          <p className="text-[9.5px] text-slate-500 font-medium leading-normal pt-1 border-t border-rose-100/35">
                            참고: PDF의 본문 텍스트가 식별 가능한 구조여야 학번 및 평가항목 점수를 자동으로 파싱할 수 있습니다.
                          </p>
                        </div>
                      </div>
                    )}

                    {activeEval.rows && activeEval.rows.length > 0 && (!isExtractingPdf || activeEval.uploadType === 'test_excel_sign') && (
                      <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-250 rounded-xl flex items-start gap-1.5 text-[11px] leading-relaxed">
                        <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-700" />
                        <div className="text-emerald-950 font-semibold">
                          <span className="font-bold block text-emerald-900">
                            {activeEval.uploadType === 'pdf' ? '클라우드 PDF 자동 동기화 완료' : '클라우드 엑셀 동기화 및 서명 활성 완료'}
                          </span>
                          성공적으로 학급 일람표에서 <strong className="text-indigo-950 underline">{activeEval.rows.length}명</strong>의 학생 데이터를 자동 추출하여 하단 검증 대조 테이블에 적재 완료했습니다!
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-650 leading-relaxed font-semibold">
                      <p className="text-slate-800 font-bold flex items-center gap-1 text-xs mb-1">
                        <Info size={14} className="text-indigo-600" />
                        안내: 다중 데이터 운영원칙
                      </p>
                      <span>
                        엑셀을 업로드할 때 지정하신 교과 메타정보는 즉시 클라우드 Firestore에 별도의 고유 성적표 셋으로 기록 보존됩니다. 학생은 본인의 학과 선생님 아래로 개설된 모든 수행평가 결과 목록들을 1:1 드롭다운으로 실시간 조회할 권한을 가집니다.
                      </span>
                    </div>

                    <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-250 rounded-xl flex items-start gap-1.5 text-[11px] leading-relaxed">
                      <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-700" />
                      <div className="text-emerald-950 font-semibold">
                        <span className="font-bold block text-emerald-900">클라우드 파싱 완료</span>
                        성공적으로 학생 식별자{' '}
                        (<span className="font-bold underline text-indigo-950">학번: {studentIdKey || '없음'}</span>
                        {birthdateKey ? (
                          <>
                            , <span className="font-bold underline text-indigo-950">생년월일: {birthdateKey}</span>
                          </>
                        ) : (
                          <>
                            , <span className="bg-indigo-100 text-indigo-950 px-1.5 py-0.5 rounded font-bold ml-1 text-[10px]">(관리자 전체 명단 연동 완료)</span>
                          </>
                        )})가 활성화되어 설정되었습니다.
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Core spreadsheet preview rows table container */}
          {activeEval && activeEval.rows.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-4 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-800">수행평가 성적 원본 대조 일람표 ({previewRows.length}행)</h3>
                  <p className="text-[10px] text-slate-400">학생 데이터 검색</p>
                </div>
                
                <div className="relative max-w-xs w-full">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search size={14} />
                  </span>
                  <input 
                    type="text" 
                    placeholder="검색어 입력..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[300px]">
                <table className="w-full text-left text-[11px] border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 sticky top-0 font-bold">
                      <th className="py-2 px-2.5 text-center w-10 border-r border-slate-200">No.</th>
                      {activeEval.headers.map((header, hIdx) => {
                        const isId = header === studentIdKey;
                        const isBirth = header === birthdateKey;
                        const isFeedback = feedbackKeys.includes(header);
                        
                        return (
                          <th 
                            key={`${header}-${hIdx}`} 
                            className={`py-2 px-2.5 whitespace-nowrap ${
                              isId || isBirth 
                                ? 'bg-slate-200/80 text-slate-900 font-extrabold border-x border-slate-250' 
                                : isFeedback 
                                  ? 'bg-indigo-50 text-indigo-950 font-extrabold' 
                                  : ''
                            }`}
                          >
                            <span className="inline-flex items-center gap-0.5">
                              {header}
                              {isId && <span className="text-[9px] bg-indigo-200 text-indigo-850 px-1 rounded-sm">학번</span>}
                              {isBirth && <span className="text-[9px] bg-emerald-200 text-emerald-850 px-1 rounded-sm">생일</span>}
                              {isFeedback && <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded-sm">피드백</span>}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors font-semibold">
                        <td className="py-1.5 px-2.5 text-center text-slate-400 font-mono border-r border-slate-200">{idx + 1}</td>
                        {activeEval.headers.map((header, hIdx) => {
                          const val = row[header];
                          const isId = header === studentIdKey;
                          const isBirth = header === birthdateKey;
                          const isFeedback = feedbackKeys.includes(header);
                          
                          return (
                            <td 
                              key={`${header}-${hIdx}`} 
                              className={`py-1.5 px-2.5 whitespace-nowrap overflow-hidden max-w-xs text-ellipsis font-medium ${
                                isId || isBirth 
                                  ? 'bg-slate-100/50 text-slate-900 border-x border-slate-200 font-mono' 
                                  : isFeedback 
                                    ? 'text-indigo-855' 
                                    : 'text-slate-600'
                              }`}
                            >
                              {val !== undefined && val !== null ? String(val) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>

      {isPrintOpen && (
        <ResultPrintPortal 
          myEvaluations={myEvaluations}
          signatures={signatures}
          loggedTeacher={loggedTeacher}
          subjectMaxScores={subjectMaxScores}
          onClose={() => setIsPrintOpen(false)}
          allStudents={allStudents}
        />
      )}

      {isChangePasswordOpen && (
        <div id="teacher-password-change-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn print:hidden">
          <div className="bg-white border border-slate-200 shadow-xl rounded-2xl max-w-sm w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-indigo-900 text-white px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-extrabold flex items-center gap-1.5">
                <Key size={16} className="text-amber-400" /> 교사용 비밀번호 변경
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
                <span className="text-[10px] text-indigo-900 font-extrabold block">로그인 중인 선생님</span>
                <p className="text-xs font-bold text-slate-800">
                  {loggedTeacher.name} 선생님 (코드: {loggedTeacher.code})
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1" htmlFor="teacher-new-password">
                  새 비밀번호 입력
                </label>
                <input 
                  id="teacher-new-password"
                  type="password"
                  placeholder="새로운 비밀번호"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1" htmlFor="teacher-confirm-password">
                  새 비밀번호 확인
                </label>
                <input 
                  id="teacher-confirm-password"
                  type="password"
                  placeholder="새 비밀번호 다시 입력"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold text-slate-800"
                />
              </div>

              {passwordError && (
                <p className="text-xs font-semibold text-red-650 bg-red-50 p-2.5 rounded-xl border border-red-150 whitespace-pre-line leading-relaxed">
                  ⚠️ {passwordError}
                </p>
              )}

              {passwordSuccess && (
                <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-150 leading-relaxed">
                  ✅ {passwordSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={isPasswordSubmitting}
                className={`w-full py-2.5 rounded-xl text-xs font-black shadow-sm transition-all focus:outline-none flex items-center justify-center gap-1 cursor-pointer ${
                  isPasswordSubmitting 
                    ? 'bg-slate-100 text-slate-400 border border-slate-200' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500'
                }`}
              >
                {isPasswordSubmitting ? '변경 처리 중...' : '확인 및 변경 완료'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <div id="delete-confirm-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
          <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-sm w-full overflow-hidden p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <Trash2 size={18} className="animate-bounce" />
              <span className="text-sm font-black tracking-tight">수행평가 파일 삭제 확인</span>
            </div>
            <p className="text-xs text-slate-600 font-semibold leading-relaxed whitespace-pre-line">
              정말로 해당 수행평가 파일을 삭제하시겠습니까?{"\n"}
              삭제 이후에는 학생의 성적 확인 및 서명 조회가 불가능합니다.
            </p>
            <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-1">
              <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-tight">삭제할 파일 제목</span>
              <span className="text-xs font-black text-slate-800 block truncate">{deleteConfirmModal.title}</span>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                className="px-3.5 py-2 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl text-xs transition duration-150 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteConfirmModal.id;
                  setDeleteConfirmModal(null);
                  await onDeleteEvaluation(id);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 border border-rose-500 text-white font-extrabold rounded-xl text-xs transition duration-150 cursor-pointer shadow-xs hover:scale-[1.02]"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
