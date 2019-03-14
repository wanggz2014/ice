// import { Icon } from '@icedesign/base';
import React, { Component } from 'react';
import classnames from 'classnames';
import Icon from '../../../../components/Icon';

import './index.scss';

const styles = {
  actionIcon: {
    cursor: 'pointer',
  },
  actionIconDisabled: {
    cursor: 'not-allowed',
    color: '#EEEEEE',
  },
  acitonLabel: {
    fontSize: 12,
    display: 'block',
    paddingTop: 3,
  },
};

class ActionButton extends Component {
  constructor(props) {
    super(props);
  }

  handleClick = () => {
    if (!this.props.disabled) {
      this.props.onClick();
    }
  };

  render() {
    let disabledStyle = this.props.disabled ? styles.actionIconDisabled : {};
    const disabledLabel = this.props.disabledLabel || '';
    const label = this.props.disabled ? disabledLabel : this.props.label;
    const cn = classnames('action-button-item', {[this.props.className]: this.props.className});
    return (
      <div className={cn} onClick={this.handleClick}>
        <Icon
          style={{
            ...styles.actionIcon,
            ...disabledStyle,
          }}
          size={this.props.size || 'medium'}
          type={this.props.name}
        />
        <span style={{ ...styles.acitonLabel, ...disabledStyle }}>
          {label || this.props.label}
        </span>
      </div>
    );
  }
}

export default ActionButton;
