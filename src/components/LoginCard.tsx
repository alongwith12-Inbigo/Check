import React, { useState } from 'react';
import { 
  KeyRound, 
  HelpCircle, 
  AlertCircle, 
  GraduationCap, 
  ChevronRight,
  Info,
  CalendarCheck
} from 'lucide-react';
import { StudentSession, ExcelUpload } from '../types';

interface LoginCardProps {
  onLoginSuccess: (session: StudentSession) => void;
  onValidateStudent: (studentId: string, birthdateOrPassword: string) => Promise<{ success: boolean; error?: string; session?: StudentSession }>;
  excelUploads: ExcelUpload[];
}

export default function LoginCard({ 
  onLoginSuccess,
  onValidateStudent,
  excelUploads
}: LoginCardProps) {
  const [studentId, setStudentId] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!studentId.trim() || !birthdate.trim()) {
      setErrorMsg('학번(5자리)과 생년월일(8자리)을 입력해 주세요.');
      return;
    }

    if (!agreedToPrivacy) {
      setErrorMsg('개인정보 수집·이용에 동의하셔야 서비스 조회가 가능합니다.');
      return;
    }

    setIsValidating(true);
    try {
      const res = await onValidateStudent(studentId, birthdate);
      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        setErrorMsg(res.error || '로그인에 실패했습니다.');
      }
    } catch (err) {
      setErrorMsg('로그인 중 서버와의 연결에 실패했습니다.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div id="student-login-card" className="w-full max-w-lg mx-auto bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden mt-6 transition duration-300 hover:shadow-md">
      {/* Visual Header Banner */}
      <div className="bg-indigo-900 border-b border-indigo-800 text-white p-6 sm:p-8 text-center relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
        <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-amber-400/10 rounded-full blur-xl"></div>
        
        <div className="inline-flex p-3 bg-white/10 rounded-full mb-3 text-amber-400 border border-white/10 shadow-inner">
          <GraduationCap size={26} className="stroke-[2.5]" />
        </div>
        
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight font-sans text-white">
          수행평가 점수 조회
        </h2>
        
        <p className="text-xs text-indigo-200 font-medium mt-1.5 leading-relaxed max-w-sm mx-auto">
          학번과 생년월일을 입력하여 수행평가 점수와 피드백을 확인할 수 있습니다.
        </p>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        
        {/* Real Form Input */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          
          <div className="space-y-4">
            
            {/* Student ID Inputs */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 tracking-tight" htmlFor="student-id">
                학번 입력
              </label>
              <input 
                id="student-id"
                type="text" 
                placeholder="예: 10305"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={isValidating}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold text-slate-800 disabled:opacity-50"
              />
            </div>

            {/* Birthdate / Password Inputs */}
            <div>
              <label className="block text-xs font-bold text-slate-705 mb-1.5 tracking-tight" htmlFor="birth-date">
                생년월일(8자리) 또는 설정한 비밀번호 입력
              </label>
              <input 
                id="birth-date"
                type="password" 
                placeholder="예: 20081231 또는 설정한 비밀번호"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                disabled={isValidating}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold text-slate-800 tracking-widest disabled:opacity-50"
              />
            </div>

            {/* Student Consent (Exact text requested) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs font-sans">
              <div className="border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                  🔒 개인정보 활용 동의 안내
                </span>
              </div>
              
              <div className="text-[11px] text-slate-600 leading-relaxed space-y-2 select-text font-medium border-slate-200">
                <p className="font-extrabold text-slate-800 text-[11px]">개인정보 수집·이용 동의</p>
                <p><strong>1. 수집·이용 목적:</strong> 수행평가 결과 조회 서비스 제공</p>
                <p><strong>2. 수집 항목:</strong> 학번, 이름, 수행평가 점수, 서명, 교사 피드백(해당 시)</p>
                <p><strong>3. 보유 및 이용 기간:</strong> 학기말, 수행평가 결과 조회 기간 동안 보관 후 즉시 삭제</p>
                <p><strong>4. 동의 거부 권리 및 불이익:</strong> 개인정보 수집·이용에 대한 동의를 거부할 수 있으며, 이 경우 수행평가 결과 조회 서비스를 이용할 수 없습니다.</p>
                <p className="font-semibold text-slate-700 pt-1">본인은 위 내용을 확인하였으며 개인정보 수집·이용에 동의합니다.</p>
              </div>

              <label className="flex items-start gap-2 pt-2 pb-0.5 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={agreedToPrivacy}
                  onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                  disabled={isValidating}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-300 w-4.5 h-4.5 cursor-pointer disabled:opacity-50"
                />
                <span className="text-[11px] font-bold text-slate-800 leading-tight">
                  개인정보 수집 및 이용에 동의합니다. (필수 체크)
                </span>
              </label>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-semibold">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span className="font-semibold whitespace-pre-line leading-relaxed">{errorMsg}</span>
              </div>
            )}

            <button 
              type="submit"
              disabled={isValidating}
              className={`w-full py-3.5 border text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-1 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                isValidating
                  ? 'bg-indigo-350 border-indigo-300 cursor-not-allowed opacity-80'
                  : agreedToPrivacy 
                    ? 'bg-indigo-900 border-indigo-900 hover:bg-indigo-950' 
                    : 'bg-slate-350 border-slate-300 hover:bg-slate-400 opacity-90'
              }`}
            >
              {isValidating ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>조회 및 확인 중...</span>
                </div>
              ) : (
                '동의 및 로그인'
              )}
            </button>
          </div>

        </form>

        {/* Toggle Instruction Drawer */}
        <div className="pt-2 border-t border-slate-100 text-center">
          <button 
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs text-slate-500 hover:text-slate-900 font-semibold inline-flex items-center gap-1 transition-colors"
          >
            <HelpCircle size={14} /> 조회가 잘 안 되나요? 자가 해결 조치법 안내
          </button>

          {showInstructions && (
            <div className="mt-3 bg-slate-50 p-4 border border-slate-200 rounded-xl text-left text-xs text-slate-600 space-y-2 leading-relaxed animate-fadeIn">
              <p className="font-bold text-slate-900">📌 성적 확인 관련 자주 묻는 질문 (FAQ)</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li><strong>학번 입력 형식:</strong> 숫자5자리 (예: 다섯 자릿수 학번인 <code className="bg-slate-200 px-1 rounded text-red-600">10101</code> 등)</li>
                <li><strong>생년월일 형식:</strong> 초기 비빌번호는 <strong className="text-slate-900 text-[11.5px]">생년월일 8자리</strong>(예: <code className="bg-slate-200 px-1 rounded">20081231</code>) 또는 본인이 변경한 비밀번호</li>
                <li><strong>수행평가 성적 조회:</strong> 로그인을 하면 이 시스템을 활용한 모든 교과 선생님 과목의 수행평가 점수를 조회할 수 있습니다.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
