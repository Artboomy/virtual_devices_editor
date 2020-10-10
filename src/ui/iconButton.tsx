import * as React from 'react';
import '../styles/iconButton.css';

type IconButtonParams = {
    className?: string;
    icon: string;
    title?: string;
    onClick?: () => void;
};

export default function IconButton(props: IconButtonParams): JSX.Element {
    return (
        <svg
            className={`featherIcon ${props.className || ''}`}
            onClick={props.onClick}>
            <use xlinkHref={`icons/feather-sprite.svg#${props.icon}`} />
            {props.title && <title>{props.title}</title>}
        </svg>
    );
}
