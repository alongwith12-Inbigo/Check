import React, { useState } from 'react';
import { 
  KeyRound, 
  HelpCircle, 
  AlertCircle, 
  GraduationCap, 
  FileLock2, 
  ChevronRight,
  Info
} from 'lucide-react';
import { EvaluationState, StudentCredentials } from '../types';
import { findStudentIdKey, findBirthdateKey } from '../utils';

interface LoginCardProps {
  evaluationState: EvaluationState;
  onLoginSuccess: (studentData: any) => void;
}

export default function LoginCard({ evaluationState, onLoginSuccess }: LoginCardProps) {
  const [studentId, setStudentId] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!studentId.trim() || !birthdate.trim()) {
      setErrorMsg('학번과 생년월일을 모두 입력해 주세요.');
      return;
    }

    if (evaluationState.rows.length === 0) {
      setErrorMsg('현재 업로드된 수행평가 데이터가 없습니다. 먼저 관리자용 화면으로 접속해 엑셀 파일을 업로드해 주세요!');
      return;
    }

    const { headers, rows } = evaluationState;
    const studentIdKey = findStudentIdKey(headers);
    const birthdateKey = findBirthdateKey(headers);

    if (!studentIdKey || !birthdateKey) {
      setErrorMsg('수행평가 데이터 구성 오류: 학번 또는 생년월일 열 정보를 식별할 수 없습니다. 선생님께 문의 바랍니다.');
      return;
    }

    // Attempt to locate a matching row
    const normalizedInputId = studentId.replace(/\s+/g, '').toLowerCase();
    const normalizedInputBirth = birthdate.replace(/\s+/g, '').toLowerCase();

    const matchedRow = rows.find(row => {
      const rawRowId = row[studentIdKey];
      const rawRowBirth = row[birthdateKey];

      if (rawRowId === undefined || rawRowBirth === undefined) return false;

      const normalizedRowId = String(rawRowId).replace(/\s+/g, '').toLowerCase();
      const normalizedRowBirth = String(rawRowBirth).replace(/\s+/g, '').toLowerCase();

      return normalizedRowId === normalizedInputId && normalizedRowBirth === normalizedInputBirth;
    });

    if (matchedRow) {
      onLoginSuccess(matchedRow);
    } else {
      setErrorMsg('일치하는 수행평가 정보를 찾을 수 없습니다. 학번 또는 생년월일을 정확히 재정렬해 입력해 주세요.');
    }
  };

  const studentIdLabel = findStudentIdKey(evaluationState.headers) || '학번';
  const birthdateLabel = findBirthdateKey(evaluationState.headers) || '생년월일';

  return (
    <div id="student-login-card" className="w-full max-w-lg mx-auto bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden mt-6 transition duration-300 hover:shadow-md">
      {/* Visual Header Banner */}
      <div className="bg-indigo-900 border-b border-indigo-800 text-white p-6 sm:p-8 text-center relative overflow-hidden">
        {/* Subtle decorative mesh background effect */}
        <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
        <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-amber-400/10 rounded-full blur-xl"></div>
        
        <div className="inline-flex p-3 bg-white/10 rounded-full mb-3 text-amber-400 border border-white/10 shadow-inner">
          <GraduationCap size={26} className="stroke-[2.5]" />
        </div>
        
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight font-sans text-white">
          {evaluationState.title || '성적 조회 시스템'}
        </h2>
        
        <p className="text-xs text-indigo-200 font-medium mt-1.5 leading-relaxed max-w-sm mx-auto">
          등록된 학번과 생년월일을 입력하여 귀하의 평가 등급 및 종합 환산 지표를 정교하게 확인하세요.
        </p>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        
        {/* Helper Badge Guide */}
        <div className="bg-slate-50 text-slate-800 border border-slate-200 p-4 rounded-xl flex items-start gap-2.5">
          <Info size={16} className="shrink-0 text-indigo-600 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-slate-900 block font-sans">안내사항 및 조회의 투명성</span>
            <span className="text-slate-650 block leading-relaxed">
              본 웹앱은 개인 성취 정보를 암호화 매칭하여 출력합니다. 선생님이 배포해 주신 성적 시트 내 <strong>{studentIdLabel}</strong>과 <strong>{birthdateLabel}</strong>을 공백 없이 기입해 주시기 바랍니다.
            </span>
          </div>
        </div>

        {/* Real Form Input */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 tracking-tight" htmlFor="student-id">
              {studentIdLabel}
            </label>
            <input 
              id="student-id"
              type="text" 
              placeholder="예: 1학년 1반 1번 이면 10101"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 tracking-tight" htmlFor="birth-date">
              {birthdateLabel}
            </label>
            <input 
              id="birth-date"
              type="password" 
              placeholder="예: YYMMDD 형태의 생년월일 6자리"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold text-slate-800 tracking-widest"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-2 text-xs">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <button 
            type="submit"
            className="w-full py-3.5 bg-indigo-900 hover:bg-indigo-950 border border-indigo-900 text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-1 shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <KeyRound size={15} /> 성적 결과 실시간 조회 <ChevronRight size={15} />
          </button>
        </form>

        {/* Toggle Instruction Drawer */}
        <div className="pt-2 border-t border-slate-100 text-center">
          <button 
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs text-slate-500 hover:text-slate-900 font-semibold inline-flex items-center gap-1 transition"
          >
            <HelpCircle size={14} /> 조회가 잘 안 되나요? 조치법 안내
          </button>

          {showInstructions && (
            <div className="mt-3 bg-slate-50 p-4 border border-slate-200 rounded-xl text-left text-xs text-slate-600 space-y-2 leading-relaxed animate-fadeIn">
              <p className="font-bold text-slate-900">📌 성적 확인 관련 자주 묻는 질문 (FAQ)</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li><strong>학번 입력 규격:</strong> 엑셀 파일 내 등록된 형태와 완전히 일치해야 합니다. (예: <code className="bg-slate-200 px-1 rounded text-red-600">10101</code> 또는 <code className="bg-slate-200 px-1 rounded text-red-600">1학년1반1번</code>)</li>
                <li><strong>생년월일 형식:</strong> 일반적으로 6자리(예: <code className="bg-slate-200 px-1 rounded">060124</code>) 또는 8자리(예: <code className="bg-slate-200 px-1 rounded">20060124</code>) 등이 지정되어 있으니 학교 파일 형식과 일치시켜 주세요.</li>
                <li><strong>선생님이 엑셀을 수정하셨나요?:</strong> 최신 정보 조회를 위해서 브라우저 접속을 종료했다가 새로고침하시기 바랍니다.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
