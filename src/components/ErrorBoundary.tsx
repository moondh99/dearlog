import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;

  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    console.error('Dearlog page boundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="mx-auto flex min-h-[100dvh] max-w-[390px] flex-col items-center justify-center bg-[#F8F6F9] px-6 py-10 text-center text-[#2A2830]"
      >
        <AlertTriangle className="mb-4 h-10 w-10 text-[#9485BE]" aria-hidden="true" />
        <h2 className="font-serif text-[22px] font-normal leading-[1.4] text-[#2A2830]">
          {this.props.fallbackTitle ?? '화면을 불러오지 못했습니다'}
        </h2>
        <p className="mt-3 text-[13px] leading-[1.7] text-[#7A767F]">
          일시적인 문제가 발생했습니다. 다시 시도해도 문제가 계속되면 이전 화면으로 이동해 주세요.
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="mt-7 inline-flex min-h-[51px] items-center justify-center gap-2 rounded-[14px] bg-[#2A2830] px-6 text-[14px] font-medium tracking-[0.04em] text-[#F7F5FB] transition active:scale-[0.99]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          다시 시도
        </button>
      </div>
    );
  }
}
