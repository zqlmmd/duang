window.duang = () => {

  if (window.depot) return;

  require.config({
    paths: {
      marked: 'https://shadow.elemecdn.com/gh/chjj/marked@v0.3.6/marked.min',
      codemirror: 'https://shadow.elemecdn.com/gh/codemirror/CodeMirror@5.19.0'
    }
  });

  const parseObjectJSON = what => {
    try {
      what = JSON.parse(what);
    } catch (error) {
      void error;
    }
    return Object(what);
  };

  const CACHE_SYMBOL = Symbol('cache');

  class Depot {
    constructor(uParams) {
      this.resetCache();
      if (uParams) this.cache('uParams', () => uParams);
      Depot.initRootDepotOnce(this);
    }

    static initRootDepotOnce(depot) {
      // 只执行一次
      Object.defineProperty(this, 'initRootDepotOnce', { configurable: true, value: () => {} });
      // 全局事件注册
      if (document.readyState === 'complete') {
        setTimeout(() => depot.hashchange());
      } else {
        addEventListener('load', () => depot.hashchange());
      }
      addEventListener('hashchange', () => depot.hashchange());
      // 默认对话框样式不适合 Duang，魔改一波
      initDialog: {
        let { popup } = dialog;
        Object.defineProperty(dialog, 'popup', {
          configurable: true,
          value: (panel, options) => {
            dialog.box.element.style.maxHeight = '80%';
            dialog.box.element.style.overflow = 'auto';
            if (options && options.minWidth) {
              dialog.box.element.style.setProperty('min-width', options.minWidth);
            } else {
              dialog.box.element.style.removeProperty('min-width');
            }
            popup(panel);
          }
        });
      }
    }

    static waitUntilReady() {
      let promise = Promise.resolve(this.initConfig()).then(value => {
        Object.defineProperty(this.prototype, 'config', { configurable: true, value });
        return this.initSchemes();
      }).then(value => {
        Object.defineProperty(this.prototype, 'schemes', { configurable: true, value });
        return this.initSession();
      }).then(value => {
        Object.defineProperty(this.prototype, 'session', { configurable: true, value });
      }).catch(error => {
        setTimeout(() => { throw error; });
        return new Promise(() => {});
      });
      Object.defineProperty(this, 'waitUntilReady', { configurable: true, value: () => promise });
      return promise;
    }

    static initConfig() {
      const configElement = document.querySelector('script[config]');
      const config = configElement && configElement.getAttribute('config') || '';
      let task = window.config ? Promise.resolve(window.config) : api(config);
      dispatchEvent(new CustomEvent('duang::notify', { detail: '正在加载根配置' }));
      task.then(value => {
        dispatchEvent(new CustomEvent('duang::notify', { detail: '根配置加载完毕' }));
        window.config = value; // 写到全局
      }, error => {
        dispatchEvent(new CustomEvent('duang::fatal', { detail: '根配置加载失败' }));
        throw error;
      });
      return task;
    }

    static initSchemes() {
      let { config } = this.prototype;
      let schemes = JSON.parse(JSON.stringify(config && config.schemes || []));
      let tasks = schemes.map(scheme => typeof scheme !== 'string' ? scheme : api(scheme));
      if (tasks.length === 0) return Promise.resolve([]);
      let total = 0;
      let loaded = 0;
      let update = result => {
        loaded++;
        dispatchEvent(new CustomEvent('duang::notify', { detail: `正在加载子配置 (${loaded}/${total})` }));
        return result;
      };
      total = tasks.filter(task => task instanceof Promise).map(task => task.then(update)).length;
      dispatchEvent(new CustomEvent('duang::notify', { detail: `正在加载子配置 (${loaded}/${total})` }));
      return Promise.all(tasks).then(list => {
        update = () => {};
        dispatchEvent(new CustomEvent('duang::notify', { detail: '子配置加载完毕' }));
        return [].concat(...list);
      }, error => {
        update = () => {};
        dispatchEvent(new CustomEvent('duang::fatal', { detail: '子配置加载失败' }));
        throw error;
      });
    }

    static initSession() {
      let { config } = this.prototype;
      let task = config.session ? api(config.session.authorize, { method: config.session.method || 'post' }) : Promise.resolve({});
      dispatchEvent(new CustomEvent('duang::notify', { detail: '正在加载用户信息' }));
      task.then(value => {
        dispatchEvent(new CustomEvent('duang::notify', { detail: '用户信息加载完毕' }));
        window.session = value;
      }, reason => {
        let response = reason && reason[Symbol.for('response')] || {};
        if (response.status === 401 || reason.name === 'UNAUTHORIZED') {
          location.href = api.resolvePath(new Function('return `' + config.session.signin + '`')());
        } else if (response.status !== 200) {
          dispatchEvent(new CustomEvent('duang::fatal', { detail: '用户信息加载失败' }));
          throw Error('用户信息加载失败');
        }
      });
      return task;
    }

    onRouteChange() {
      return Depot.waitUntilReady().then(() => {
        dispatchEvent(new CustomEvent('duang::notify', { detail: '正在加载并渲染框架控件' }));
        this.resetCache();

        // 自动刷新（废弃）
        if (this._autoRefreshTimer) {
          clearTimeout(this._autoRefreshTimer);
          delete this._autoRefreshTimer;
        }

        return Promise.all([
          req('Frame'),
          this.loadModule(this.module)
        ]);
      }).then(([ Frame, Main ]) => {
        dispatchEvent(new CustomEvent('duang::done'));
        if (!this.moduleComponent) this.moduleComponent = new Frame().to(document.body);
        this.refresh(Main);

        // 自动刷新（废弃）
        let { autoRefresh } = this.scheme || {};
        if (+autoRefresh) {
          this._autoRefreshTimer = setTimeout(() => {
            this.refresh();
            delete this._autoRefreshTimer;
          }, autoRefresh * 1000);
        }
      }, error => {
        dispatchEvent(new CustomEvent('duang::fatal', { detail: '框架组件加载失败' }));
        alert(error.message);
        setTimeout(() => { throw error; });
      });
    }

    hashchange() { this.onRouteChange(); }

    // 缓存相关
    resetCache(value = {}) { Object.defineProperty(this, CACHE_SYMBOL, { configurable: true, value }); }
    cache(name, resolver) {
      let cache = this[CACHE_SYMBOL];
      if (name in cache) return cache[name];
      return (cache[name] = resolver());
    }

    /**
     * 属性缓存
    **/

    get module() { return this.uParams.module || this.config.defaultModule || 'default'; }
    get id() { return this.params.id; }
    get key() { return this.uParams.key; }
    get resolvedKey() { return String(this.key).replace(/:(?=\D)([^/]+)/g, ($0, $1) => this.params[$1]); }
    get scheme() { return this.schemeMap[this.key] || {}; }
    get where() { return this.cache('where', () => parseObjectJSON(this.uParams.where)); }
    get params() { return this.cache('params', () => parseObjectJSON(this.uParams.params)); }
    get uParams() { return this.cache('uParams', () => new UParams()); }
    get formMode() {
      if (this.params.readonly) {
        return 'read';
      } else {
        return this.id ? 'edit' : 'create';
      }
    }
    get schemeMap() {
      let value = Object.create(null);
      this.schemes.forEach(scheme => {
        if (scheme.key !== void 0) value[scheme.key] = scheme;
      });
      Object.defineProperty(this, 'schemeMap', { value });
      return value;
    }
    get pageSize() {
      let pageSize = this.uParams.pageSize || this.scheme.pageSize;
      return pageSize instanceof Array ? pageSize[0] : pageSize;
    }
    get queryParams() {
      let params = {};
      let { page, where, orderBy } = this.uParams;
      if (this.pageSize) {
        params.limit = this.pageSize;
        params.offset = this.pageSize * (page - 1 || 0);
      }
      if (where) params.where = where;
      if (orderBy) params.orderBy = orderBy;
      return new UParams(params);
    }
    getConst(name) {
      let { config, scheme } = this;
      return (scheme && scheme.const && scheme.const[name]) || (config.const && config.const[name]) || name;
    }

    /**
     * 各种方法
    **/

    refresh(Main = this.main.constructor) {
      let { scheme } = this;

      // 重新初始化构造器
      let newMain = new Main({ depot: this });

      // 如果设置了 gentleRefreshing，就考虑新实例的 promsie 异步
      let promise = scheme.gentleRefreshing && newMain.promise || Promise.resolve();

      return promise.then(() => {
        this.moduleComponent.main = newMain;
      });
    }

    loadModule(name) {
      // 对纯单词作为 MainWith 来加载，否则认为是一个 URL
      if (/^\w+$/.test(name)) {
        name = 'MainWith' + String(name).replace(/./, $0 => $0.toUpperCase()); // 首字母大写
      }
      return req(name).catch(() => req('MainWithError'));
    }

    go({ args, target, title }) {
      args = Object.assign({}, args);
      if (args.where && typeof args.where === 'object') args.where = JSON.stringify(args.where);
      if (args.params && typeof args.params === 'object') args.params = JSON.stringify(args.params);
      let uParams = new UParams(args);
      switch (target) {
        case '_blank':
          return open(location.href.replace(/(#.*)?$/, '#!' + uParams));
        case 'dialog':
          try {
            return this.loadModule(args.module).then(Main => {
              let newDepot = new Depot(uParams);
              let main = new Main({ depot: newDepot, title });
              newDepot.moduleComponent = {
                get main() { return main; },
                set main(value) { main = value.renderWith(main); }
              };
              return Promise.resolve(main.$promise).then(() => {
                dialog.popup(main);
              });
            });
          } catch (error) {
            return console.error(error); // eslint-disable-line
          }
        case 'soft':
          return history.pushState(null, null, location.href.replace(/(#.*)?$/, '#!' + uParams));
        case 'replace':
          return location.replace(location.href.replace(/(#.*)?$/, '#!' + uParams));
        default:
          this.update(uParams, true);
      }
    }

    update(uParams = {}, whole) {
      uParams = new UParams(whole ? uParams : Object.assign({}, this.uParams, uParams));
      if (this !== window.depot) {
        this.resetCache({ uParams });
        this.refresh();
      } else {
        let hash = '#!' + uParams;
        if (location.hash === hash) {
          this.refresh();
        } else {
          location.hash = hash;
        }
      }
    }

    fork(...args) { return new Depot(...args); }
  }

  window.depot = new Depot();

};
