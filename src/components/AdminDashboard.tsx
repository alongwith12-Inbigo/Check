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
  CalendarDays
} from 'lucide-react';
import { EvaluationState, Teacher } from '../types';
import { findStudentIdKey, findBirthdateKey, findFeedbackKey } from '../utils';
import ResultPrintPortal from './ResultPrintPortal';

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
  teacherSettings?: Record<string, boolean>;
  signatures?: Record<string, string>;
  onToggleSignature?: (enabled: boolean) => void | Promise<void>;
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
    <div className="flex items-center gap-1.5 shrink-0">
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
        className="w-16 px-1.5 py-1 text-center border border-slate-300 rounded font-black text-xs text-indigo-900 font-mono bg-white focus:outline-none focus:border-indigo-500 transition-colors"
      />
      <span className="text-[10px] font-bold text-slate-400">점</span>
      
      {/* Visual Indicator of Save Success */}
      <div className="w-14 flex items-center text-[10px] font-bold h-5 select-none">
        {isSaving && (
          <span className="text-amber-500 animate-pulse flex items-center gap-0.5">
            ⌛ 저장중
          </span>
        )}
        {hasSaved && !isSaving && (
          <span className="text-emerald-600 flex items-center gap-0.5 animate-fadeIn">
            ✅ 저장됨
          </span>
        )}
      </div>
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
  teacherSettings = {},
  signatures = {},
  onToggleSignature = () => {}
}: AdminDashboardProps) {
  const [errorMsg, setErrorMsg] = useState('');
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active evaluation being edited
  const activeEval = myEvaluations.find(e => e.id === activeEvaluationId);

  // Text inputs
  const [subjectInput, setSubjectInput] = useState('');
  const [roundInput, setRoundInput] = useState('');
  const [detailNameInput, setDetailNameInput] = useState('');
  const [maxScoreInput, setMaxScoreInput] = useState('');
  const [reflectRateInput, setReflectRateInput] = useState('100');
  
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
    } else {
      setSubjectInput('');
      setRoundInput('');
      setDetailNameInput('');
      setMaxScoreInput('');
      setReflectRateInput('100');
    }
    setErrorMsg('');
  }, [activeEvaluationId, activeEval]);

  const propagateSplitChanges = (subject: string, round: string, detail: string, maxS: string, reflectR: string) => {
    if (!activeEval || !activeEvaluationId) return;

    let combinedTitle = '';
    const cleanSub = subject.trim();
    const cleanRnd = round.trim();
    const cleanDet = detail.trim();
    const cleanMax = maxS.trim();
    const cleanRef = reflectR.trim();

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

    onUpdateEvaluation(activeEvaluationId, {
      ...activeEval,
      subject: cleanSub,
      round: cleanRnd,
      evaluationDetailName: cleanDet,
      maxScore: cleanMax,
      reflectRate: cleanRef,
      title: combinedTitle
    });
  };

  const processExcelFile = async (file: File) => {
    setErrorMsg('');
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
          setErrorMsg('엑셀 파일에 유효한 데이터가 존재하지 않습니다.');
          return;
        }

        const studentIdKey = findStudentIdKey(cleanHeaders);
        const birthdateKey = findBirthdateKey(cleanHeaders);

        if (!studentIdKey || !birthdateKey) {
          setErrorMsg(
            `필수 열이 누락되어 업로드할 수 없습니다.\n학생 식별을 위해 엑셀 내에 '학번'과 '생년월일' 문항이 들어간 열이 반드시 필요합니다.\n\n` + 
            `감지된 열 목록: [${cleanHeaders.join(', ')}]`
          );
          return;
        }

        // Initialize state for new evaluation
        const defaultSubject = subjectInput.trim() || '정보';
        const defaultRound = roundInput.trim() || '1';
        const defaultDetail = detailNameInput.trim() || '수행평가';
        const defaultMax = maxScoreInput.trim() || '20';
        const defaultReflect = reflectRateInput.trim() || '100';
        const initialTitle = `${defaultSubject} (${defaultRound}차) 수행평가: ${defaultDetail}`;

        const newEvalMetadata: EvaluationState = {
          title: initialTitle,
          subject: defaultSubject,
          round: defaultRound,
          evaluationDetailName: defaultDetail,
          maxScore: defaultMax,
          reflectRate: defaultReflect,
          headers: cleanHeaders,
          rows: rawRows,
          uploadedAt: new Date().toLocaleString('ko-KR')
        };

        const newId = await onCreateEvaluation(newEvalMetadata);
        onSelectEvaluationId(newId);
        setErrorMsg('');
      } catch (err) {
        console.error(err);
        setErrorMsg('엑셀 파일을 파싱하는 과정에서 에러가 발생했습니다. 파일 형식을 다시 점검해 주십시오.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteActive = async (idToDelete: string) => {
    if (window.confirm('이 성적 파일을 정말 삭제합니까? 파일 삭제 시 점수 조회는 불가합니다.')) {
      await onDeleteEvaluation(idToDelete);
    }
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
                등록된 성적 파일이 없습니다.<br/>새로운 엑셀 파일을 업로드 하세요.
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {myEvaluations.map((item) => {
                  const isActive = item.id === activeEvaluationId;
                  return (
                    <div 
                      key={item.id} 
                      className={`group p-3 rounded-xl border text-left cursor-pointer transition-all flex justify-between items-start gap-1 ${
                        isActive 
                          ? 'bg-indigo-50 border-indigo-300 shadow-xs' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => onSelectEvaluationId(item.id || '')}
                    >
                      <div className="space-y-1 overflow-hidden">
                        <span className="block text-xs font-black text-slate-800 truncate" title={item.title}>
                          {item.title}
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {item.uploadedAt || '시각 없음'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteActive(item.id || '');
                        }}
                        className="p-1 bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                        title="파일 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
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
                      <div key={sub} className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-150 rounded-xl p-2.5">
                        <span className="text-xs font-black text-slate-700 truncate max-w-[100px]" title={sub}>
                          {sub}
                        </span>
                        <SubjectMaxScoreInput 
                          subject={sub}
                          initialValue={dbMaxScore}
                          onSave={async (newVal) => {
                            await onUpdateSubjectMaxScore(sub, newVal);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Student Signature Configuration Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-850 flex items-center gap-1.5 pb-2 border-b border-indigo-100 uppercase tracking-tight">
              ✍️ 학생 서명 기능 활성화
            </h3>
            <p className="text-[10px] text-slate-450 leading-normal">
              학생들이 자신의 수행평가 점수 조회 결과 화면 최하단에서 직접 자율 서명 후 저장할 수 있도록 기능을 활성화합니다.
            </p>
            <div className="flex items-center justify-between bg-slate-50 border border-slate-150 rounded-xl p-3">
              <span className="text-xs font-bold text-slate-700">학생 서명 활성화</span>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={!!teacherSettings[loggedTeacher.code]}
                  onChange={(e) => onToggleSignature(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-900"></div>
              </label>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              상태: {!!teacherSettings[loggedTeacher.code] ? (
                <span className="text-emerald-600 font-bold">🟢 활성화됨 (학생 조회 시 서명란 표시)</span>
              ) : (
                <span className="text-slate-500 font-bold">⚪ 비활성화됨 (점수만 단순 조회)</span>
              )}
            </div>
          </div>
        </div>

        {/* Column 2 & 3: File Upload Area & Config controls */}
        <div className="lg:col-span-3 space-y-5">
          
          {/* New uploads or selected settings block */}
          {activeEvaluationId === '' || !activeEval ? (
            /* Upload layout state for entering new sheet */
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <span className="bg-indigo-50 text-indigo-800 text-[10px] uppercase font-black px-2.5 py-1 rounded-md">Step 1</span>
                <h3 className="text-sm font-black text-slate-900 mt-2">새로운 엑셀 파일 업로드</h3>
                <p className="text-[11px] text-slate-450 leading-normal mt-0.5">
                  수행평가 점수가 입력된 엑셀 파일을 아래에 업로드하세요.
                </p>
              </div>

              {/* Setting default metadata details BEFORE files uploads to speed metadata configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">평가 과목명</label>
                  <input 
                    type="text"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    placeholder="예: 정보"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">평가 차시 (차)</label>
                  <input 
                    type="text"
                    value={roundInput}
                    onChange={(e) => setRoundInput(e.target.value)}
                    placeholder="예: 1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-center font-mono focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">수행평가 상세 이름</label>
                  <input 
                    type="text"
                    value={detailNameInput}
                    onChange={(e) => setDetailNameInput(e.target.value)}
                    placeholder="예: 빅데이터 분석 프로젝트"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">수행평가 총 만점</label>
                  <input 
                    type="text"
                    value={maxScoreInput}
                    onChange={(e) => setMaxScoreInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="예: 20"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-center font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">실제 반영 비율 (%)</label>
                  <input 
                    type="text"
                    value={reflectRateInput}
                    onChange={(e) => setReflectRateInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="예: 30"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-center font-mono focus:outline-none bg-indigo-50/55 text-indigo-950 font-bold"
                  />
                </div>
                <div className="sm:col-span-2 bg-slate-50 border border-slate-150 p-2 text-[10px] text-slate-505 rounded-lg flex items-start gap-1 mt-1 leading-normal">
                  <Info size={13} className="text-slate-600 shrink-0 mt-0.5" />
                  <span>설정하고 아래 드래그 공간에 엑셀을 업로드하면 실제 반영 비율이 함께 기록 보존됩니다!</span>
                </div>
              </div>

              {/* Upload Drop area */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                  dragActive 
                    ? 'border-indigo-600 bg-indigo-50/40' 
                    : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50/50'
                }`}
              >
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden" 
                />
                <div className="p-2.5 bg-indigo-50 rounded-full mb-2.5 text-indigo-900">
                  <Upload size={20} className="stroke-[2.5]" />
                </div>
                <p className="text-xs font-black text-slate-700">여기에 엑셀 파일을 드래그하여 드롭하거나 마우스 클릭하세요</p>
                <p className="text-[10px] text-slate-400 mt-1">.xlsx, .xls 파일 형식만 처리 가능합니다.</p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-semibold">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="whitespace-pre-line">{errorMsg}</span>
                </div>
              )}
            </div>
          ) : (
            /* Selected evaluation active configurations panel */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Box A: Details & Metadata settings */}
              <div className="md:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100 uppercase tracking-tight">
                  <BookOpen size={14} className="text-slate-500" />
                  수행평가 등록
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
                        propagateSplitChanges(val, roundInput, detailNameInput, maxScoreInput, reflectRateInput);
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
                        propagateSplitChanges(subjectInput, val, detailNameInput, maxScoreInput, reflectRateInput);
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
                        propagateSplitChanges(subjectInput, roundInput, val, maxScoreInput, reflectRateInput);
                      }}
                      placeholder="예: 알고리즘 설계"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none font-semibold text-slate-800 bg-slate-50"
                    />
                  </div>

                  {/* Max Score entry requested */}
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
                        propagateSplitChanges(subjectInput, roundInput, detailNameInput, val, reflectRateInput);
                      }}
                      placeholder="예: 20"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none font-semibold text-center font-mono text-indigo-950 bg-indigo-50/40 border-indigo-250"
                    />
                  </div>

                  {/* Reflection rate entry */}
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
                        propagateSplitChanges(subjectInput, roundInput, detailNameInput, maxScoreInput, val);
                      }}
                      placeholder="예: 30"
                      className="w-full px-3 py-2 border border-indigo-200 rounded-xl text-xs focus:outline-none font-bold text-center font-mono text-indigo-950 bg-indigo-50/55"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-450 space-y-1">
                  <div className="flex justify-between">
                    <span>학생 인원수:</span>
                    <strong className="text-slate-800 font-bold">{activeEval.rows.length}명</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>칼럼 정보:</span>
                    <strong className="text-slate-800 font-bold">{activeEval.headers.length}개</strong>
                  </div>
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
                    (<span className="font-bold underline text-indigo-950">학번: {studentIdKey || '없음'}</span>,{' '}
                    <span className="font-bold underline text-indigo-950">생년월일: {birthdateKey || '없음'}</span>)가 활성화되어 있습니다.
                  </div>
                </div>
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
                      {activeEval.headers.map((header) => {
                        const isId = header === studentIdKey;
                        const isBirth = header === birthdateKey;
                        const isFeedback = feedbackKeys.includes(header);
                        
                        return (
                          <th 
                            key={header} 
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
                        {activeEval.headers.map((header) => {
                          const val = row[header];
                          const isId = header === studentIdKey;
                          const isBirth = header === birthdateKey;
                          const isFeedback = feedbackKeys.includes(header);
                          
                          return (
                            <td 
                              key={header} 
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
        />
      )}

    </div>
  );
}
