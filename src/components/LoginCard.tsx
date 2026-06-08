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
import { EvaluationState, Teacher } from '../types';
import { findStudentIdKey, findBirthdateKey } from '../utils';

interface LoginCardProps {
  evaluationState: EvaluationState;
  teacherEvaluations: EvaluationState[];
  selectedEvaluationId: string;
  onSelectEvaluationId: (id: string) => void;
  onLoginSuccess: (studentData: any) => void;
  teachers: Teacher[];
  selectedTeacherCode: string;
  onSelectTeacher: (code: string) => void;
}

export default function LoginCard({ 
  evaluationState, 
  teacherEvaluations,
  selectedEvaluationId,
  onSelectEvaluationId,
  onLoginSuccess,
  teachers,
  selectedTeacherCode,
  onSelectTeacher
}: LoginCardProps) {
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
      setErrorMsg('개인정보 수집·이용에 동의하셔야 서비스 조회가 가능합니다.');
      return;
    }

    if (evaluationState.rows.length === 0) {
      setErrorMsg('현재 선택된 수행평가에 데이터가 존재하지 않습니다.');
      return;
    }

    const { headers, rows } = evaluationState;
    const studentIdKey = findStudentIdKey(headers);
    const birthdateKey = findBirthdateKey(headers);

    if (!studentIdKey || !birthdateKey) {
      setErrorMsg('수행평가 데이터 구성 오류: 학번 또는 생년월일 열 정보를 식별할 수 없습니다. 선생님께 문의 바랍니다.');
      return;
    }

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
      setErrorMsg('일치하는 수행평가 정보를 찾을 수 없습니다. 학번 또는 생년월일을 정확히 확인 후 다시 입력해 주세요.');
    }
  };

  const studentIdLabel = findStudentIdKey(evaluationState.headers) || '학번';
  const birthdateLabel = findBirthdateKey(evaluationState.headers) || '생년월일';

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
          {evaluationState.title || '성적 조회 시스템'}
        </h2>
        
        <p className="text-xs text-indigo-200 font-medium mt-1.5 leading-relaxed max-w-sm mx-auto">
          등록된 학번과 생년월일을 입력하여 본인의 개별 수행평가 등급 및 성취도 피드백을 실시간으로 안전하게 조회하세요.
        </p>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        
        {/* Real Form Input */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          
          {/* Dropdown 1: Select Teacher */}
          <div>
            <label className="block text-xs font-bold text-indigo-950 mb-1.5 tracking-tight">
              👨‍🏫 담당 선생님 선택
            </label>
            <select
              value={selectedTeacherCode}
              onChange={(e) => onSelectTeacher(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-bold text-slate-800 cursor-pointer"
            >
              <option value="">선생님 선택</option>
              {teachers.map((tea) => (
                <option key={tea.code} value={tea.code}>
                  [{tea.code}] {tea.name} 선생님
                </option>
              ))}
            </select>
          </div>

          {/* Conditional Display based on file count */}
          {selectedTeacherCode && teacherEvaluations.length === 0 ? (
            /* Warning Banner when selected teacher has 0 files uploaded */
            <div className="bg-rose-50 border-2 border-rose-100 p-6 rounded-2xl text-center space-y-3 animate-fadeIn my-4">
              <span className="inline-flex p-2.5 bg-rose-150 rounded-full text-rose-600 border border-rose-200">
                <AlertCircle size={20} className="stroke-[2.5]" />
              </span>
              <p className="text-xs sm:text-sm font-black text-rose-950 leading-relaxed max-w-xs mx-auto">
                수행평가 점수 조회 기간이 아닙니다.<br/>교과 선생님께 직접 문의하세요.
              </p>
            </div>
          ) : (
            <>
              {/* Dropdown 2: Select Evaluation */}
              {selectedTeacherCode && teacherEvaluations.length > 0 && (
                <div className="animate-fadeIn">
                  <label className="block text-xs font-bold text-indigo-950 mb-1.5 tracking-tight">
                    📋 수행평가 선택
                  </label>
                  <select
                    value={selectedEvaluationId}
                    onChange={(e) => onSelectEvaluationId(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-bold text-slate-800 cursor-pointer"
                  >
                    {teacherEvaluations.map((evalItem) => (
                      <option key={evalItem.id} value={evalItem.id}>
                        {evalItem.title} {evalItem.maxScore ? `(${evalItem.maxScore}점 만점)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedTeacherCode && selectedEvaluationId && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Student ID Inputs */}
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

                  {/* Birthdate Inputs (8 digits requested) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 tracking-tight" htmlFor="birth-date">
                      {birthdateLabel}
                    </label>
                    <input 
                      id="birth-date"
                      type="password" 
                      placeholder="예: YYYYMMDD 형태의 생년월일 8자리"
                      value={birthdate}
                      onChange={(e) => setBirthdate(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold text-slate-800 tracking-widest"
                    />
                  </div>

                  {/* Student Consent (Exact text requested) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                    <div className="border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        🔒 개인정보 처리 설명 및 동의
                      </span>
                    </div>
                    
                    <div className="text-[11px] text-slate-600 leading-relaxed space-y-2 select-text">
                      <p className="font-extrabold text-slate-800 text-[11px]">개인정보 수집·이용 동의</p>
                      <p><strong>1. 수집·이용 목적:</strong> 수행평가 결과 조회 서비스 제공</p>
                      <p><strong>2. 수집 항목:</strong> 학번, 이름, 수행평가 점수, 교사 피드백(해당 시)</p>
                      <p><strong>3. 보유 및 이용 기간:</strong> 수행평가 결과 조회 기간 동안 보관 후 즉시 삭제</p>
                      <p><strong>4. 동의 거부 권리 및 불이익:</strong> 개인정보 수집·이용에 대한 동의를 거부할 수 있으며, 이 경우 수행평가 결과 조회 서비스를 이용할 수 없습니다.</p>
                      <p className="font-semibold text-slate-700 pt-1">본인은 위 내용을 확인하였으며 개인정보 수집·이용에 동의합니다.</p>
                    </div>

                    <label className="flex items-start gap-2 pt-2 pb-0.5 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={agreedToPrivacy}
                        onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-300 w-4.5 h-4.5 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold text-slate-800 leading-tight">
                        개인정보 수집 및 이용에 동의합니다. (필수 체크)
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
                    동의 및 로그인
                  </button>
                </div>
              )}
            </>
          )}

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
                <li><strong>학번 입력 규격:</strong> 엑셀 파일 내 등록된 형태와 완전히 일치해야 합니다. (예: <code className="bg-slate-200 px-1 rounded text-red-600">10101</code>)</li>
                <li><strong>생년월일 형식:</strong> 일반적으로 <strong className="text-slate-900 text-[11px]">8자리</strong>(예: <code className="bg-slate-200 px-1 rounded">20060124</code>) 등이 지정되어 있으니 학교 파일 형식과 일치시켜 주세요.</li>
                <li><strong>선생님이 엑셀을 수정하셨나요?:</strong> 최신 정보 조회를 위해서 브라우저 접속을 종료했다가 새로고침하시기 바랍니다.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
