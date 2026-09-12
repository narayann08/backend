import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Catches render-time crashes so one broken widget cannot blank the whole
 * control room. React Query failures are handled by ErrorState instead — this
 * is the backstop for genuine exceptions (bad data shape, chart library throw).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[FluxCast] Render error:', error, info?.componentStack);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-2 rounded-[3px] border border-severity-high/35 bg-severity-high-soft p-4"
      >
        <p className="fc-label flex items-center gap-2 text-severity-high">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          {this.props.title || 'This panel stopped working'}
        </p>
        <p className="text-sm text-ink">{this.state.error.message}</p>
        <button
          type="button"
          onClick={this.handleReset}
          className="fc-label mt-1 rounded-[2px] border border-severity-high/40 bg-surface-raised px-2.5 py-1.5 text-severity-high transition-colors hover:bg-severity-high/10"
        >
          Reload panel
        </button>
      </div>
    );
  }
}
