import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";

const chromePaths: Record<string, string> = {
    darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    linux: "/usr/bin/google-chrome",
    win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
};

// A minimal client of the DevTools protocol for the single page of a freshly started Chrome
const connect = async (chrome: ChildProcess, path: string) => {
    const port = await new Promise<string>((resolve, reject) => {
        let output = String();
        chrome.stderr?.on("data", chunk => {
            output += chunk;
            const [, port] = output.match(/DevTools listening on ws:\/\/[^:]+:(\d+)/) ?? [];
            if (port) resolve(port);
        });
        chrome.on("error", () => reject(new Error(`Google Chrome was not found at ${path}, so set CHROME_PATH`)));
        chrome.on("exit", () => reject(new Error("Google Chrome could not be started")));
    });

    const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
    const socket = new WebSocket((await response.json()).webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener("open", resolve));

    let id = 0;
    const calls = new Map<number, (message: any) => void>();
    const listeners = new Map<string, (params: any) => void>();
    socket.addEventListener("message", ({ data }) => {
        const message = JSON.parse(data);
        if (message.id) calls.get(message.id)?.(message);
        else listeners.get(message.method)?.(message.params);
    });

    const send = (method: string, params = {}) => new Promise<any>((resolve, reject) => {
        calls.set(++id, ({ result, error }) => error ? reject(new Error(error.message)) : resolve(result));
        socket.send(JSON.stringify({ id, method, params }));
    });
    const on = (method: string, listener: (params: any) => void) => listeners.set(method, listener);
    return { send, on };
};

// Prints pages with the local Chrome, just like its print dialog does, and merges them into one PDF;
// the authorization is only added to page requests to the origin, so that it never reaches other hosts
export const printPdf = async (urls: string[], origin: string, authorization: string) => {
    const path = process.env.CHROME_PATH ?? chromePaths[process.platform];
    const profile = await mkdtemp(join(tmpdir(), "paperloop-"));
    // A mock keychain, as macOS would otherwise ask for access to the keychain
    const chrome = spawn(path, [
        "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
        "--use-mock-keychain", "about:blank"
    ], { stdio: ["ignore", "ignore", "pipe"] });

    try {
        const { send, on } = await connect(chrome, path);
        await send("Page.enable");
        await send("Fetch.enable", { patterns: [{ urlPattern: `${origin}/*`, resourceType: "Document" }] });
        on("Fetch.requestPaused", ({ requestId, request }) => send("Fetch.continueRequest", {
            requestId,
            headers: [
                ...Object.entries(request.headers).map(([name, value]) => ({ name, value })),
                { name: "Authorization", value: authorization }
            ]
        }).catch(() => {}));

        const merged = await PDFDocument.create();
        for (const url of urls) {
            const loaded = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error(`${url} did not load`)), 30000);
                on("Page.loadEventFired", () => resolve(clearTimeout(timeout)));
            });
            await send("Page.navigate", { url });
            await loaded;

            // A missing document or an invalid key leads to another page, which must not be printed instead
            const { result } = await send("Runtime.evaluate", {
                // Headers and footers are only resolved before printing, and images only load once rendered
                expression: `(async () => {
                    window.onbeforeprint?.();
                    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
                    await document.fonts.ready;
                    return location.href;
                })()`,
                awaitPromise: true,
                returnByValue: true
            });
            if (result.value !== url) throw new Error(`${url} could not be opened, so check the link and the API key`);

            // A4 in inches, unless a document sets a page size of its own
            const { data } = await send("Page.printToPDF", { preferCSSPageSize: true, paperWidth: 210 / 25.4, paperHeight: 297 / 25.4 });
            const pdf = await PDFDocument.load(Buffer.from(data, "base64"));
            for (const page of await merged.copyPages(pdf, pdf.getPageIndices())) merged.addPage(page);
        }
        return merged;
    } finally {
        await new Promise(resolve => {
            chrome.once("exit", resolve);
            if (!chrome.kill()) resolve(undefined);
        });
        await rm(profile, { recursive: true, force: true });
    }
};
