def((Button) => class extends Jinkela {
  static popup(config) {
    if (typeof config === 'string') config = { text: config };
    let ins = new this(config);
    if (config.autoCancel !== false) ins.then(dialog.cancel, dialog.cancel);
    dialog.popup(ins);
    return Promise.resolve(ins);
  }
  init() {
    this.title = this.title || 'Confirm';
    this.text = this.text || 'Are you sure?';

    if (this.onYes.action) this.onYes = doAction.bind(null, this.onYes);
    if (this.onCancel.action) this.onCancel = doAction.bind(null, this.onCancel);
    let onYes = () => this.resolve(Promise.resolve('yes').then(this.onYes));
    let onCancel = () => this.resolve(Promise.resolve('cancel').then(this.onCancel));

    if (!this.yes) this.yes = 'Yes';
    this.yes = typeof this.yes === 'string' ? { text: this.yes } : this.yes;
    this.yesButton = new Button(this.yes, { onClick: onYes });

    if (!this.cancel) this.cancel = { text: 'Cancel', color: '#ccc' };
    this.cancel = typeof this.cancel === 'string' ? { text: this.cancel } : this.cancel;
    this.cancelButton = new Button(this.cancel, { onClick: onCancel });
  }
  get handlers() {
    let value = new Set();
    Object.defineProperty(this, 'handlers', { configurable: true, value });
    return value;
  }
  then(...handler) { this.handlers.add(handler); }
  resolve(arg) {
    let $result = Promise.resolve(arg);
    this.handlers.forEach(handler => {
      $result.then(...handler);
      this.handlers.delete(handler);
    });
  }
  onYes() {}
  onCancel() {}
  get template() {
    return `
      <div>
        <h3>{text}</h3>
        <div>
          <meta ref="yesButton" />
          <meta ref="cancelButton" />
        </div>
      </div>
    `;
  }
  get styleSheet() {
    return `
      :scope {
        h3 {
          margin: 0 0 2em 0;
          font-size: 18px;
        }
        button {
          font-size: 16px;
          margin: 0 1em;
        }
        padding: 2em;
      }
    `;
  }
});
