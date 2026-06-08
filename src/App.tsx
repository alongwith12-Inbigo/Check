/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Navbar from './components/Navbar';
import LoginCard from './components/LoginCard';
import ResultCard from './components/ResultCard';
import AdminDashboard from './components/AdminDashboard';
import { EvaluationState } from './types';
import { 
  Smile, 
  HelpCircle, 
  Settings, 
  GraduationCap, 
  Eye, 
  ArrowLeft,
  ChevronRight,
  Info,
  InfoIcon
} from 'lucide-react';

// Premium high-craft pre-populated sample evaluation data 
const DEFAULT_PRESET: EvaluationState = {
  subject: '정보 과학',
  round: '1',
  evaluationDetailName: '알고리즘 및 순서도 설계 평가',
  title: '정보 과학 (1차) 수행평가: 알고리즘 및 순서도 설계 평가',
  headers: ['학번', '이름', '생년월일', '동료평가(10)', '실기보고서(40)', '코드수행(50)', '합계(100)', '개별 성취피드백'],
  rows: [
    {
      '학번': '10101',
      '이름': '김하늘',
      '생년월일': '060512',
      '동료평가(10)': '10',
      '실기보고서(40)': '38',
      '코드수행(50)': '48',
      '합계(100)': '96',
      '개별 성취피드백': 'Python 정렬 알고리즘의 시간 복잡도를 올바르게 이해하고 이를 분할 정복 방식으로 우수하게 모듈화 설계한 점이 매우 탁월합니다. 팀원 기여도 또한 만점입니다.'
    },
    {
      '학번': '10102',
      '이름': '박민수',
      '생년월일': '061125',
      '동료평가(10)': '9',
      '실기보고서(40)': '35',
      '코드수행(50)': '42',
      '합계(100)': '86',
      '개별 성취피드백': '알고리즘 순서도 모델링 영역에서 우수한 논리 선형성을 보여줍니다. 다만 코드 구현 단계에서 변수 스코프를 전역 공간으로 전치시켜 선언한 부분이 아쉬우니 지역 변수로 축소 수정해 보길 권장합니다.'
    },
    {
      '학번': '10103',
      '이름': '이솔이',
      '생년월일': '060707',
      '동료평가(10)': '10',
      '실기보고서(40)': '40',
      '코드수행(50)': '50',
      '합계(100)': '100',
      '개별 성취피드백': '실습과 이론 모두 무결점에 수렴하는 뛰어난 마스터리를 발휘해 최고점을 기록하였습니다. 프로그램 종료 시점에 리소스 반환 처리를 추가한 디테일 또한 선생님으로서 깊은 인상을 받았습니다.'
    },
    {
      '학번': '10204',
      '이름': '최도현',
      '생년월일': '060303',
      '동료평가(10)': '8',
      '실기보고서(40)': '28',
      '코드수행(50)': '35',
      '합계(100)': '71',
      '개별 성취피드백': '인터페이스 흐름의 조형미가 아주 준수한 앱 데모를 구현하였습니다. 아쉽게도 제출 서한의 개요 기획문 중 기능 의성 상세 정의서 부분이 채워지지 않았으니 다음 평가 시 분량을 신경 써 주시기 바랍니다.'
    }
  ],
  uploadedAt: '2026-06-08 (샘플 탑재)'
};

