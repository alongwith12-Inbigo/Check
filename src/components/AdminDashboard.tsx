import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Eye, 
  EyeOff, 
  Key, 
  RefreshCw,
  Search,
  BookOpen,
  Info
} from 'lucide-react';
import { EvaluationState } from '../types';
import { findStudentIdKey, findBirthdateKey, findFeedbackKey } from '../utils';

interface AdminDashboardProps {
  evaluationState: EvaluationState;
  onUpdateState: (newState: EvaluationState) => void;
  onClose: () => void;
}

export default function AdminDashboard({ 
  evaluationState, 
  onUpdateState, 
  onClose 
}: AdminDashboardProps) {
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  // Split title inputs
  const [subjectInput, setSubjectInput] = useState(evaluationState.subject || '');
  const [roundInput, setRoundInput] = useState(evaluationState.round || '');
  const [detailNameInput, setDetailNameInput] = useState(evaluationState.evaluationDetailName || '');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const propagateSplitTitle = (subject: string, round: string, detail: string) => {
    let combinedTitle = '';
    const cleanSub = subject.trim();
    const cleanRnd = round.trim();
    const cleanDet = detail.trim();

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

    onUpdateState({
      ...evaluationState,
      subject: cleanSub,
      round: cleanRnd,
      evaluationDetailName: cleanDet,
      title: combinedTitle
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1004') {
      setIsUnlocked(true);
      setPasswordError(false);
      setErrorMsg('');
    } else {
      setPasswordError(true);
      setIsUnlocked(false);
    }
  };

  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to json rows (array of objects)
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
        
        // Extract headers from first row
        const headersJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
        const cleanHeaders = (headersJson || []).filter(h => h && String(h).trim() !== "");

        if (cleanHeaders.length === 0 || rawRows.length === 0) {
          setErrorMsg('엑셀 파일에 유효한 데이터가 존재하지 않습니다.');
          return;
        }

        // Validate required columns
        const studentIdKey = findStudentIdKey(cleanHeaders);
        const birthdateKey = findBirthdateKey(cleanHeaders);

        if (!studentIdKey || !birthdateKey) {
          setErrorMsg(
            `필수 열이 누락되어 업로드할 수 없습니다.\n학생 로그인을 위해 엑셀 내에 '학번'과 '생년월일'이 포함된 열이 반드시 필요합니다.\n\n` + 
            `감지된 열: [${cleanHeaders.join(', ')}]`
          );
          return;
        }

        // Success! Update evaluation dataset while preserving existing split title values
        const currentTitle = subjectInput && roundInput && detailNameInput
          ? `${subjectInput.trim()} (${roundInput.trim()}차) 수행평가: ${detailNameInput.trim()}`
          : (evaluationState.title || '수행평가 결과');

        onUpdateState({
          ...evaluationState,
          title: currentTitle,
          subject: subjectInput,
          round: roundInput,
          evaluationDetailName: detailNameInput,
          headers: cleanHeaders,
          rows: rawRows,
          uploadedAt: new Date().toLocaleString('ko-KR')
        });
        setErrorMsg('');
      } catch (err) {
        console.error(err);
        setErrorMsg('엑셀 파일을 읽는 도중 오류가 발생했습니다. 올바른 Excel 형식 파일(.xlsx, .xls)을 업로드해 주세요.');
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

  const handleReset = () => {
    if (window.confirm('기존의 모든 평가 데이터가 삭제됩니다. 정말 초기화하시겠습니까?')) {
      onUpdateState({
        title: '신규 수행평가 결과',
        subject: '',
        round: '',
        evaluationDetailName: '',
        headers: [],
        rows: [],
        uploadedAt: null
      });
      setSubjectInput('');
      setRoundInput('');
      setDetailNameInput('');
      setErrorMsg('');
    }
  };

  // Filter preview list
  const previewRows = evaluationState.rows.filter(row => {
    if (!searchTerm) return true;
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const studentIdKey = findStudentIdKey(evaluationState.headers);
  const birthdateKey = findBirthdateKey(evaluationState.headers);
  const feedbackKeys = findFeedbackKey(evaluationState.headers);

  if (!isUnlocked) {
    return (
      <div className="flex items-center justify-center min-h-[85vh] px-4">
        <div id="admin-pass-lock" className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
          <div className="bg-indigo-900 px-6 py-8 text-center text-white relative">
            <div className="absolute top-0 right-0 p-3 opacity-5">
              <Key size={80} />
            </div>
            <div className="inline-flex p-3 bg-white/10 rounded-full mb-3 text-amber-400 border border-white/10">
              <Key size={26} className="stroke-[2.5]" />
            </div>
            <h2 className="text-xl font-extrabold font-sans tracking-tight">관리자 보안 잠금 해제</h2>
            <p className="text-xs text-indigo-200 mt-1.5 font-medium">교사 인증 패스워드를 기입하여 안전하게 진입해 주세요.</p>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider" htmlFor="admin-pwd">교사 관리 패스워드</label>
              <input 
                id="admin-pwd"
                type="password"
                placeholder="비밀번호(1004)를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl text-center font-black tracking-widest text-lg focus:outline-none focus:ring-2 ${
                  passwordError 
                    ? 'border-red-500 bg-red-50/55 focus:ring-red-200' 
                    : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-100'
                }`}
                autoFocus
              />
              {passwordError && (
                <p className="text-xs text-red-600 mt-2.5 flex items-center gap-1 font-medium">
                  <AlertCircle size={14} className="shrink-0" /> 비밀번호가 매칭되지 않습니다. (팁: 1004)
                </p>
              )}
            </div>
            
            <div className="flex gap-2 pt-2">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 py-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer"
              >
                조회 화면으로
              </button>
              <button 
                type="submit" 
                className="flex-1 py-3 bg-indigo-900 border border-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                보안인증 검증하기
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div id="admin-dashboard-layout" className="space-y-6 max-w-5xl mx-auto px-1 sm:px-4 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs px-3 py-1 rounded-full font-extrabold inline-flex items-center gap-1 mb-1.5">
            <CheckCircle2 size={12} className="text-emerald-600" /> 관리자 보안 승인 완료
          </span>
          <h1 className="text-2xl font-extrabold font-sans tracking-tight text-slate-900">수행평가 엑셀 데이터 매뉴얼</h1>
        </div>
        <button 
          onClick={onClose}
          className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 hover:shadow-xs transition cursor-pointer"
        >
          마스터 뷰로 가기
        </button>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Title Setting & Stats */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100 uppercase tracking-tight">
              <BookOpen size={16} className="text-slate-500" />
              수행평가 대제목 조율
            </h3>
            
            <div className="space-y-3.5">
              <div>
                <label htmlFor="eval-subject-input" className="block text-[11px] font-bold text-slate-700 mb-1">
                  1. 평가 과목명
                </label>
                <input 
                  id="eval-subject-input"
                  type="text"
                  value={subjectInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSubjectInput(val);
                    propagateSplitTitle(val, roundInput, detailNameInput);
                  }}
                  placeholder="예: 정보 과학, 소프트웨어, 영어"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold"
                />
              </div>

              <div>
                <label htmlFor="eval-round-input" className="block text-[11px] font-bold text-slate-700 mb-1">
                  2. 평가 차시 (차)
                </label>
                <input 
                  id="eval-round-input"
                  type="text"
                  value={roundInput}
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    // Auto strip trailing "차" if typed manually, to keep formatting clean
                    const cleanVal = rawVal.replace(/차$/, '').trim();
                    setRoundInput(cleanVal);
                    propagateSplitTitle(subjectInput, cleanVal, detailNameInput);
                  }}
                  placeholder="예: 1 또는 2"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold text-center font-mono"
                />
              </div>

              <div>
                <label htmlFor="eval-detail-input" className="block text-[11px] font-bold text-slate-700 mb-1">
                  3. 수행평가 이름
                </label>
                <input 
                  id="eval-detail-input"
                  type="text"
                  value={detailNameInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDetailNameInput(val);
                    propagateSplitTitle(subjectInput, roundInput, val);
                  }}
                  placeholder="예: Python 알고리즘 분석 및 동료 평가"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold"
                />
              </div>

              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/60 text-[11px] text-indigo-900 mt-2 space-y-1">
                <span className="font-extrabold block text-indigo-950 text-[10px] uppercase tracking-wider">실시간 대제목 미리보기</span>
                <p className="font-bold leading-normal break-all">
                  {evaluationState.title || '수행평가 결과'}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">총 인원 집계:</span>
                <span className="font-bold text-slate-800">{evaluationState.rows.length}명</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">컬럼 정보 개수:</span>
                <span className="font-bold text-slate-800">{evaluationState.headers.length}개</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">최근 패치 시각:</span>
                <span className="font-mono text-slate-650">{evaluationState.uploadedAt || '없음'}</span>
              </div>
            </div>
            
            {evaluationState.rows.length > 0 && (
              <button 
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Trash2 size={14} /> 전체 데이터 폐기
              </button>
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5 text-xs text-slate-600">
            <div className="flex gap-2.5">
              <Info size={16} className="text-slate-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-slate-900 block">안내: 업로드 템플릿 제약조건</span>
                <span className="block text-[11px] text-slate-500 leading-relaxed">성공적인 학생 조회를 위해 첫 행 헤더 컬럼명에 아래 키워드가 있어야 합니다:</span>
                <ul className="list-disc pl-4 space-y-0.5 mt-0.5 text-[11px] text-slate-600 font-medium">
                  <li><strong>학번</strong> (예: 학번, ID, 학생고유 ID)</li>
                  <li><strong>생년월일</strong> (예: 생일, 생년월일, 주민번호앞자리)</li>
                  <li><strong>피드백/사유</strong> (개별 맞춤 코멘트 컬럼)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Excel Upload Area */}
        <div id="file-upload-section" className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <FileSpreadsheet size={16} className="text-slate-500" />
              신규 마스터 엑셀 시트 등록
            </h3>

            {/* Drop Zone */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[180px] ${
                dragActive 
                  ? 'border-indigo-600 bg-indigo-50/40 scale-[0.99]' 
                  : 'border-slate-350 hover:border-indigo-500 hover:bg-slate-50/50'
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden" 
              />
              <div className="p-3 bg-indigo-50 rounded-full mb-3 text-indigo-900 group-hover:scale-105 transition duration-150">
                <Upload size={22} className="stroke-[2.5]" />
              </div>
              <p className="text-xs font-bold text-slate-700">여기에 엑셀 파일을 드래그하여 드롭하거나 마우스 클릭하세요</p>
              <p className="text-[10px] text-slate-400 mt-1">.xlsx, .xls 파일 형식만 처리 가능합니다.</p>
            </div>
            
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-medium">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span className="whitespace-pre-line">{errorMsg}</span>
              </div>
            )}

            {evaluationState.rows.length > 0 && !errorMsg && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs">
                <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
                <div className="space-y-0.5 text-slate-700">
                  <span className="font-bold block text-slate-900">엑셀 데이터 파싱이 성공했습니다.</span>
                  <span className="text-[11px] block leading-relaxed">
                    총 <strong className="text-slate-900 font-extrabold">{evaluationState.rows.length}명</strong>의 데이터셋 탑재 완료!
                    로그인 키 {' '}
                    (<span className="text-indigo-900 font-bold">학번 감지: {studentIdKey || '미감지'}</span>, {' '}
                    <span className="text-indigo-900 font-bold">생일 감지: {birthdateKey || '미감지'}</span>)가 정상 확보되었습니다.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data Table Preview */}
      {evaluationState.rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">업로드 완료된 원본 데이터 일람표 (학생 확인용)</h3>
              <p className="text-[11px] text-slate-400">학번, 생년월일과 세부 피드백을 실시간 검색으로 점검하세요.</p>
            </div>
            
            <div className="relative max-w-xs w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search size={16} />
              </span>
              <input 
                type="text" 
                placeholder="전체 항목 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-100 focus:border-indigo-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[350px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                  <th className="py-2.5 px-3 font-semibold text-center w-12 border-r border-slate-200">No.</th>
                  {evaluationState.headers.map((header) => {
                    const isId = header === studentIdKey;
                    const isBirth = header === birthdateKey;
                    const isFeedback = feedbackKeys.includes(header);
                    
                    return (
                      <th 
                        key={header} 
                        className={`py-2.5 px-3 font-semibold whitespace-nowrap min-w-[80px] ${
                          isId || isBirth 
                            ? 'bg-slate-100 border-x border-slate-200 text-slate-900 font-bold' 
                            : isFeedback 
                              ? 'bg-indigo-50 text-indigo-900 font-bold' 
                              : ''
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          {header}
                          {isId && <span className="text-[9px] bg-indigo-200 text-indigo-700 px-1 rounded">학번</span>}
                          {isBirth && <span className="text-[9px] bg-emerald-200 text-emerald-800 px-1 rounded">생일</span>}
                          {isFeedback && <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded">피드백</span>}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.length === 0 ? (
                  <tr>
                    <td colSpan={evaluationState.headers.length + 1} className="text-center py-6 text-slate-400 italic">
                      검색 조건과 일치하는 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  previewRows.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono border-r border-slate-200">{index + 1}</td>
                      {evaluationState.headers.map((header) => {
                        const val = row[header];
                        const isId = header === studentIdKey;
                        const isBirth = header === birthdateKey;
                        const isFeedback = feedbackKeys.includes(header);
                        
                        return (
                          <td 
                            key={header} 
                            className={`py-2 px-3 whitespace-nowrap overflow-hidden max-w-sm text-ellipsis ${
                              isId || isBirth 
                                ? 'bg-slate-50/50 text-slate-900 font-mono font-medium border-x border-slate-200' 
                                : isFeedback 
                                  ? 'text-indigo-800 font-medium' 
                                  : 'text-slate-600'
                            }`}
                          >
                            {val !== undefined && val !== null ? String(val) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
