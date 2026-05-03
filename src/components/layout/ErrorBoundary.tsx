import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-page-bg)' }}>
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>出错了</h1>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              {this.state.error.message || '页面发生意外错误'}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer border-none"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              返回首页
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
