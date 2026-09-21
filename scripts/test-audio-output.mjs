import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import electron from "electron";
import { build } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), "playhead-audio-test-"));
try {
  await build({
    configFile: false,
    root,
    base: "./",
    logLevel: "error",
    build: {
      outDir: temporary,
      emptyOutDir: false,
      lib: {
        entry: path.join(root, "scripts/audio-output-fixture.ts"),
        name: "AudioOutputTest",
        formats: ["iife"],
        fileName: () => "fixture.js",
      },
    },
  });
  await writeFile(
    path.join(temporary, "index.html"),
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'"><script src="fixture.js"></script>',
  );
  await writeFile(
    path.join(temporary, "main.cjs"),
    `
    const {app,BrowserWindow}=require('electron');
    app.setPath('userData',${JSON.stringify(path.join(temporary, "profile"))});
    setTimeout(()=>{console.error('Audio test timed out');app.exit(1)},30000);
    app.whenReady().then(()=>{
      const window=new BrowserWindow({show:false,webPreferences:{sandbox:true}});
      window.webContents.on('console-message',(event)=>{
        if(event.message.startsWith('DSP_RESULTS ')){console.log(event.message);app.exit(0);}
        if(event.message.startsWith('DSP_ERROR ')){console.error(event.message);app.exit(1);}
      });
      window.webContents.on('render-process-gone',()=>app.exit(1));
      window.loadFile(${JSON.stringify(path.join(temporary, "index.html"))}).catch(()=>app.exit(1));
    });
  `,
  );
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(temporary, "main.cjs")], {
      env: environment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.exitCode = exitCode;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
