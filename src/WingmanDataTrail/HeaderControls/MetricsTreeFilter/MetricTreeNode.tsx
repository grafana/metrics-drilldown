import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Checkbox, IconButton, Tag, Tooltip, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';

import { type ArrayNode } from './metric-names-parser/src/parseMetricsList';

export const MetricTreeNode = ({
  node,
  selectedNodeIds,
  isLastChild,
  onToggleCheckbox,
  ancestorPrefix = '',
  isChild = false,
  level = 0,
}: {
  node: ArrayNode;
  selectedNodeIds: string[];
  isLastChild: boolean;
  onToggleCheckbox: (node: ArrayNode) => void;
  ancestorPrefix?: string;
  isChild?: boolean;
  level?: number;
}) => {
  const styles = useStyles2(getStyles);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={isChild ? styles.nodeContainer : ''}
      style={{
        marginLeft: '0',
        position: 'relative',
      }}
    >
      <div className={`${styles.nodeRow} ${isChild ? styles.childNodeRow : ''}`}>
        <div className={cx(styles.iconContainer, !node.children.length && 'horiz')}>
          {node.children.length > 0 ? (
            <IconButton
              className={styles.expandIcon}
              name={expanded ? 'minus-circle' : 'plus-circle'}
              onClick={() => setExpanded(!expanded)}
              tooltip=""
            />
          ) : null}
        </div>
        <div className={styles.labelContainer}>
          <div className={styles.checkbox}>
            <Checkbox
              id={node.id}
              label=""
              checked={selectedNodeIds.includes(node.id)}
              onChange={() => onToggleCheckbox(node)}
            />
          </div>
          <Tooltip content={isChild ? `${ancestorPrefix}${node.separator}${node.prefix}` : node.prefix} placement="top">
            <label className={styles.nodeName} htmlFor={node.id}>
              {isChild && (
                <span className={styles.ancestorPrefix}>
                  {ancestorPrefix}
                  {node.separator}
                </span>
              )}
              <span>{node.prefix}</span>
            </label>
          </Tooltip>
          <Tag className={styles.badge} name={node.count.toString()} colorIndex={9} />
        </div>
      </div>

      {expanded && node.children && (
        <div className={`${styles.childrenContainer} ${isLastChild ? styles.lastChild : ''}`}>
          {node.children.map((child, index) => (
            <MetricTreeNode
              key={child.prefix}
              node={child}
              selectedNodeIds={selectedNodeIds}
              onToggleCheckbox={onToggleCheckbox}
              ancestorPrefix={ancestorPrefix ? `${ancestorPrefix}${node.separator}${node.prefix}` : node.prefix}
              isLastChild={!node.children ? true : index === node.children.length - 1}
              isChild={true}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  const treeBorderColor = theme.colors.border.medium;

  return {
    nodeContainer: css`
      display: flex;
      flex-direction: column;
      width: 100%;
      position: relative;
    `,
    nodeRow: css`
      display: flex;
      align-items: center;
      width: 100%;
      padding: ${theme.spacing(0.5)} 0;
      cursor: pointer;
      border-radius: ${theme.shape.radius.default};
      position: relative;
      &:hover {
        background: ${theme.colors.background.secondary};
      }
    `,
    childNodeRow: css`
      &:before {
        content: '';
        position: absolute;
        top: 50%;
        left: -${theme.spacing(2)};
        width: ${theme.spacing(2)};
        height: 1px;
        background-color: ${treeBorderColor};
        z-index: 0;
      }
    `,
    iconContainer: css`
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 28px;
      min-width: 28px;
      height: 24px;
      margin-right: ${theme.spacing(1)};
      z-index: 1;
    `,
    checkbox: css`
      margin-right: ${theme.spacing(1)};
    `,
    labelContainer: css`
      display: flex;
      flex-grow: 1;
      min-width: 0; /* Prevents content from overflowing */
      overflow: hidden;
    `,
    expandIcon: css`
      flex-shrink: 0;
    `,
    nodeName: css`
      font-weight: ${theme.typography.fontWeightMedium};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    `,
    ancestorPrefix: css`
      color: ${theme.colors.text.secondary};
    `,
    separator: css`
      color: ${theme.colors.text.secondary};
    `,
    badge: css`
      margin-left: ${theme.spacing(2)};
      border-radius: 11px;
      padding: 2px ${theme.spacing(1.5)};
      color: ${theme.colors.text.primary};
      background-color: ${theme.colors.background.secondary};
      flex-shrink: 0;
    `,
    childrenContainer: css`
      position: relative;
      padding-left: ${theme.spacing(4)};
      width: 100%;

      /* Vertical line along children */
      &:before {
        content: '';
        position: absolute;
        top: 0;
        left: 14px; /* Align with the center of the icon container */
        width: 1px;
        height: 100%;
        background-color: ${treeBorderColor};
        z-index: 0;
      }
    `,
    lastChild: css`
      /* For the last child, only show vertical line halfway down */
      &:before {
        height: 14px;
      }
    `,
  };
}
