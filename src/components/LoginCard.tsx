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
import { EvaluationState, StudentSession, RegisteredStudent } from '../types';
import { findStudentIdKey, findBirthdateKey, matchesStudentId, matchesBirthdate } from '../utils';

interface LoginCardProps {
  onLoginSuccess: (session: StudentSession) => void;
  allStudents: RegisteredStudent[];
  allEvaluations: EvaluationState[];
}

export default function LoginCard({ 
  onLoginSuccess,
  allStudents,
  allEvaluations
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
      setErrorMsg('학번(5자리)과 생년월일(8자리)을 입력해 주세요.');
      return;
    }

    if (!agreedToPrivacy) {
      setErrorMsg('개인정보 수집·이용에 동의하셔야 서비스 조회가 가능합니다.');
      return;
    }

    // Find matching registered student from the Admin's master student registry
    const matchedRegisteredStudent = allStudents.find(student => 
      matchesStudentId(studentId, student.studentId) && matchesBirthdate(birthdate, student.birthdate)
    );

    // If master registry exists, strictly enforce verification against it
    if (allStudents.length > 0) {
      if (!matchedRegisteredStudent) {
        setErrorMsg(
          '입력하신 학번과 생년월일이 일치하는 학생 정보를 찾을 수 없습니다.\n' +
          '학교 관리자가 등록한 교적 정보와 다르면 담임선생님 혹은 학교 관리자에게 연락 바랍니다.'
        );
        return;
      }
    } else {
      // If master registry is empty, fall back to checking raw rows in allEvaluations 
      // (Any spreadsheet match that has Student ID and Birthdate matching)
      let foundInEvaluations = false;
      let detectedStudentName = '';

      for (const evalItem of allEvaluations) {
        const studentIdKey = findStudentIdKey(evalItem.headers);
        const birthdateKey = findBirthdateKey(evalItem.headers);
        if (!studentIdKey || !birthdateKey) continue;

        const foundRow = evalItem.rows.find(row => 
          matchesStudentId(studentId, row[studentIdKey]) && matchesBirthdate(birthdate, row[birthdateKey])
        );

        if (foundRow) {
          foundInEvaluations = true;
          detectedStudentName = String(foundRow['이름'] || foundRow['성명'] || foundRow['학생명'] || foundRow['학생이름'] || '').trim();
          break;
        }
      }

      if (!foundInEvaluations) {
        setErrorMsg(
          '입력하신 학번 또는 생년월일과 일치하는 성적 기록을 찾을 수 없습니다.\n' +
          '교적 명부가 비어 있는 상태이므로, 선생님이 엑셀에 입력한 정보와 맞는지 확인하십시오.'
        );
        return;
      }
    }

    const finalName = matchedRegisteredStudent 
      ? matchedRegisteredStudent.name 
      : `학생 (${studentId})`;
    
    onLoginSuccess({
      studentId: studentId.trim(),
      birthdate: birthdate.trim(),
      studentName: finalName,
      teacherName: '',
      results: [],
      teacherCode: ''
    });
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
          학번과 생년월일을 입력하여 수행평가 점수와 개별 피드백을 확인할 수 있습니다.
        </p>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        
        {/* Real Form Input */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          
          <div className="space-y-4">
            
            {/* Student ID Inputs */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 tracking-tight" htmlFor="student-id">
                학번(5자리) 입력
              </label>
              <input 
                id="student-id"
                type="text" 
                placeholder="예: 10101"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold text-slate-800"
              />
            </div>

            {/* Birthdate Inputs (8 digits requested) */}
            <div>
              <label className="block text-xs font-bold text-slate-705 mb-1.5 tracking-tight" htmlFor="birth-date">
                생년월일(8자리) 입력
              </label>
              <input 
                id="birth-date"
                type="password" 
                placeholder="예: 20081231"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-semibold text-slate-800 tracking-widest"
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
              <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-start gap-2 text-xs font-semibold">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span className="font-semibold whitespace-pre-line leading-relaxed">{errorMsg}</span>
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
                <li><strong>학번 입력 형식:</strong> 엑셀 파일 내 등록된 형태와 완전히 동일해야 합니다. (예: 다섯 자릿수 학번인 <code className="bg-slate-200 px-1 rounded text-red-600">10101</code> 등)</li>
                <li><strong>생년월일 형식:</strong> 일반적으로 <strong className="text-slate-900 text-[11.5px]">8자리</strong>(예: <code className="bg-slate-200 px-1 rounded">20081231</code>) 형태나 엑셀 셀 시트에 담긴 생일 형식으로 입력해주십시오.</li>
                <li><strong>다중 성적 조회 보장:</strong> 로그인에 성공하시면, 담임선생님 혹은 교과선생님들께서 등록해 주신 학년반에 따라 교사 드롭다운 메뉴가 생성되어 과목별로 손쉽고 편리하게 일괄 조회가 가능합니다.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
