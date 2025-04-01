import { css } from '@emotion/css';
import { Portal, useStyles2 } from '@grafana/ui';
import React, { cloneElement, useCallback, useEffect, useRef, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';

interface Props {
  children: React.ReactElement;
  overlay: React.ReactElement;
  isOpen: boolean;
  onVisibleChange: (isVisible: boolean) => void;
}

export const Dropdown = ({ children, overlay, isOpen, onVisibleChange }: Props) => {
  const styles = useStyles2(getStyles);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      });
    }
  }, []);

  const handleTriggerClick = useCallback(() => {
    if (!isOpen) {
      updatePosition();
    }
    onVisibleChange(!isOpen);
  }, [isOpen, updatePosition, onVisibleChange]);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (!isOpen) {
        return;
      }

      const target = event.target as Node;
      const clickedTrigger = triggerRef.current?.contains(target);
      const clickedOverlay = overlayRef.current?.contains(target);

      if (!clickedTrigger && !clickedOverlay) {
        onVisibleChange(false);
      }
    },
    [isOpen, onVisibleChange]
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [handleClickOutside, updatePosition]);

  const childrenWithProps = cloneElement(children, {
    onClick: handleTriggerClick,
  });

  const overlayWithProps = cloneElement(overlay, {
    onClose: () => {
      onVisibleChange(false);
    },
  });

  return (
    <>
      <div ref={triggerRef} className={styles.trigger}>
        {childrenWithProps}
      </div>
      {isOpen && (
        <Portal>
          <div ref={overlayRef} className={styles.overlay} style={{ top: position.top, left: position.left }}>
            {overlayWithProps}
          </div>
        </Portal>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    trigger: css`
      display: inline-block;
    `,
    overlay: css`
      position: fixed;
      z-index: ${theme.zIndex.dropdown};
    `,
  };
};
