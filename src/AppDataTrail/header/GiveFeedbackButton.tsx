import { css, cx } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';
import React from 'react';

import { reportExploreMetrics } from 'shared/tracking/interactions';

const FEEDBACK_FORM_URL_GOOGLE = 'https://forms.gle/5E9JGAuHqTcS5YJ29';

interface Props {
  className?: string;
}

function trackUsage() {
  reportExploreMetrics('give_feedback_clicked', {});
}

export const GiveFeedbackButton = ({ className }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.wrapper, className)}>
      <a
        href={FEEDBACK_FORM_URL_GOOGLE}
        className={styles.feedback}
        title={t('give-feedback.tooltip', 'Share your thoughts about Metrics in Grafana.')}
        target="_blank"
        rel="noreferrer noopener"
        onClick={trackUsage}
      >
        <Icon name="comment-alt-message" /> {t('give-feedback.button', 'Give feedback')}
      </a>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      position: 'absolute',
      top: 0,
      right: 0,
    }),
    feedback: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        color: theme.colors.text.link,
      },
    }),
  };
};
