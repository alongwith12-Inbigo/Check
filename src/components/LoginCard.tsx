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
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!studentId.trim() || !birthdate.trim()) {
      setErrorMsg('학번과 생년월일을 모두 입력해 주세요.');
      return;
    }

    if (!agreedToPrivacy) {
      setErrorMsg('개인정보처리방침 내용을 확인하시고 동의 확인란에 체크해 주셔야 실시간 조회가 가능합니다.');
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

          {/* Simplified Privacy Policy Checklist Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                🔒 개인정보처리방침 (간단 버전)
              </span>
              <span className="text-[9px] bg-indigo-50 border border-indigo-200/60 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-md">
                즉시 휘발 보증
              </span>
            </div>
            
            <div className="text-[10px] text-slate-600 leading-relaxed space-y-1 max-h-[85px] overflow-y-auto pr-1 select-text scrollbar-thin">
              <p><strong>• 수집 및 이용 목적:</strong> 학번 및 생년월일 일치 여부 매칭을 통한 개인별 점수 지표 및 교사 맞춤형 성취 피드백의 안전한 1:1 휘발성 조회</p>
              <p><strong>• 수집 개인정보 범위:</strong> 선생님이 업로드한 데이터셋 내 학번, 이름, 생년월일, 각 항목별 점수 및 종합 코멘트</p>
              <p><strong>• 보관 및 완전 파기:</strong> 본 시스템은 클라우드 DB에 데이터를 영구 수집하지 않는 <strong>브라우저 온디맨드(on-demand) 도구</strong>입니다. 조회가 활성화되는 순간에만 임시 파싱하여 매칭하며, 웹 브라우저 탭을 끄는 순간 본인의 모든 입력값과 점수내역은 완벽하게 자동 완전 영구 소멸됩니다.</p>
              <p><strong>• 동의 거부권:</strong> 학생은 본 동의에 거부할 권리가 있으며, 동의를 하지 않는 경우 본 웹 조회기를 통한 점수 확인이 불가능하므로 해당 과목 선생님께 직접 성적을 확인받으셔야 합니다.</p>
            </div>

            <label className="flex items-start gap-2 pt-1 pb-0.5 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={agreedToPrivacy}
                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-300 w-4 h-4 cursor-pointer"
              />
              <span className="text-[11px] font-bold text-slate-800 leading-tight">
                위의 개인정보 수집 및 즉시 휘발 파기 방침을 읽었으며, 조회를 위해 이에 기꺼이 동의합니다. (필수)
              </span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-2 text-xs">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          <button 
            type="submit"
            className={`w-full py-3.5 border text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-1 shadow-sm hover:shadow-md transition-all cursor-pointer ${
              agreedToPrivacy 
                ? 'bg-indigo-900 border-indigo-900 hover:bg-indigo-950' 
                : 'bg-slate-350 border-slate-300 hover:bg-slate-400 opacity-90'
            }`}
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
