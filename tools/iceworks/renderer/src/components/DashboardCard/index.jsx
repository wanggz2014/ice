import React, { Component } from 'react';
import classnames from 'classnames';

import './index.scss';

class DashboardCard extends Component {
  render() {
    return (
      <div className="dashboard-card-wrapper" {...this.props}>
        <div className="dashboard-card">{this.props.children}</div>
      </div>
    );
  }
}

class Header extends Component {
  render() {
    const cn = classnames({
      'dashboard-card-header': true,
      [this.props.className]: this.props.className
    })
    return (
      <div  {...this.props} className={cn}>
        {this.props.children}
      </div>
    );
  }
}

class Body extends Component {
  render() {
    return (
      <div className="dashboard-card-body" {...this.props}>
        <div className="dashboard-card-body-innner">{this.props.children}</div>
      </div>
    );
  }
}

DashboardCard.Header = Header;
DashboardCard.Body = Body;

export default DashboardCard;
