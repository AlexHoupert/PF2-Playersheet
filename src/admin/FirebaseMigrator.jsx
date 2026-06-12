import React, { useState } from 'react';
import { db as firestore } from '../shared/db/firebase-config';
import { doc, setDoc } from 'firebase/firestore';
import { DB_STORAGE_KEY } from '../shared/db/usePersistedDb';

function safeTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

export default function FirebaseMigrator({ db }) {
    const [status, setStatus] = useState(null); // idle, working, success, error
    const [backupStatus, setBackupStatus] = useState(null);

    const handleUpload = async () => {
        if (!confirm("Overwrite cloud database with current LOCAL data?")) return;

        setStatus('working');
        try {
            console.log("Starting migration...");
            // 1. Read from LocalStorage (Source of Truth for migration)
            const rawData = localStorage.getItem(DB_STORAGE_KEY);
            if (!rawData) throw new Error("No local data found.");

            const data = JSON.parse(rawData);
            console.log("Local data loaded, size:", rawData.length);

            // 1.5 Verify Config
            if (!firestore) throw new Error("Firebase Firestore not initialized.");
            if (!firestore.app.options.apiKey || firestore.app.options.apiKey.includes("YOUR_")) {
                throw new Error("Invalid Firebase Config. Check Environment Variables.");
            }

            // 2. Upload to Firestore (with Timeout Race)
            const uploadTask = setDoc(doc(firestore, "data", "master"), data);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Upload timed out (10s). Check console/network.")), 10000)
            );

            await Promise.race([uploadTask, timeoutPromise]);

            console.log("Upload success.");
            setStatus('success');
            alert("Migration Complete! Data is now in the cloud.");
        } catch (err) {
            console.error("Migration Error:", err);
            setStatus('error');
            alert(`Migration Failed: ${err.message}`);
        }
    };

    const handleDownloadBackup = () => {
        setBackupStatus(null);
        try {
            let data = db;
            if (!data) {
                const rawData = localStorage.getItem(DB_STORAGE_KEY);
                if (!rawData) throw new Error("No current data found.");
                data = JSON.parse(rawData);
            }

            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `pf2e-data-backup-${safeTimestamp()}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            setBackupStatus('success');
        } catch (err) {
            console.error("Backup Error:", err);
            setBackupStatus('error');
            alert(`Backup Failed: ${err.message}`);
        }
    };

    const isConfigured = firestore && firestore.app.options.apiKey !== "YOUR_API_KEY";

    if (!isConfigured) return null; // Don't show if not configured

    return (
        <div style={{ padding: 20, border: '1px dashed #666', borderRadius: 8, margin: '20px 0', background: '#222' }}>
            <h3>☁️ Firebase Migration</h3>
            <p>Upload your current local data to the cloud database.</p>
            <button
                onClick={handleUpload}
                className="set-btn"
                disabled={status === 'working'}
                style={{ background: status === 'success' ? '#4caf50' : '#2196f3' }}
            >
                {status === 'working' ? 'Uploading...' : 'Upload Data to Cloud'}
            </button>
            {status === 'error' && <p style={{ color: 'red' }}>Check console for errors.</p>}

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #444' }}>
                <h3>Manual Backup</h3>
                <button
                    onClick={handleDownloadBackup}
                    className="set-btn"
                    style={{ background: backupStatus === 'success' ? '#4caf50' : '#c5a059', color: '#111' }}
                >
                    Download Data Backup
                </button>
                {backupStatus === 'success' && <p style={{ color: '#8bc34a' }}>Backup downloaded.</p>}
                {backupStatus === 'error' && <p style={{ color: 'red' }}>Backup failed.</p>}
            </div>
        </div>
    );
}
