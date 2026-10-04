const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const WebSocket = require('./server/node_modules/ws');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbXVzaXZpemUwMDAwcGJsNWdmOHEybXN6Iiwicm9sZSI6IlBMQVlFUiIsImFwcHJvdmFsU3RhdHVzIjoiQVBQUk9WRUQiLCJpYXQiOjE3OTEwMzk4MzcsImV4cCI6MTc5MTY0NDYzN30.YG9XwzlJENKaPzBWKA1IQTPoBNY8oMES__oK0IaPvYM";

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ready = new Promise(resolve => this.ws.on('open', resolve));
    this.ws.on('message', data => {
      const msg = JSON.parse(data.toString());
      if (msg.id && this.callbacks.has(msg.id)) {
        this.callbacks.get(msg.id)(msg);
        this.callbacks.delete(msg.id);
      }
    });
  }

  send(method, params = {}) {
    return new Promise(resolve => {
      const curId = this.id++;
      this.callbacks.set(curId, resolve);
      this.ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    });
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res.result && res.result.data) {
      fs.writeFileSync(filename, Buffer.from(res.result.data, 'base64'));
      console.log(`Saved screenshot: ${filename}`);
    }
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.result?.value;
  }

  async typeCommand(text) {
    // Focus input and set value, then trigger Enter key
    await this.evaluate(`
      (() => {
        const input = document.querySelector('input');
        if (input) {
          input.focus();
          input.value = '${text}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }
      })()
    `);
  }

  async pressEscape() {
    await this.evaluate(`
      (() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
      })()
    `);
  }

  close() {
    this.ws.close();
  }
}

async function runQA() {
  console.log('Launching headless Chrome for QA...');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions'
  ]);

  await sleep(1500);

  try {
    const list = await getJson('http://127.0.0.1:9223/json');
    const wsUrl = list[0].webSocketDebuggerUrl;
    const client = new CDPClient(wsUrl);
    await client.ready;
    console.log('Connected to CDP.');

    await client.send('Page.enable');
    await client.send('Runtime.enable');

    // 1. Set Auth token in localStorage and navigate to /terminal
    await client.send('Page.navigate', { url: 'http://localhost:5173/login' });
    await sleep(1500);

    await client.evaluate(`
      localStorage.setItem('terminal_token', '${TOKEN}');
      localStorage.setItem('token', '${TOKEN}');
    `);

    console.log('Navigating to http://localhost:5173/terminal ...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/terminal' });
    await sleep(2500);

    // 2. Test at 1920x1080 (Default full width terminal state)
    await client.setViewport(1920, 1080);
    await sleep(500);
    await client.screenshot('client/public/qa_1920_default.png');

    // 3. Test `scorecard` command
    console.log('Executing: scorecard');
    await client.typeCommand('scorecard');
    await sleep(1000);
    await client.screenshot('client/public/qa_scorecard_panel.png');

    // 4. Test ESC key to collapse
    console.log('Pressing Escape...');
    await client.pressEscape();
    await sleep(600);
    await client.screenshot('client/public/qa_after_esc.png');

    // 5. Test `whoami`
    console.log('Executing: whoami');
    await client.typeCommand('whoami');
    await sleep(800);
    await client.screenshot('client/public/qa_whoami_panel.png');

    // 6. Test `won`
    console.log('Executing: won');
    await client.typeCommand('won');
    await sleep(800);
    await client.screenshot('client/public/qa_won_panel.png');

    // 7. Test `history`
    console.log('Executing: history');
    await client.typeCommand('history');
    await sleep(800);

    // 8. Test `team`
    console.log('Executing: team');
    await client.typeCommand('team');
    await sleep(800);

    // 9. Test `collab requests`
    console.log('Executing: collab requests');
    await client.typeCommand('collab requests');
    await sleep(800);
    await client.screenshot('client/public/qa_collab_requests.png');

    // 10. Test `inbox`
    console.log('Executing: inbox');
    await client.typeCommand('inbox');
    await sleep(800);
    await client.screenshot('client/public/qa_inbox_panel.png');

    // 11. Test resolutions:
    // 1600x900
    console.log('Testing resolution 1600x900...');
    await client.setViewport(1600, 900);
    await sleep(500);
    await client.screenshot('client/public/qa_1600x900.png');

    // 1440x900
    console.log('Testing resolution 1440x900...');
    await client.setViewport(1440, 900);
    await sleep(500);
    await client.screenshot('client/public/qa_1440x900.png');

    // 1280x720
    console.log('Testing resolution 1280x720...');
    await client.setViewport(1280, 720);
    await sleep(500);
    await client.screenshot('client/public/qa_1280x720.png');

    // Close client
    client.close();
    console.log('Browser QA finished successfully!');
  } catch (err) {
    console.error('QA Error:', err);
  } finally {
    chrome.kill();
  }
}

runQA();
