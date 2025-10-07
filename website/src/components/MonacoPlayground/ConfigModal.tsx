import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DynamicConfigEditor from "./DynamicConfigEditor";
import { GratsConfigSpec } from "grats/src/configSpec";

type ConfigDropdownProps = {
  isOpen: boolean;
  onClose: () => void;
  config: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
};

export default function ConfigDropdown({
  isOpen,
  onClose,
  config,
  onConfigChange,
  buttonRef,
}: ConfigDropdownProps): JSX.Element | null {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 8,
          left: rect.left,
        });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, buttonRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        backgroundColor: "var(--ifm-background-surface-color)",
        borderRadius: "6px",
        width: "600px",
        maxWidth: "90vw",
        maxHeight: "70vh",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        border: "1px solid var(--ifm-color-emphasis-300)",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "0.8em 1em",
          borderBottom: "1px solid var(--ifm-color-emphasis-300)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--ifm-background-surface-color)",
          borderTopLeftRadius: "6px",
          borderTopRightRadius: "6px",
        }}
      >
        <strong style={{ fontSize: "0.95rem" }}>
          All Configuration Options
        </strong>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: "1.3rem",
            cursor: "pointer",
            padding: "0",
            color: "var(--ifm-color-emphasis-700)",
            lineHeight: 1,
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div
        style={{
          overflowY: "auto",
          flex: 1,
          borderBottomLeftRadius: "6px",
          borderBottomRightRadius: "6px",
        }}
      >
        <DynamicConfigEditor
          configSpec={GratsConfigSpec}
          config={config}
          onConfigChange={onConfigChange}
        />
      </div>
    </div>,
    document.body,
  );
}