export default function App() {
  const [evaluationState, setEvaluationState] = useState<EvaluationState>(() => {
    try {
      const savedTitle = localStorage.getItem('eval_title_v1');
      const savedSubject = localStorage.getItem('eval_subject_v1');
      const savedRound = localStorage.getItem('eval_round_v1');
      const savedDetailName = localStorage.getItem('eval_detail_name_v1');
      const savedHeaders = localStorage.getItem('eval_headers_v1');
      const savedRows = localStorage.getItem('eval_rows_v1');
      const savedUploadedAt = localStorage.getItem('eval_uploaded_at_v1');

      if (savedTitle && savedHeaders && savedRows) {
        return {
          title: savedTitle,
          subject: savedSubject || '',
          round: savedRound || '',
          evaluationDetailName: savedDetailName || '',
          headers: JSON.parse(savedHeaders),
          rows: JSON.parse(savedRows),
          uploadedAt: savedUploadedAt
        };
      }
    } catch (e) {
      console.error('Failed to load initial storage state:', e);
    }
    // Return sample preset so users immediately see a functioning application
    return DEFAULT_PRESET;
  });

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [loggedStudent, setLoggedStudent] = useState<Record<string, any> | null>(null);

  // Sync state changes with localStorage
  const handleUpdateEvaluationState = (newState: EvaluationState) => {
    setEvaluationState(newState);
    try {
      localStorage.setItem('eval_title_v1', newState.title);
      localStorage.setItem('eval_subject_v1', newState.subject || '');
      localStorage.setItem('eval_round_v1', newState.round || '');
      localStorage.setItem('eval_detail_name_v1', newState.evaluationDetailName || '');
      localStorage.setItem('eval_headers_v1', JSON.stringify(newState.headers));
      localStorage.setItem('eval_rows_v1', JSON.stringify(newState.rows));
      if (newState.uploadedAt) {
        localStorage.setItem('eval_uploaded_at_v1', newState.uploadedAt);
      } else {
        localStorage.removeItem('eval_uploaded_at_v1');
      }
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  };

  const handleToggleAdmin = () => {
    setIsAdminOpen(!isAdminOpen);
    // Logout student if entering admin mode to keep security boundaries clean
    setLoggedStudent(null);
  };

  const handleStudentLogin = (studentData: Record<string, any>) => {
    setLoggedStudent(studentData);
  };

  const handleStudentLogout = () => {
    setLoggedStudent(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none print:bg-white text-slate-800">
      
      {/* Universal Sticky Header Navigation */}
      <Navbar 
        isAdminOpen={isAdminOpen} 
        onToggleAdmin={handleToggleAdmin} 
        evaluationTitle={evaluationState.title} 
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {isAdminOpen ? (
            // Mode 1: Teacher/Admin Settings view
            <motion.div
              key="admin-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <AdminDashboard 
                evaluationState={evaluationState}
                onUpdateState={handleUpdateEvaluationState}
                onClose={() => setIsAdminOpen(false)}
              />
            </motion.div>
          ) : loggedStudent ? (
            // Mode 2: Student Individual Result view
            <motion.div
              key="result-screen"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <ResultCard 
                evaluationState={evaluationState}
                studentData={loggedStudent}
                onBack={handleStudentLogout}
              />
            </motion.div>
          ) : (
            // Mode 3: Student Credentials Input / Login view
            <motion.div
              key="login-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              {/* Educational Platform Welcome Sub-Banner */}
              <div className="text-center space-y-2 max-w-lg mx-auto mt-4">
                <span className="text-[10px] sm:text-xs font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                  🏫 범용 수행평가 성적조회 서비스
                </span>
                <p className="text-xs text-slate-500 font-semibold px-4 leading-relaxed">
                  본 서비스는 교육 정보 보호 지침에 맞추어 학생별 개별 점수와 맞춤 종합 코멘트를 타인 노출 없이 비공개 매칭 조회합니다.
                </p>
              </div>

              <LoginCard 
                evaluationState={evaluationState} 
                onLoginSuccess={handleStudentLogin}
              />
              
              {/* Default Mock Login Tutorial box for first timers */}
              {evaluationState.rows.length > 0 && evaluationState.uploadedAt?.includes('샘플') && (
                <div className="max-w-md mx-auto bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 text-xs space-y-2 text-indigo-900/80 shadow-xs">
                  <span className="font-bold block text-indigo-950 flex items-center gap-1">
                     💻 즉시 체험용 샘플 계정 안내 (선생님 테스트용)
                  </span>
                  <p className="leading-relaxed text-[11px]">
                    아직 교사 엑셀 파일을 업로드하지 않으셨다면, 아래의 샘플 계정으로 로그인 동작을 미리 체험해 보실 수 있습니다:
                  </p>
                  <div className="grid grid-cols-2 gap-2 bg-white/70 p-2.5 rounded-lg border border-indigo-100/50 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block">김하늘 학생</span>
                      <span className="block text-indigo-950">학번: <strong className="font-bold text-indigo-600">10101</strong></span>
                      <span className="block text-indigo-950">생일: <strong className="font-bold text-indigo-600">060512</strong></span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">이솔이 학생</span>
                      <span className="block text-indigo-950">학번: <strong className="font-bold text-indigo-600">10103</strong></span>
                      <span className="block text-indigo-950">생일: <strong className="font-bold text-indigo-600">060707</strong></span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    ※ 화면 우상단의 [관리자 모드 (교사)] 에서 패스워드 <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700">1004</code>를 입력하시면 실제 엑셀 업로드 및 전체 조율을 하실 수 있습니다.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Trustfooter */}
      <footer className="py-6 border-t border-slate-200/60 text-center text-xs text-slate-400 print:hidden mt-12 bg-white flex flex-col items-center justify-center gap-1">
        <span className="font-semibold text-slate-500 flex items-center gap-1 text-[11px]">
           범용 수행평가 성적 간편 조회 엔진 v1.2
        </span>
        <span className="text-[10px]">Copyright © 2026 Educational Web Tools Developer. All Rights Reserved.</span>
      </footer>
    </div>
  );
}
