import React from 'react'

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
 * <ContinueButton onClick={handleSignIn} />
 * ```
 */
export const ContinueButton = ({
    children = 'Continue with Hellō',
    className = '',
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode
}) => {
    return React.createElement(
        'button',
        {
            className: `hello-btn ${className}`,
            ...props,
        },
        'ō\u00A0\u00A0',
        children,
    )
}
