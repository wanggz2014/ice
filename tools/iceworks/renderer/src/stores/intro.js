import { observable, action, computed } from 'mobx';

import services from '../services';
const { settings } = services;

class Intro {
  @observable
  introState = null;
  @observable
  installProject = false; // 初始化项目时，是否选择了安装依赖
  @observable
  stepsEnabled = false;
  // @observable
  // hintStartDebug = false;
  // @observable
  // hintStartDebugSuc = false;
  // @observable
  // hintStartDebugFailed = false;
  @observable
  hintNewPage = false;
  @observable
  hintsEnabled = true;
  @observable
  currentHints = [
    {
      element: '.hint5',
      hint: '新建页面展示在这里，可以添加区块到当前页面或者删除页面',
      hintPosition: 'middle-middle',
      key: 'hintNewPageItemShowed'
    }
  ];

  steps = [
    {
      element: '.intro1',
      intro: 'test 1',
      position: 'bottom',
      tooltipClass: 'myTooltipClass',
      highlightClass: 'myHighlightClass',
    },
    {
      element: '.intro2',
      intro: 'test 2',
    },
    {
      element: '.intro3',
      intro: 'test 3',
    },
    {
      element: '.intro4',
      intro: 'test 4',
      position: 'top',
      tooltipClass: 'myTooltipClass',
    },
    {
      element: '.intro5',
      intro: 'test 5',
    }
  ];

  hints1 = [
    {
      element: '.hint1',
      hint: 'test 1',
      hintPosition: 'middle-middle',
      key: 'hintStartDebugShowed'
    },
    {
      element: '.hint2',
      hint: 'test 2',
      hintPosition: 'middle-middle',
      key: 'hintStartDebugShowed'
    }
  ];
  hints2 = [
    {
      element: '.hint3',
      hint: '点击为项目安装依赖',
      hintPosition: 'middle-middle',
      key: 'hintStartDebugFailedShowed'
    }
  ];
  hints3 = [
    {
      element: '.hint4',
      hint: '点击 url 打开浏览器查看调试服务',
      hintPosition: 'middle-middle',
      key: 'hintStartDebugSucShowed'
    }
  ];
  hints4 = [
    {
      element: '.hint5',
      hint: '新建页面会出现在这里，可以添加区块到页面或者删除页面',
      hintPosition: 'middle-middle',
      key: 'hintNewPageItemShowed'
    },
    {
      element: '.hint6',
      hint: '打开编辑器，开发你的项目吧',
      hintPosition: 'middle-middle',
      key: 'hintNewPageItemShowed'
    }
  ]

  constructor() {
    // 初始化 intro 状态
  }

  @action
  onExit = () =>  {
    this.stepsEnabled = false;
    settings.set('stepShowed', true);
    // step 执行完 启动 hints 提示
    if (!settings.get('hintStartDebugShowed')) {
      this.currentHints = this.hints1;
    }
  }

  @action 
  onhintclose = (index) => {
    if (this.currentHints[index] && this.currentHints[index].key) {
      settings.set(this.currentHints[index].key, true);
    }
  }

  @action
  start() {
    if (!settings.get('stepShowed')) {
      this.stepsEnabled = true;
    }
  }

  @action
  startAfterCloseLogs() {
    if (!settings.get('stepShowed') && this.installProject) {
      this.stepsEnabled = true;
      this.installProject = false;
    }
  }

  @action
  startHintAfterDebugFailed() {
    if (!settings.get('hintStartDebugFailedShowed')) {
      this.currentHints = this.hints2;
    }
  }

  @action
  startHintAfterDebugSuc() {
    if (!settings.get('hintStartDebugSucShowed')) {
      this.currentHints = this.hints3;
    }
  }

  @action
  startHintNewPageItemShowed() {
    if (!settings.get('hintNewPageItemShowed')) {
      this.currentHints = this.hints4;
    }
  }
}

export default new Intro();
