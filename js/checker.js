// ===== CodeDo — code checker =====
// No backend, no API key needed — so it only checks languages that can
// genuinely run inside the browser itself:
//   - JavaScript: runs natively
//   - Python: runs via Pyodide (a real Python interpreter compiled to
//     WebAssembly, loaded once from a free public CDN)
// Every other language (C, C++, Java, Kotlin, Swift, Dart, C#, Go, Rust,
// SQL, HTML, CSS) can't be compiled inside a browser without a paid
// server, so those publish directly without a check.

const CHECKABLE = ["JavaScript", "Python"];

let pyodideInstance = null;
let pyodideLoading = null;

function loadPyodideScript() {
  if (window.loadPyodide) return Promise.resolve();
  if (pyodideLoading) return pyodideLoading;
  pyodideLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Pyodide load fail ho gaya"));
    document.head.appendChild(script);
  });
  return pyodideLoading;
}

async function getPyodide() {
  if (pyodideInstance) return pyodideInstance;
  await loadPyodideScript();
  pyodideInstance = await window.loadPyodide();
  return pyodideInstance;
}

async function checkPython(code) {
  const py = await getPyodide();
  try {
    await py.runPythonAsync(code);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function checkJavaScript(code) {
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
  } catch (err) {
    return { ok: false, error: `${err.name}: ${err.message}` };
  }
  // Syntax is valid on its own; also try actually running it inside an
  // isolated function scope to catch obvious runtime errors too.
  try {
    new Function(code)();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `${err.name}: ${err.message}` };
  }
}

// Returns { runnable, ok, error }
export async function testRunCode(ourLanguage, code) {
  if (!CHECKABLE.includes(ourLanguage)) {
    return { runnable: false };
  }

  if (ourLanguage === "JavaScript") {
    const result = checkJavaScript(code);
    return { runnable: true, ...result };
  }

  if (ourLanguage === "Python") {
    try {
      const result = await checkPython(code);
      return { runnable: true, ...result };
    } catch (e) {
      // Pyodide itself failed to load (e.g. offline) — don't block
      // publishing on an infrastructure problem, just skip the check.
      return { runnable: false };
    }
  }

  return { runnable: false };
}
