import { css } from '@emotion/css';
import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import React from 'react';

import { reportExploreMetrics } from 'shared/tracking/interactions';

// TODO: review on the 25th of September 2025 (see https://github.com/grafana/metrics-drilldown/issues/579)
// const FEEDBACK_FORM_URL_QUALTRICS = 'https://grafana.qualtrics.com/jfe/form/SV_9FXX8XzCNe7G1g2';
const FEEDBACK_FORM_URL_GOOGLE = 'https://forms.gle/dKHDM4GDXVYPny3L6';

function trackUsage() {
  reportExploreMetrics('give_feedback_clicked', {});
}

export const GiveFeedbackButton = () => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <a
        href={FEEDBACK_FORM_URL_GOOGLE}
        className={styles.feedback}
        title="Share your thoughts about Metrics in Grafana."
        target="_blank"
        rel="noreferrer noopener"
        onClick={trackUsage}
      >
        <Icon name="comment-alt-message" /> Give feedback
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
