import * as React from 'react';
import '../styles/iconButton.css';

type IconButtonParams = {
    className?: string;
    icon: string;
    type?: 'green' | 'red';
    title?: string;
    onClick?: () => void;
};

export default function IconButton(props: IconButtonParams): JSX.Element {
    return (
        <svg
            className={`featherIcon featherIcon-${props.type || 'blue'} ${
                props.className || ''
            }`}
            onClick={props.onClick}>
            <use xlinkHref={`icons/feather-sprite.svg#${props.icon}`} />
            {props.title && <title>{props.title}</title>}
        </svg>
    );
}
