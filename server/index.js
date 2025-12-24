import express from 'express';
import { createServer as createViteServer } from 'vite';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 5173;

async function createServer() {
    const app = express();

    // Create Vite server in middleware mode and configure the app type as
    // 'custom', disabling Vite's own HTML serving logic so parent server
    // can take control
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
    });

    // Use vite's connect instance as middleware - MOVED TO BOTTOM
    // app.use(vite.middlewares);

    // API Routes
    app.use(express.json());
    // Serve 'ressources' directory statically under a safe namespace
    app.use('/api/static', express.static(path.resolve(__dirname, '..', 'ressources')));

    // Debug Logger
    app.use('/api', (req, res, next) => {
        console.log(`[API] ${req.method} ${req.url}`);
        next();
    });

    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', server: 'custom-node-server' });
    });

    // --- FILE IO API ---

    // SAVE FILE
    app.post('/api/files/save', async (req, res) => {
        try {
            const { filePath, content } = req.body;
            if (!filePath || !content) return res.status(400).json({ error: 'Missing filePath or content' });

            const absolutePath = path.resolve(__dirname, '..', filePath);
            if (!absolutePath.startsWith(path.resolve(__dirname, '..'))) {
                return res.status(403).json({ error: 'Access denied: Path outside project root' });
            }

            // Ensure JSON is formatted if it looks like JSON
            let dataToWrite = content;
            if (typeof content === 'object') {
                dataToWrite = JSON.stringify(content, null, 4);
            }

            await fs.writeFile(absolutePath, dataToWrite, 'utf8');
            console.log(`[File] Saved: ${filePath}`);
            res.json({ success: true, message: 'File saved successfully' });
        } catch (err) {
            console.error(`[File] Save Error: ${err.message}`);
            res.status(500).json({ error: err.message });
        }
    });

    // CREATE FILE
    app.post('/api/files/create', async (req, res) => {
        try {
            const { directory, filename, content } = req.body;
            if (!directory || !filename) return res.status(400).json({ error: 'Missing directory or filename' });

            const safeFilename = filename.replace(/[^a-z0-9_\-\.]/gi, '_'); // Basic sanitization
            const dirPath = path.resolve(__dirname, '..', directory);
            if (!dirPath.startsWith(path.resolve(__dirname, '..'))) {
                return res.status(403).json({ error: 'Access denied: Path outside project root' });
            }

            await fs.mkdir(dirPath, { recursive: true });
            const absolutePath = path.join(dirPath, safeFilename);

            let dataToWrite = content || {};
            if (typeof dataToWrite === 'object') {
                dataToWrite = JSON.stringify(dataToWrite, null, 4);
            }

            // Check existence
            try {
                await fs.access(absolutePath);
                return res.status(409).json({ error: 'File already exists' });
            } catch (e) {
                // File doesn't exist, proceed
            }

            await fs.writeFile(absolutePath, dataToWrite, 'utf8');
            console.log(`[File] Created: ${absolutePath}`);
            res.json({ success: true, message: 'File created successfully', path: absolutePath });
        } catch (err) {
            console.error(`[File] Create Error: ${err.message}`);
            res.status(500).json({ error: err.message });
        }
    });

    // DELETE FILE
    app.delete('/api/files', async (req, res) => {
        try {
            const { filePath } = req.body;
            if (!filePath) return res.status(400).json({ error: 'Missing filePath' });

            const absolutePath = path.resolve(__dirname, '..', filePath);
            if (!absolutePath.startsWith(path.resolve(__dirname, '..'))) {
                return res.status(403).json({ error: 'Access denied: Path outside project root' });
            }

            await fs.unlink(absolutePath);
            console.log(`[File] Deleted: ${filePath}`);
            res.json({ success: true, message: 'File deleted successfully' });
        } catch (err) {
            console.error(`[File] Delete Error: ${err.message}`);
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/admin/rebuild-index/:type', (req, res) => {
        const { type } = req.params;
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        let command = '';

        switch (type) {
            case 'spells':
                command = `${npmCmd} run build:spells`;
                break;
            case 'items':
            case 'shop':
                command = `${npmCmd} run build:shop`;
                break;
            case 'feats':
                command = `${npmCmd} run build:feats`;
                break;
            case 'actions':
                command = `${npmCmd} run build:actions`;
                break;
            case 'all':
                command = `${npmCmd} run build:data`;
                break;
            default:
                return res.status(400).json({ error: 'Invalid index type' });
        }

        console.log(`[Admin] Rebuilding ${type} index using ${command}...`);

        // Increase buffer size just in case
        exec(command, { cwd: path.resolve(__dirname, '..'), maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
            try {
                if (error) {
                    console.error(`[Admin] Error: ${error.message}`);
                    return res.status(500).json({ error: error.message, details: stderr || error.toString() });
                }
                if (stderr) {
                    console.warn(`[Admin] Stderr: ${stderr}`);
                }
                console.log(`[Admin] Success: ${stdout.substring(0, 100)}...`);
                return res.json({ success: true, message: `Rebuilt ${type} index`, output: stdout });
            } catch (e) {
                console.error("[Admin] Callback processing error:", e);
                return res.status(500).json({ error: "Internal Server Error during callback processing" });
            }
        });
    });


    // Vite Middleware (Must be last to handle SPA fallback)
    app.use(vite.middlewares);

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Admin API ready at http://localhost:${PORT}/api/admin`);
    });
}

createServer();
