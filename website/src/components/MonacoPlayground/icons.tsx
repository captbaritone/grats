import React from "react";

// Small line icons, drawn on a 24px grid, which take the text's color.

type IconProps = { size?: number; className?: string };

function Icon({
  size = 15,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icon>
  );
}

// GraphiQL's execute icon, a filled play triangle.
export function PlayIcon({ size = 12, className }: IconProps) {
  return (
    <svg
      width={size}
      height={(size * 18) / 16}
      viewBox="0 0 16 18"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M0 1.66A1 1 0 0 1 1.468.778l13.863 7.34a1 1 0 0 1 0 1.767L1.468 17.223A1 1 0 0 1 0 16.339z" />
    </svg>
  );
}

// GraphiQL's prettify icon, a broom with sparkles, so Format matches it.
export function FormatIcon({ size = 15, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 25 25"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.563}
      aria-hidden="true"
      className={className}
    >
      <path d="m10.285 24.075 3.429-6m.86 6 2.572-4.286m2.341 4.285 1.236-2.322a5.98 5.98 0 0 0-1.089-7.065l4.164-7.808a1.714 1.714 0 0 0-3.025-1.614l-4.165 7.81a5.98 5.98 0 0 0-6.473 3.025L6 24.073" />
      <path
        strokeLinejoin="round"
        d="m4 15 1-2 2-1-2-1-1-2-1 2-2 1 2 1zm7.5-7 1.166-2.334L15 4.5l-2.334-1.166L11.5 1l-1.166 2.334L8 4.5l2.334 1.166z"
      />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </Icon>
  );
}

// An Erlenmeyer flask: the laboratory, for experimental features.
export function FlaskIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3h8" />
      <path d="M9.5 3v6.2L4.6 18.1A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.9L14.5 9.2V3" />
      <path d="M7.2 15h9.6" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

// File type icons, in each language's colors.

export function TypeScriptFileIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect width="16" height="16" rx="3" fill="#3178c6" />
      <text
        x="8.6"
        y="12.2"
        fill="#fff"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        textAnchor="middle"
      >
        TS
      </text>
    </svg>
  );
}

export function GraphQLFileIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="#e10098"
      strokeWidth="1.2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 1.5l5.6 3.25v6.5L8 14.5l-5.6-3.25v-6.5z" />
      <path d="M8 1.5l5.6 9.75H2.4z" />
      <g fill="#e10098" stroke="none">
        <circle cx="8" cy="1.5" r="1.4" />
        <circle cx="13.6" cy="4.75" r="1.4" />
        <circle cx="13.6" cy="11.25" r="1.4" />
        <circle cx="8" cy="14.5" r="1.4" />
        <circle cx="2.4" cy="11.25" r="1.4" />
        <circle cx="2.4" cy="4.75" r="1.4" />
      </g>
    </svg>
  );
}

export function JsonFileIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="#d4a72c"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5.5 2.5c-1.5 0-2 .7-2 2v1.6c0 .9-.5 1.4-1.5 1.9 1 .5 1.5 1 1.5 1.9v1.6c0 1.3.5 2 2 2" />
      <path d="M10.5 2.5c1.5 0 2 .7 2 2v1.6c0 .9.5 1.4 1.5 1.9-1 .5-1.5 1-1.5 1.9v1.6c0 1.3-.5 2-2 2" />
    </svg>
  );
}
