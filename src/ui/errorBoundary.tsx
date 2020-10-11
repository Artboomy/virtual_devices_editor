import { ErrorInfo } from 'react';
import * as React from 'react';
import '../styles/errrorBoundary.css';

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
            return (
                <div>
                    <div>
                        <h3>
                            An error occurred. Please send screenshot to&nbsp;
                            <a
                                href={chrome.runtime.getManifest().homepage_url}
                                rel={'noreferrer'}
                                target={'_blank'}>
                                github
                            </a>
                        </h3>
                    </div>
                    <hr />
                    <div className={'message'}>{this.state.error?.message}</div>
                    <hr />
                    <div className={'stack'}>{this.state.error?.stack}</div>
                </div>
            );
        }
        return this.props.children;
    }
}
