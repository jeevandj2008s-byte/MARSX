import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MARS X MISSION Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel rounded-[20px] p-6 border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.3)] space-y-4 my-4 max-w-xl mx-auto text-[#FFF4E6]">
          <div className="flex items-center gap-3 text-amber-300">
            <AlertTriangle size={24} />
            <h2 className="text-[18px] font-bold tracking-wide">
              {this.props.fallbackTitle || 'Telemetry Subsystem Render Error'}
            </h2>
          </div>
          <p className="text-[13px] text-[#FFF4E6]/80 leading-relaxed font-sans">
            An anomaly was encountered while rendering this mission view module:
          </p>
          <div className="p-3 bg-black/40 rounded-[10px] border border-white/10 font-mono text-[11.5px] text-amber-200/90 overflow-x-auto">
            {this.state.error?.message || 'Unknown runtime error'}
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-[12px] bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium text-[12.5px] transition-colors"
          >
            <RotateCcw size={14} />
            <span>Retry Subsystem</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
