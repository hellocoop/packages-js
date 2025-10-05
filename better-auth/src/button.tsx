import React from 'react'

export interface HelloButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'black-and-invert' | 'black-and-white' | 'white-and-black'
    hover?: 'glow' | 'flare' | 'pop' | 'none'
    children?: React.ReactNode
}

/**
 * Hellō branded button component
 *
 * Renders a properly styled Hellō button with the ō character and official branding.
 *
 * @param variant - Button color variant (default: 'black-and-invert')
 * @param hover - Hover effect (default: 'glow')
 * @param children - Custom button text (default: 'Continue with Hellō')
 *
 * @example
 * ```tsx
 * <HelloButton onClick={handleSignIn} />
 * ```
 */
export const HelloButton: React.FC<HelloButtonProps> = ({
    variant = 'black-and-invert',
    hover = 'glow',
    children = 'Continue with Hellō',
    className = '',
    ...props
}) => {
    const classes = [
        'hello-btn',
        `hello-btn-${variant}`,
        hover !== 'none' && `hello-btn-hover-${hover}`,
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <button className={classes} {...props}>
            ō&nbsp;&nbsp;{children}
        </button>
    )
}
