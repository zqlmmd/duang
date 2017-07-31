def((Button) => {

  class SpanButton extends Button {
    get tagName() { return 'span'; }
    get styleSheet() {
      return `
        :scope {
          margin-right: 1em;
          display: inline-block;
        }
      `;
    }
  }

  class DownloadLink extends Jinkela {
    init() { this.downloadText = this.downloadText || '下载'; }
    set value(value) {
      this.$value = value;
      this.visible = !!value;
      this.link = `data:application/octet-stream;base64,${value}`;
    }
    get value() { return this.$value; }
    get template() { return '<a if="{visible}" href="{link}" download>{downloadText}</a>'; }
    get styleSheet() {
      return `
        :scope {
          display: inline-block;
          margin-right: 15px;
          text-decoration: underline;
          color: #20A0FF;
        }
      `;
    }
  }

  class FileInfo extends Jinkela {
    get tagName() { return 'span'; }
    get styleSheet() {
      return `
        :scope {
          color: #999;
          vertical-align: middle;
        }
      `;
    }
  }

  class CancelButton extends Jinkela {
    init() {
      this.element.addEventListener('click', this.onClick);
    }
    get template() { return '<a href="JavaScript:">&#x274C;</a>'; }
    get styleSheet() {
      return `
        :scope {
          vertical-align: middle;
          margin-left: 1em;
        }
      `;
    }
  }

  return class extends Jinkela {
    get SpanButton() { return SpanButton; }
    get DownloadLink() { return DownloadLink; }
    get value() { return this.$value; }
    set value(value = this.defaultValue) {
      this.$hasValue = true;
      this.$value = value;
      this.base64 = value;
      if (value) {
        this.fileInfo.element.textContent = Math.floor(String(value).replace(/=*$/, '').length * 3 / 4).toLocaleString() + ' Bytes';
      } else {
        this.fileInfo.element.textContent = '未选择';
      }
      this.label.setAttribute('notEmpty', !!value);
    }
    get template() {
      return `
        <div>
          <label ref="label">
            <input ref="input" if-not="{readonly}" type="file" />
            <jkl-span-button if-not="{readonly}" ref="button" text="{text}"></jkl-span-button>
            <jkl-download-link value="{base64}" downloadText="{downloadText}"></jkl-download-link>
          </label>
        </div>
      `;
    }
    init() {
      this.fileInfo = new FileInfo().to(this);
      if (this.readonly) {
        this.element.classList.add('readonly');
      } else {
        if (!this.text) this.text = '请选择文件';
        new CancelButton({ onClick: () => (this.value = null) }).to(this);
        this.input.addEventListener('change', event => this.change(event));
      }
      if (!this.$hasValue) this.value = void 0;
    }
    change(event) {
      let { target } = event;
      let file = target.files[0];
      if (!file) return;
      let fr = new FileReader();
      this.button.element.classList.add('busy');
      fr.addEventListener('load', () => {
        let { result } = fr;
        let base64 = result.slice(result.indexOf(',') + 1);
        this.value = base64;
        this.button.element.classList.remove('busy');
      });
      fr.readAsDataURL(file);
    }
    get styleSheet() {
      return `
        :scope {
          label {
            display: inline-block;
          }
          label ~ a { display: none; }
          label[notEmpty=true] ~ a { display: inline-block; }
          input { display: none; }
        }
      `;
    }
  };

});
