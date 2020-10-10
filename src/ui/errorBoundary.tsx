import { ErrorInfo } from 'react';
import * as React from 'react';

interface IState {
    error: Error | null;
    hasError: boolean;
}

interface IProps {
    children: JSX.Element;
}

export default class ErrorBoundary extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): IState {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // You can also log the error to an error reporting service
        console.info(error, errorInfo);
    }

    render(): JSX.Element {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return <h1>{this.state.error?.message}</h1>;
        }
        return this.props.children;
    }
}
