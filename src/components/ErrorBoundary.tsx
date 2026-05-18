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
  declare setState: (state: Partial<ErrorBoundaryState>) => void;

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
        className="mx-auto flex min-h-[360px] max-w-xl flex-col items-center justify-center rounded-[28px] border border-red-200 bg-red-50 px-6 py-10 text-center"
      >
        <AlertTriangle className="mb-4 h-10 w-10 text-error" aria-hidden="true" />
        <h2 className="text-[22px] font-black text-error">
          {this.props.fallbackTitle ?? '화면을 불러오지 못했습니다'}
        </h2>
        <p className="mt-2 text-[15px] font-semibold leading-relaxed text-red-800/80">
          일시적인 문제가 발생했습니다. 다시 시도해도 문제가 계속되면 이전 화면으로 이동해 주세요.
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-error px-5 py-3 text-[15px] font-bold text-white transition-colors hover:bg-error/90"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          다시 시도
        </button>
      </div>
    );
  }
}
