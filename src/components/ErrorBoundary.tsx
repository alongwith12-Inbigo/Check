import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    // Force reload bypassing cache to clear any corrupt state/cache
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch (e) {
      console.warn("Storage clear blocked", e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white border border-slate-200 shadow-xl rounded-2xl max-w-md w-full p-8 space-y-6">
            <div className="text-rose-600 flex flex-col items-center gap-2">
              <span className="text-4xl">⚠️</span>
              <h1 className="text-lg font-black text-slate-950 tracking-tight mt-2">시스템 연결 오류 또는 브라우저 로딩 실패</h1>
            </div>
            
            <p className="text-xs text-slate-650 font-medium leading-relaxed">
              성적 데이터를 가져오는 도중 또는 특정 브라우저 보안 요소(확장 프로그램, 광고사단 피터링 등)로 인해 프로그램이 예기치 않게 종료되었습니다.
            </p>

            <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl text-left font-mono text-[10px] text-slate-500 overflow-x-auto max-h-[120px] whitespace-pre-wrap leading-normal">
              {this.state.error?.toString() || "Unknown rendering exception"}
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-3 bg-indigo-900 hover:bg-indigo-950 border border-indigo-800 text-white font-extrabold rounded-xl text-xs transition duration-150 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                🔄 웹사이트 캐시 초기화 후 새로고침
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 bg-white border border-slate-250 hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl text-xs transition duration-150 cursor-pointer"
              >
                단순 새로고침
              </button>
            </div>

            <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg text-[10px] text-amber-970 text-left leading-normal space-y-1">
              <span className="font-extrabold block">💡 자꾸 하얀색 화면만 나올 때 해결 가이드:</span>
              <p>• 크롬/엣지 브라우저에서 <strong>광고 차단 프로그램 (AdBlock 등)</strong>이나 보안 확장 프로그램을 꺼 주십시오.</p>
              <p>• 학교망 방화벽 문제일 수 있으니 다른 기기나 개인 핫스팟으로 연결해 확인해 보세요.</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
